import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { isAbsolute } from "node:path";
import { TextDecoder } from "node:util";
import { z } from "zod";
import {
  isAlias,
  isNode,
  LineCounter,
  parseDocument,
  visit,
  type Document,
  type Node,
} from "yaml";

export const V1_MIGRATION_SOURCE_LIMITS = Object.freeze({
  bytes: 16 * 1024 * 1024,
  nodes: 100_000,
  depth: 32,
  scalarBytes: 1024 * 1024,
  portableObjects: 10_000,
  rulesPerPolicy: 2_000,
  destinationsPerService: 64,
  aclValuesPerService: 128,
});

export type V1MigrationSourceReason =
  | "source_unavailable"
  | "source_not_canonical"
  | "source_not_regular"
  | "source_too_large"
  | "source_not_utf8"
  | "yaml_invalid"
  | "yaml_alias_forbidden"
  | "yaml_tag_forbidden"
  | "yaml_too_complex"
  | "yaml_too_deep"
  | "yaml_scalar_too_large"
  | "unsupported_schema"
  | "schema_invalid"
  | "portable_object_limit";

export class V1MigrationSourceError extends Error {
  readonly reason: V1MigrationSourceReason;
  readonly line?: number;
  readonly column?: number;

  constructor(reason: V1MigrationSourceReason, line?: number, column?: number) {
    const location = line === undefined ? "" : ` at line ${line}, column ${column ?? 1}`;
    super(`V1 migration source is invalid (${reason})${location}`);
    this.name = "V1MigrationSourceError";
    this.reason = reason;
    if (line !== undefined) this.line = line;
    if (column !== undefined) this.column = column;
  }
}

const hostMatcherSchema = z.union([
  z.object({ exact: z.string().min(1) }).strict(),
  z.object({ suffix: z.string().min(1) }).strict(),
  z.object({ regex: z.string().min(1) }).strict(),
]);

const credentialSourceSchema = z.union([
  z.object({ kind: z.literal("env"), name: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("file"), path: z.string().min(1) }).strict(),
]);

const credentialUsageSchema = z.object({
  kind: z.string().min(1),
  name: z.string().min(1).optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  enforce: z.boolean().optional(),
}).strict();

const serviceSchema = z.object({
  type: z.literal("http").optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  api_docs_url: z.string().url().optional(),
  destinations: z.array(z.object({
    id: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    base_url: z.string().url(),
    schemes: z.array(z.string().min(1)).optional(),
    hosts: z.array(hostMatcherSchema).optional(),
    ports: z.array(z.number().int().min(1).max(65_535)).optional(),
    tls: z.object({ verify: z.boolean().optional() }).strict().optional(),
  }).strict()).min(1).max(V1_MIGRATION_SOURCE_LIMITS.destinationsPerService),
  tls: z.object({ verify: z.boolean().optional() }).strict().optional(),
  no_auth: z.boolean().optional(),
  credentials: z.array(z.object({
    id: z.string().min(1),
    usage: credentialUsageSchema,
    source: credentialSourceSchema,
  }).strict()).default([]),
  access: z.object({
    users: z.array(z.string().min(1)).max(V1_MIGRATION_SOURCE_LIMITS.aclValuesPerService).default([]),
  }).strict().default({ users: [] }),
  policy: z.object({
    mode: z.enum(["allow", "deny"]).default("deny"),
    rules: z.array(z.object({
      id: z.string().min(1),
      effect: z.enum(["allow", "deny"]),
      priority: z.number().int(),
      methods: z.array(z.string().min(1)).default([]),
      hosts: z.array(z.string().min(1)).default([]),
      paths: z.array(z.string().min(1)).default([]),
      reason: z.string().optional(),
      secretlint: z.union([
        z.object({ enabled: z.literal(false) }).strict(),
        z.object({ disabled_rules: z.array(z.string().min(1)).min(1) }).strict(),
      ]).optional(),
      binary_response: z.object({
        scan: z.boolean().optional(),
        max_size: z.string().min(1).optional(),
      }).strict().optional(),
    }).strict()).max(V1_MIGRATION_SOURCE_LIMITS.rulesPerPolicy).default([]),
  }).strict().default({ mode: "deny", rules: [] }),
}).strict().superRefine((service, context) => {
  if (service.no_auth === true && service.credentials.length > 0) {
    context.addIssue({ code: "custom", path: ["credentials"], message: "credentials conflict with no_auth" });
  }
  if (service.no_auth !== true && service.credentials.length === 0) {
    context.addIssue({ code: "custom", path: ["credentials"], message: "credentials are required" });
  }
});

const discardedObject = z.record(z.string(), z.unknown());
const v1SourceSchema = z.object({
  version: z.number().int().optional(),
  server: discardedObject.optional(),
  control: discardedObject.optional(),
  auth: discardedObject.optional(),
  tokens: discardedObject.optional(),
  limits: discardedObject.optional(),
  logging: discardedObject.optional(),
  audit: discardedObject.optional(),
  persistence: discardedObject.optional(),
  runtime: discardedObject.optional(),
  identity: discardedObject.optional(),
  administrator: discardedObject.optional(),
  services: z.record(z.string().min(1), serviceSchema),
}).strict();

type ParsedV1MigrationService = z.infer<typeof serviceSchema>;
export type V1MigrationService = Omit<ParsedV1MigrationService, "access">;

export interface V1MigrationSource {
  schemaVersion: 1;
  sha256: string;
  services: Record<string, V1MigrationService>;
  discardedAclEntryCount: number;
}

