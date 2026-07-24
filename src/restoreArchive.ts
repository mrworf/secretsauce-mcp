import { createHash } from "node:crypto";
import {
  isAlias,
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  stringify as stringifyYaml,
  type Node,
} from "yaml";
import { z } from "./control/zod.js";
import { normalizeCredentialPlacement } from "./credentialPlacement.js";
import {
  parsePortableArchive,
  PortableArchiveError,
  type PortableArchiveCounts,
  type PortableArchiveManifest,
} from "./portableArchive.js";
import { isUuidV7 } from "./persistence/uuidV7.js";
import {
  normalizeManagedPolicyMatchers,
  type ManagedPolicyMatchers,
} from "./policyMatchers.js";
import {
  normalizeServiceDestination,
  normalizeServiceProfile,
} from "./serviceConfiguration.js";

const MAX_OBJECTS = 10_000;
const MAX_YAML_NODES = 100_000;
const MAX_YAML_DEPTH = 32;
const MAX_SCALAR_BYTES = 1024 * 1024;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const uuidV7 = z.string().refine(isUuidV7);
const boundedName = z.string().min(1).max(120);
const boundedDescription = z.string().min(1).max(1_024);
const hostMatcher = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("exact"), value: z.string().min(1).max(253) }).strict(),
  z.object({ kind: z.literal("suffix"), value: z.string().min(1).max(253) }).strict(),
  z.object({ kind: z.literal("regex"), value: z.string().min(3).max(256) }).strict(),
]);
const pathMatcher = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("exact"), value: z.string().min(1).max(2_048) }).strict(),
  z.object({ kind: z.literal("prefix"), value: z.string().min(1).max(2_048) }).strict(),
  z.object({ kind: z.literal("regex"), value: z.string().min(3).max(2_048) }).strict(),
]);
const destination = z.object({
  id: uuidV7,
  slug: z.string().min(1).max(64),
  base_url: z.string().min(8).max(2_048),
  schemes: z.array(z.enum(["http", "https"])).min(1).max(2),
  hosts: z.array(hostMatcher).min(1).max(32),
  ports: z.array(z.number().int().min(1).max(65_535)).min(1).max(32),
  tls: z.object({ verify: z.boolean() }).strict(),
}).strict();
const service = z.object({
  id: uuidV7,
  slug: z.string().min(1).max(64),
  name: boundedName,
  description: boundedDescription.optional(),
  documentation_url: z.string().min(8).max(2_048).optional(),
  lifecycle: z.enum(["draft", "published", "archived"]),
  destinations: z.array(destination).max(MAX_OBJECTS),
}).strict();
const servicesDocument = z.object({
  schema_version: z.literal(1),
  kind: z.literal("services"),
  services: z.array(service).max(MAX_OBJECTS),
}).strict();
const usage = z.object({
  kind: z.enum(["header", "query", "body"]),
  name: z.string().min(1).max(256),
  prefix: z.string().min(1).max(512).optional(),
  suffix: z.string().min(1).max(512).optional(),
  enforce_header_ownership: z.boolean(),
}).strict();
const credential = z.object({
  id: uuidV7,
  service_id: uuidV7,
  name: boundedName,
  description: boundedDescription.optional(),
  usage,
  status: z.enum(["configured", "unconfigured", "disabled", "archived"]),
  secret_record: z.object({
    locator: z.string().regex(UUID_V4),
    generation: z.number().int().positive(),
  }).strict().optional(),
}).strict();
const credentialsDocument = z.object({
  schema_version: z.literal(1),
  kind: z.literal("credentials"),
  credentials: z.array(credential).max(MAX_OBJECTS),
}).strict();
const safeguards = z.object({
  secretlint: z.object({
    enabled: z.boolean(),
    disabled_rule_ids: z.array(
      z.string().min(1).max(128).regex(/^[A-Za-z0-9@/_.-]+$/),
    ).max(128),
  }).strict(),
  binary_response: z.object({
    scan: z.boolean(),
    max_bytes: z.number().int().min(1).max(100 * 1024 * 1024).nullable(),
  }).strict(),
}).strict();
const rule = z.object({
  id: uuidV7,
  name: boundedName,
  reason: boundedDescription.optional(),
  effect: z.enum(["allow", "deny"]),
  priority: z.number().int().min(-1_000_000_000).max(1_000_000_000),
  enabled: z.boolean(),
  methods: z.array(z.string().min(1).max(32)).max(64),
  hosts: z.array(hostMatcher).max(64),
  paths: z.array(pathMatcher).max(128),
  response_safeguards: safeguards,
}).strict();
const policy = z.object({
  id: uuidV7,
  service_id: uuidV7,
  credential_id: uuidV7.optional(),
  name: boundedName,
  description: boundedDescription.optional(),
  operating_mode: z.enum(["allow", "deny"]),
  lifecycle: z.enum(["active", "archived"]),
  rules: z.array(rule).max(2_000),
}).strict();
const policiesDocument = z.object({
  schema_version: z.literal(1),
  kind: z.literal("policies"),
  policies: z.array(policy).max(MAX_OBJECTS),
}).strict();

