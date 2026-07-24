import { createHash, createHmac, randomBytes } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { TextDecoder } from "node:util";
import { z } from "zod";
import { isAlias, isNode, parseDocument, visit } from "yaml";
import { canonicalControlJson } from "./control/idempotency.js";
import type {
  V1MigrationPlan,
  V1MigrationReport,
} from "./v1MigrationPlan.js";

const MAX_ALLOWLIST_BYTES = 1024 * 1024;
const MAX_ALLOWLIST_ENTRIES = 10_000;
const MAX_VALUE_BYTES = 65_536;
const ENVIRONMENT_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export type V1MigrationAllowlistErrorCode =
  | "allowlist_unavailable"
  | "allowlist_unsafe"
  | "allowlist_invalid";

export type V1MigrationCredentialWarning =
  | "source_not_allowlisted"
  | "source_missing"
  | "source_unreadable"
  | "source_unsafe"
  | "source_malformed"
  | "source_oversized";

export class V1MigrationAllowlistError extends Error {
  constructor(readonly code: V1MigrationAllowlistErrorCode) {
    super("V1 migration credential allowlist is invalid.");
    this.name = "V1MigrationAllowlistError";
  }
}

export class V1MigrationResolutionContext {
  readonly #key: Buffer;
  #disposed = false;

  constructor(key: Buffer = randomBytes(32)) {
    if (key.byteLength !== 32) throw new V1MigrationAllowlistError("allowlist_invalid");
    this.#key = Buffer.from(key);
  }