export function readV1MigrationSource(path: string): V1MigrationSource {
  const bytes = readBoundedCanonicalFile(path);
  const source = decodeUtf8(bytes);
  const lineCounter = new LineCounter();
  const document = parseDocument(source, {
    lineCounter,
    prettyErrors: false,
    schema: "core",
    strict: true,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    const offset = document.errors[0]?.pos[0] ?? 0;
    throw atOffset("yaml_invalid", lineCounter, offset);
  }
  inspectSyntax(document, source, lineCounter);

  let raw: unknown;
  try {
    raw = document.toJS({ maxAliasCount: 0 });
  } catch {
    throw new V1MigrationSourceError("yaml_invalid");
  }
  if (isPlainObject(raw) && raw.version !== undefined && raw.version !== 1) {
    throw atPath("unsupported_schema", document, lineCounter, ["version"]);
  }

  const result = v1SourceSchema.safeParse(raw);
  if (!result.success) {
    throw atPath(
      "schema_invalid",
      document,
      lineCounter,
      result.error.issues[0]?.path.filter(
        (part): part is string | number => typeof part === "string" || typeof part === "number",
      ) ?? [],
    );
  }

  const parsedServices = result.data.services;
  let portableObjects = 0;
  let discardedAclEntryCount = 0;
  for (const service of Object.values(parsedServices)) {
    portableObjects += 2 + service.destinations.length + service.credentials.length + service.policy.rules.length;
    discardedAclEntryCount += service.access.users.length;
  }
  if (portableObjects > V1_MIGRATION_SOURCE_LIMITS.portableObjects) {
    throw new V1MigrationSourceError("portable_object_limit");
  }
  const services = Object.fromEntries(Object.entries(parsedServices).map(([sourceKey, service]) => {
    const { access: _discardedAccess, ...portable } = service;
    return [sourceKey, portable];
  }));

  return {
    schemaVersion: 1,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    services,
    discardedAclEntryCount,
  };
}

function readBoundedCanonicalFile(path: string): Buffer {
  if (!isAbsolute(path)) throw new V1MigrationSourceError("source_not_canonical");
  let canonical: string;
  try {
    canonical = realpathSync(path);
  } catch {
    throw new V1MigrationSourceError("source_unavailable");
  }
  if (canonical !== path) throw new V1MigrationSourceError("source_not_canonical");

  let descriptor: number | undefined;
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = fstatSync(descriptor);
    if (!before.isFile()) throw new V1MigrationSourceError("source_not_regular");
    if (before.size > V1_MIGRATION_SOURCE_LIMITS.bytes) {
      throw new V1MigrationSourceError("source_too_large");
    }
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor);
    if (
      bytes.byteLength > V1_MIGRATION_SOURCE_LIMITS.bytes
      || before.dev !== after.dev
      || before.ino !== after.ino
      || before.size !== after.size
      || bytes.byteLength !== after.size
    ) {
      throw new V1MigrationSourceError("source_too_large");
    }
    return bytes;
  } catch (error) {
    if (error instanceof V1MigrationSourceError) throw error;
    throw new V1MigrationSourceError("source_unavailable");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function decodeUtf8(bytes: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new V1MigrationSourceError("source_not_utf8");
  }
}

function inspectSyntax(
  document: Document<Node, true>,
  source: string,
  lineCounter: LineCounter,
): void {
  let nodeCount = 0;
  visit(document, (key, node, path) => {
    if (!isNode(node)) return;
    nodeCount += 1;
    const offset = node.range?.[0] ?? 0;
    if (nodeCount > V1_MIGRATION_SOURCE_LIMITS.nodes) {
      throw atOffset("yaml_too_complex", lineCounter, offset);
    }
    const depth = path.reduce((count, ancestor) => count + (isNode(ancestor) ? 1 : 0), 1);
    if (depth > V1_MIGRATION_SOURCE_LIMITS.depth) {
      throw atOffset("yaml_too_deep", lineCounter, offset);
    }
    if ("source" in node) {
      const range = node.range;
      if (
        range !== undefined
        && range !== null
        && Buffer.byteLength(source.slice(range[0], range[1]), "utf8")
          > V1_MIGRATION_SOURCE_LIMITS.scalarBytes
      ) {
        throw atOffset("yaml_scalar_too_large", lineCounter, offset);
      }
    }
    if (isAlias(node)) {
      throw atOffset("yaml_alias_forbidden", lineCounter, offset);
    }
    if ("anchor" in node && typeof node.anchor === "string") {
      throw atOffset("yaml_alias_forbidden", lineCounter, offset);
    }
    if (node.tag !== undefined) {
      throw atOffset("yaml_tag_forbidden", lineCounter, offset);
    }
  });
}

function atPath(
  reason: V1MigrationSourceReason,
  document: Document<Node, true>,
  lineCounter: LineCounter,
  path: Array<string | number>,
): V1MigrationSourceError {
  for (let length = path.length; length >= 0; length -= 1) {
    const node = document.getIn(path.slice(0, length), true) as { range?: [number, number, number] } | undefined;
    if (node?.range !== undefined) return atOffset(reason, lineCounter, node.range[0]);
  }
  return new V1MigrationSourceError(reason);
}

function atOffset(
  reason: V1MigrationSourceReason,
  lineCounter: LineCounter,
  offset: number,
): V1MigrationSourceError {
  const position = lineCounter.linePos(Math.max(0, offset));
  return new V1MigrationSourceError(reason, position.line, position.col);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