export type RestoreService = z.infer<typeof service>;
export type RestoreCredential = z.infer<typeof credential>;
export type RestorePolicy = z.infer<typeof policy>;

export interface RestoreSecretSelection {
  serviceId: string;
  destinationId: string;
  credentialId: string;
  locator: string;
  generation: number;
}

export interface DecodedRestoreArchive {
  archiveId: string;
  archiveSha256: string;
  manifest: PortableArchiveManifest;
  services: RestoreService[];
  credentials: RestoreCredential[];
  policies: RestorePolicy[];
  counts: PortableArchiveCounts;
  secretSelection: RestoreSecretSelection[];
  secrets?: Buffer;
}

export class RestoreArchiveError extends Error {
  constructor(
    readonly code:
      | "invalid"
      | "too_large"
      | "corrupt"
      | "unsupported"
      | "inconsistent",
  ) {
    super(code);
    this.name = "RestoreArchiveError";
  }
}

export function decodeRestoreArchive(
  archive: Uint8Array,
): DecodedRestoreArchive {
  let secrets: Buffer | undefined;
  try {
    const parsed = parsePortableArchive(archive);
    const services = decodeDocument(
      parsed.entries.get("services.yaml")!,
      servicesDocument,
    ).services;
    const credentials = decodeDocument(
      parsed.entries.get("credentials.yaml")!,
      credentialsDocument,
    ).credentials;
    const policies = decodeDocument(
      parsed.entries.get("policies.yaml")!,
      policiesDocument,
    ).policies;
    const counts = validatePlan(
      parsed.manifest,
      services,
      credentials,
      policies,
    );
    const secretSelection = credentials.flatMap((entry) =>
      entry.secret_record === undefined ? [] : [{
        serviceId: entry.service_id,
        destinationId: entry.service_id,
        credentialId: entry.id,
        locator: entry.secret_record.locator,
        generation: entry.secret_record.generation,
      }]);
    const encrypted = parsed.entries.get("secrets.enc");
    if (encrypted !== undefined) secrets = Buffer.from(encrypted);
    return {
      archiveId: parsed.manifest.archive_id,
      archiveSha256: createHash("sha256").update(archive).digest("hex"),
      manifest: parsed.manifest,
      services,
      credentials,
      policies,
      counts,
      secretSelection,
      ...(secrets === undefined ? {} : { secrets }),
    };
  } catch (error) {
    secrets?.fill(0);
    if (error instanceof RestoreArchiveError) throw error;
    if (error instanceof PortableArchiveError) {
      throw new RestoreArchiveError(error.code);
    }
    throw new RestoreArchiveError("invalid");
  }
}

function decodeDocument<T>(
  bytes: Buffer,
  schema: z.ZodType<T>,
): T {
  let document;
  try {
    document = parseDocument(bytes.toString("utf8"), {
      schema: "core",
      strict: true,
      uniqueKeys: true,
    });
  } catch {
    throw new RestoreArchiveError("invalid");
  }
  if (document.errors.length > 0 || document.contents === null) {
    throw new RestoreArchiveError("invalid");
  }
  inspectYaml(document.contents);
  let value: unknown;
  try {
    value = document.toJS({ maxAliasCount: 0 });
  } catch {
    throw new RestoreArchiveError("invalid");
  }
  if (
    typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && Object.hasOwn(value, "schema_version")
    && (value as Record<string, unknown>).schema_version !== 1
  ) throw new RestoreArchiveError("unsupported");
  const result = schema.safeParse(value);
  if (!result.success) throw new RestoreArchiveError("invalid");
  const canonical = canonicalYaml(result.data);
  const matches = canonical.equals(bytes);
  canonical.fill(0);
  if (!matches) throw new RestoreArchiveError("invalid");
  return result.data;
}