  binding(credentialId: string, value: Buffer): string {
    if (this.#disposed) throw new V1MigrationAllowlistError("allowlist_invalid");
    return createHmac("sha256", this.#key)
      .update("secretsauce-v1-migration-value-v1\0")
      .update(credentialId)
      .update("\0")
      .update(value)
      .digest("hex");
  }

  dispose(): void {
    this.#key.fill(0);
    this.#disposed = true;
  }
}

interface CredentialDisposition {
  credentialId: string;
  status: "configured" | "unconfigured";
  binding?: string;
  warning?: V1MigrationCredentialWarning;
}

export class V1MigrationResolvedPlan {
  readonly resolutionMode = "allowlisted" as const;
  readonly digest: string;
  readonly report: V1MigrationReport;
  readonly #values: Map<string, Buffer>;
  #disposed = false;

  constructor(
    readonly base: V1MigrationPlan,
    dispositions: CredentialDisposition[],
    values: Map<string, Buffer>,
  ) {
    this.#values = values;
    this.digest = createHash("sha256")
      .update("secretsauce-v1-migration-resolution-v1\0")
      .update(canonicalControlJson({
        basePlanDigest: base.digest,
        resolutionMode: "allowlisted",
        dispositions: dispositions.map((entry) => ({
          credentialId: entry.credentialId,
          status: entry.status,
          ...(entry.binding === undefined ? {} : { binding: entry.binding }),
          ...(entry.warning === undefined ? {} : { warning: entry.warning }),
        })),
      }))
      .digest("hex");
    const configured = dispositions.filter(({ status }) => status === "configured").length;
    const warningCounts: Record<string, number> = {};
    for (const disposition of dispositions) {
      if (disposition.warning !== undefined) {
        warningCounts[disposition.warning] = (warningCounts[disposition.warning] ?? 0) + 1;
      }
    }
    this.report = {
      ...base.report,
      planDigest: this.digest,
      resolutionMode: "allowlisted",
      counts: {
        ...base.report.counts,
        configuredCredentials: configured,
        unconfiguredCredentials: dispositions.length - configured,
      },
      warningCounts,
    };
  }

  credentialValue(credentialId: string): Buffer | undefined {
    if (this.#disposed) return undefined;
    return this.#values.get(credentialId);
  }

  configuredCredentialIds(): string[] {
    if (this.#disposed) return [];
    return [...this.#values.keys()].sort();
  }

  dispose(): void {
    for (const value of this.#values.values()) value.fill(0);
    this.#values.clear();
    this.#disposed = true;
  }
}

const allowlistSchema = z.object({
  version: z.literal(1),
  environment: z.array(z.string().regex(ENVIRONMENT_NAME)).default([]),
  files: z.array(z.string().min(1).max(4_096)).default([]),
}).strict();

export function resolveV1MigrationCredentials(
  plan: V1MigrationPlan,
  input: {
    allowlistFile: string;
    environment?: NodeJS.ProcessEnv;
    context: V1MigrationResolutionContext;
  },
): V1MigrationResolvedPlan {
  const allowlist = readAllowlist(input.allowlistFile);
  const environment = input.environment ?? process.env;
  const dispositions: CredentialDisposition[] = [];
  const values = new Map<string, Buffer>();
  try {
    for (const service of plan.services) {
      for (const credential of service.credentials) {
        const result = credential.source.kind === "env"
          ? resolveEnvironmentValue(
              credential.source.name,
              allowlist.environment,
              environment,
            )
          : resolveFileValue(credential.source.path, allowlist.files);
        if (result.value === undefined) {
          dispositions.push({
            credentialId: credential.id,
            status: "unconfigured",
            warning: result.warning!,
          });
          continue;
        }
        let binding: string;
        try {
          binding = input.context.binding(credential.id, result.value);
        } catch (error) {
          result.value.fill(0);
          throw error;
        }
        values.set(credential.id, result.value);
        dispositions.push({
          credentialId: credential.id,
          status: "configured",
          binding,
        });
      }
    }
    return new V1MigrationResolvedPlan(plan, dispositions, values);
  } catch (error) {
    for (const value of values.values()) value.fill(0);
    values.clear();
    throw error;
  }
}

function readAllowlist(path: string): {
  environment: Set<string>;
  files: Set<string>;
} {
  if (!isAbsolute(path) || resolve(path) !== path) unsafeAllowlist();
  let descriptor: number | undefined;
  let bytes: Buffer;
  try {
    if (realpathSync(path) !== path) unsafeAllowlist();
    const link = lstatSync(path);
    if (
      link.isSymbolicLink()
      || !link.isFile()
      || (link.mode & 0o777) !== 0o400
      || !safeOwner(link.uid)
      || link.size > MAX_ALLOWLIST_BYTES
    ) unsafeAllowlist();
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = fstatSync(descriptor);
    if (
      !before.isFile()
      || (before.mode & 0o777) !== 0o400
      || !safeOwner(before.uid)
      || before.size > MAX_ALLOWLIST_BYTES
      || link.dev !== before.dev
      || link.ino !== before.ino
    ) unsafeAllowlist();
    bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor);
    if (
      bytes.byteLength > MAX_ALLOWLIST_BYTES
      || bytes.byteLength !== after.size
      || before.dev !== after.dev
      || before.ino !== after.ino
      || before.size !== after.size
      || before.mtimeMs !== after.mtimeMs
      || before.ctimeMs !== after.ctimeMs
    ) unsafeAllowlist();
  } catch (error) {
    if (error instanceof V1MigrationAllowlistError) throw error;
    throw new V1MigrationAllowlistError("allowlist_unavailable");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }

  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new V1MigrationAllowlistError("allowlist_invalid");
  }
  const document = parseDocument(source, {
    prettyErrors: false,
    schema: "core",
    strict: true,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) invalidAllowlist();
  visit(document, (_key, node) => {
    if (!isNode(node)) return;
    if (
      isAlias(node)
      || ("anchor" in node && typeof node.anchor === "string")
      || node.tag !== undefined
    ) invalidAllowlist();
  });
  let raw: unknown;
  try {
    raw = document.toJS({ maxAliasCount: 0 });
  } catch {
    invalidAllowlist();
  }
  const parsed = allowlistSchema.safeParse(raw);
  if (!parsed.success) invalidAllowlist();
  const environment = [...parsed.data.environment].sort();
  const files = [...parsed.data.files].sort();
  if (
    environment.length + files.length > MAX_ALLOWLIST_ENTRIES
    || new Set(environment).size !== environment.length
    || new Set(files).size !== files.length
    || files.some((file) =>
      !isAbsolute(file)
      || resolve(file) !== file
      || file.includes("\0"))
  ) invalidAllowlist();
  return {
    environment: new Set(environment),
    files: new Set(files),
  };
}

function resolveEnvironmentValue(
  name: string,
  allowlist: Set<string>,
  environment: NodeJS.ProcessEnv,
): { value?: Buffer; warning?: V1MigrationCredentialWarning } {
  if (!allowlist.has(name)) return { warning: "source_not_allowlisted" };
  const source = environment[name];
  if (source === undefined) return { warning: "source_missing" };
  const value = Buffer.from(source, "utf8");
  if (value.byteLength > MAX_VALUE_BYTES) {
    value.fill(0);
    return { warning: "source_oversized" };
  }
  if (
    value.byteLength === 0
    || source.includes("\0")
    || value.toString("utf8") !== source
  ) {
    value.fill(0);
    return { warning: "source_malformed" };
  }
  return { value };
}

function resolveFileValue(
  path: string,
  allowlist: Set<string>,
): { value?: Buffer; warning?: V1MigrationCredentialWarning } {
  if (!allowlist.has(path)) return { warning: "source_not_allowlisted" };
  let stats;
  try {
    stats = lstatSync(path);
  } catch (error) {
    return { warning: errorCode(error) === "ENOENT" ? "source_missing" : "source_unreadable" };
  }
  if (
    !isAbsolute(path)
    || resolve(path) !== path
    || stats.isSymbolicLink()
    || !stats.isFile()
    || !safeOwner(stats.uid)
    || (stats.mode & 0o400) === 0
    || (stats.mode & 0o077) !== 0
  ) return { warning: "source_unsafe" };
  if (stats.size > MAX_VALUE_BYTES) return { warning: "source_oversized" };
  try {
    if (realpathSync(path) !== path) return { warning: "source_unsafe" };
  } catch {
    return { warning: "source_unreadable" };
  }

  let descriptor: number | undefined;
  let raw: Buffer | undefined;
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = fstatSync(descriptor);
    if (
      !before.isFile()
      || !safeOwner(before.uid)
      || (before.mode & 0o400) === 0
      || (before.mode & 0o077) !== 0
      || before.size > MAX_VALUE_BYTES
      || stats.dev !== before.dev
      || stats.ino !== before.ino
    ) return { warning: "source_unsafe" };
    raw = readFileSync(descriptor);
    const after = fstatSync(descriptor);
    if (raw.byteLength > MAX_VALUE_BYTES) return { warning: "source_oversized" };
    if (
      raw.byteLength !== after.size
      || before.size !== after.size
      || before.dev !== after.dev
      || before.ino !== after.ino
      || before.mtimeMs !== after.mtimeMs
      || before.ctimeMs !== after.ctimeMs
    ) return { warning: "source_unreadable" };
    let decoded: string;
    try {
      decoded = new TextDecoder("utf-8", { fatal: true }).decode(raw);
    } catch {
      return { warning: "source_malformed" };
    }
    const normalized = decoded.trim();
    const value = Buffer.from(normalized, "utf8");
    if (
      value.byteLength === 0
      || value.byteLength > MAX_VALUE_BYTES
      || normalized.includes("\0")
      || value.toString("utf8") !== normalized
    ) {
      value.fill(0);
      return { warning: value.byteLength > MAX_VALUE_BYTES ? "source_oversized" : "source_malformed" };
    }
    return { value };
  } catch {
    return { warning: "source_unreadable" };
  } finally {
    raw?.fill(0);
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function safeOwner(uid: number): boolean {
  const current = typeof process.getuid === "function" ? process.getuid() : uid;
  return uid === 0 || uid === current;
}

function errorCode(error: unknown): string | undefined {
  return error !== null && typeof error === "object" && "code" in error
    ? String(error.code)
    : undefined;
}

function unsafeAllowlist(): never {
  throw new V1MigrationAllowlistError("allowlist_unsafe");
}

function invalidAllowlist(): never {
  throw new V1MigrationAllowlistError("allowlist_invalid");
}