function inspectYaml(root: Node): void {
  const queue: Array<{ node: Node; depth: number }> = [{ node: root, depth: 1 }];
  let count = 0;
  while (queue.length > 0) {
    const { node, depth } = queue.pop()!;
    count += 1;
    if (count > MAX_YAML_NODES) throw new RestoreArchiveError("too_large");
    if (depth > MAX_YAML_DEPTH) throw new RestoreArchiveError("too_large");
    if (isAlias(node) || node.tag !== undefined) {
      throw new RestoreArchiveError("invalid");
    }
    if (isScalar(node)) {
      if (
        typeof node.value === "string"
        && Buffer.byteLength(node.value, "utf8") > MAX_SCALAR_BYTES
      ) throw new RestoreArchiveError("too_large");
      continue;
    }
    if (isMap(node)) {
      for (const item of node.items) {
        if (item.key != null) {
          queue.push({ node: item.key as Node, depth: depth + 1 });
        }
        if (item.value != null) {
          queue.push({ node: item.value as Node, depth: depth + 1 });
        }
      }
      continue;
    }
    if (isSeq(node)) {
      for (const item of node.items) {
        if (item != null) queue.push({ node: item as Node, depth: depth + 1 });
      }
      continue;
    }
    throw new RestoreArchiveError("invalid");
  }
}

function validatePlan(
  manifest: PortableArchiveManifest,
  services: RestoreService[],
  credentials: RestoreCredential[],
  policies: RestorePolicy[],
): PortableArchiveCounts {
  const destinations = services.flatMap((entry) => entry.destinations);
  const rules = policies.flatMap((entry) => entry.rules);
  const secrets = credentials.filter((entry) => entry.secret_record !== undefined);
  const counts = {
    services: services.length,
    destinations: destinations.length,
    credentials: credentials.length,
    policies: policies.length,
    rules: rules.length,
    secrets: secrets.length,
  };
  if (
    Object.values(counts).slice(0, 5).reduce((sum, count) => sum + count, 0)
      > MAX_OBJECTS
    || Object.keys(counts).some((key) =>
      counts[key as keyof PortableArchiveCounts]
        !== manifest.object_counts[key as keyof PortableArchiveCounts])
  ) throw new RestoreArchiveError("inconsistent");

  const serviceIds = unique(services.map((entry) => entry.id));
  unique(services.map((entry) => entry.slug));
  unique(destinations.map((entry) => entry.id));
  const credentialIds = unique(credentials.map((entry) => entry.id));
  unique(policies.map((entry) => entry.id));
  unique(rules.map((entry) => entry.id));
  requireOrder(services, (left, right) =>
    compare(left.slug, right.slug) || compare(left.id, right.id));
  requireOrder(credentials, (left, right) =>
    compare(left.service_id, right.service_id)
      || compare(canonicalName(left.name), canonicalName(right.name))
      || compare(left.id, right.id));
  requireOrder(policies, (left, right) =>
    compare(left.service_id, right.service_id)
      || Number(left.credential_id !== undefined)
        - Number(right.credential_id !== undefined)
      || compare(canonicalName(left.name), canonicalName(right.name))
      || compare(left.id, right.id));

  for (const entry of services) {
    canonicalName(entry.name);
    const profile = normalizeServiceProfile({
      slug: entry.slug,
      name: entry.name,
      ...(entry.description === undefined ? {} : { description: entry.description }),
      ...(entry.documentation_url === undefined
        ? {}
        : { documentationUrl: entry.documentation_url }),
    });
    if (
      profile.slug !== entry.slug
      || profile.name !== entry.name
      || profile.description !== entry.description
      || profile.documentationUrl !== entry.documentation_url
    ) inconsistent();
    unique(entry.destinations.map((item) => item.slug));
    requireOrder(entry.destinations, (left, right) =>
      compare(left.slug, right.slug) || compare(left.id, right.id));
    for (const item of entry.destinations) {
      const normalized = normalizeServiceDestination({
        slug: item.slug,
        baseUrl: item.base_url,
        schemes: item.schemes,
        hosts: item.hosts.map((host) => ({ type: host.kind, value: host.value })),
        ports: item.ports,
        tlsVerify: item.tls.verify,
      });
      const candidate = {
        slug: normalized.slug,
        base_url: normalized.baseUrl,
        schemes: normalized.schemes,
        hosts: normalized.hosts.map((host) => ({
          kind: host.type,
          value: host.value,
        })),
        ports: normalized.ports,
        tls: { verify: normalized.tlsVerify },
      };
      if (!sameValue(candidate, omit(item, "id"))) inconsistent();
    }
  }
  uniqueNormalizedNames(services.map((entry) => entry.name));

  const credentialService = new Map<string, string>();
  for (const entry of credentials) {
    if (!serviceIds.has(entry.service_id)) inconsistent();
    canonicalName(entry.name);
    const placement = normalizeCredentialPlacement(entry.usage);
    const expected = {
      kind: placement.kind,
      name: placement.name,
      ...(placement.prefix === undefined ? {} : { prefix: placement.prefix }),
      ...(placement.suffix === undefined ? {} : { suffix: placement.suffix }),
      enforce_header_ownership: placement.enforceHeaderOwnership,
    };
    if (!sameValue(expected, entry.usage)) inconsistent();
    credentialService.set(entry.id, entry.service_id);
  }
  for (const group of grouped(credentials, (entry) => entry.service_id)) {
    uniqueNormalizedNames(group.map((entry) => entry.name));
  }

  const activeBoundaries = new Set<string>();
  for (const entry of policies) {
    if (!serviceIds.has(entry.service_id)) inconsistent();
    canonicalName(entry.name);
    if (
      entry.credential_id !== undefined
      && (
        !credentialIds.has(entry.credential_id)
        || credentialService.get(entry.credential_id) !== entry.service_id
      )
    ) inconsistent();
    if (entry.lifecycle === "active") {
      const boundary = `${entry.service_id}\0${entry.credential_id ?? ""}`;
      if (activeBoundaries.has(boundary)) inconsistent();
      activeBoundaries.add(boundary);
    }
    for (const item of entry.rules) {
      canonicalName(item.name);
      const normalized = normalizeManagedPolicyMatchers({
        methods: item.methods,
        hosts: item.hosts,
        paths: item.paths,
      });
      if (!sameValue(normalized, matcherFields(item))) inconsistent();
      validateSafeguards(item.response_safeguards);
    }
    uniqueNormalizedNames(entry.rules.map((item) => item.name));
    requireOrder(entry.rules, (left, right) =>
      right.priority - left.priority
        || compare(right.effect, left.effect)
        || compare(canonicalName(left.name), canonicalName(right.name))
        || compare(left.id, right.id));
  }
  for (const group of grouped(policies, (entry) =>
    `${entry.service_id}\0${entry.credential_id ?? ""}`)) {
    uniqueNormalizedNames(group.map((entry) => entry.name));
  }

  if (manifest.mode === "credential-less") {
    if (
      secrets.length !== 0
      || manifest.encryption !== undefined
      || credentials.some((entry) =>
        entry.status !== "unconfigured" && entry.status !== "archived")
    ) inconsistent();
  } else if (
    manifest.encryption === undefined
    || manifest.encryption.selected_count !== secrets.length
    || credentials.some((entry) => {
      const mustHaveSecret =
        entry.status === "configured" || entry.status === "disabled";
      return mustHaveSecret !== (entry.secret_record !== undefined);
    })
  ) {
    inconsistent();
  }
  unique(secrets.map((entry) => entry.secret_record!.locator));
  return counts;
}

function validateSafeguards(value: z.infer<typeof safeguards>): void {
  if (
    new Set(value.secretlint.disabled_rule_ids).size
      !== value.secretlint.disabled_rule_ids.length
    || !sameValue(
      value.secretlint.disabled_rule_ids,
      [...value.secretlint.disabled_rule_ids].sort(),
    )
  ) inconsistent();
}

function matcherFields(value: {
  methods: string[];
  hosts: ManagedPolicyMatchers["hosts"];
  paths: ManagedPolicyMatchers["paths"];
}): ManagedPolicyMatchers {
  return { methods: value.methods, hosts: value.hosts, paths: value.paths };
}

function canonicalName(value: string): string {
  const canonical = value.normalize("NFKC").trim();
  if (
    canonical !== value
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) inconsistent();
  return canonical.toLocaleLowerCase("und");
}

function uniqueNormalizedNames(values: string[]): void {
  unique(values.map(canonicalName));
}

function unique(values: string[]): Set<string> {
  const result = new Set(values);
  if (result.size !== values.length) inconsistent();
  return result;
}

function requireOrder<T>(
  values: T[],
  comparator: (left: T, right: T) => number,
): void {
  for (let index = 1; index < values.length; index += 1) {
    if (comparator(values[index - 1]!, values[index]!) > 0) inconsistent();
  }
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function grouped<T>(
  values: T[],
  key: (value: T) => string,
): T[][] {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const group = groups.get(key(value)) ?? [];
    group.push(value);
    groups.set(key(value), group);
  }
  return [...groups.values()];
}

function omit<T extends Record<string, unknown>, K extends keyof T>(
  value: T,
  key: K,
): Omit<T, K> {
  const result = { ...value };
  delete result[key];
  return result;
}

function canonicalYaml(value: unknown): Buffer {
  const source = stringifyYaml(sortValue(value), {
    aliasDuplicateObjects: false,
    lineWidth: 0,
  });
  return Buffer.from(source.endsWith("\n") ? source : `${source}\n`, "utf8");
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, entry]) => [key, sortValue(entry)]),
  );
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function inconsistent(): never {
  throw new RestoreArchiveError("inconsistent");
}
