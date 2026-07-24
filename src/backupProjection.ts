import { stringify as stringifyYaml } from "yaml";
import type { PersistenceQuery } from "./persistence/transaction.js";
import type { PersistenceOwner } from "./persistence/worker.js";

const PORTABLE_SCHEMA_VERSION = 1;
const MAX_OBJECTS = 10_000;
const MAX_DOCUMENT_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_DOCUMENT_BYTES = 256 * 1024 * 1024;

export type PortableBackupMode = "credential-less" | "encrypted-secrets";

export interface PortableSecretSelection {
  serviceId: string;
  destinationId: string;
  credentialId: string;
  locator: string;
  generation: number;
}

export interface PortableBackupProjection {
  mode: PortableBackupMode;
  counts: {
    services: number;
    destinations: number;
    credentials: number;
    policies: number;
    rules: number;
    secrets: number;
  };
  documents: {
    services: Buffer;
    credentials: Buffer;
    policies: Buffer;
  };
  secretSelection: PortableSecretSelection[];
}

export class BackupProjectionError extends Error {
  constructor(readonly code: "invalid" | "too_large" | "inconsistent") {
    super(code);
    this.name = "BackupProjectionError";
  }
}

interface ServiceRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  documentation_url: string | null;
  lifecycle: "draft" | "published" | "archived";
}

interface DestinationRow {
  id: string;
  service_id: string;
  slug: string;
  base_url: string;
  schemes_json: string;
  hosts_json: string;
  ports_json: string;
  tls_verify: number;
}

interface CredentialRow {
  id: string;
  service_id: string;
  name: string;
  description: string | null;
  usage_kind: "header" | "query" | "body";
  usage_name: string;
  usage_prefix: string | null;
  usage_suffix: string | null;
  enforce_header_ownership: number;
  status: "configured" | "unconfigured" | "disabled" | "archived";
  vault_state: string;
  vault_locator: string | null;
  vault_generation: number | null;
}

interface PolicyRow {
  id: string;
  service_id: string;
  credential_id: string | null;
  name: string;
  description: string | null;
  operating_mode: "allow" | "deny";
  lifecycle: "active" | "archived";
}

interface RuleRow {
  id: string;
  service_id: string;
  policy_id: string;
  name: string;
  reason: string | null;
  effect: "allow" | "deny";
  priority: number;
  enabled: number;
  methods_json: string;
  hosts_json: string;
  paths_json: string;
  response_safeguards_json: string;
}

interface ProjectionRows {
  services: ServiceRow[];
  destinations: DestinationRow[];
  credentials: CredentialRow[];
  policies: PolicyRow[];
  rules: RuleRow[];
}

export class PortableBackupProjectionService {
  constructor(private readonly owner: PersistenceOwner) {}

  async project(input: {
    includeSecrets: boolean;
  }): Promise<PortableBackupProjection> {
    if (typeof input.includeSecrets !== "boolean") {
      throw new BackupProjectionError("invalid");
    }
    try {
      const rows = await this.owner.execute({
        run: (database) => database.read(loadProjectionRows),
      });
      return project(rows, input.includeSecrets);
    } catch (error) {
      if (error instanceof BackupProjectionError) throw error;
      throw new BackupProjectionError("inconsistent");
    }
  }
}

function loadProjectionRows(
  query: PersistenceQuery,
): ProjectionRows {
  const services = query.all<ServiceRow>(`
    SELECT id, slug, name, description, documentation_url, lifecycle
    FROM services
    ORDER BY slug, id
    LIMIT ?
  `, [MAX_OBJECTS + 1]);
  const destinations = query.all<DestinationRow>(`
    SELECT id, service_id, slug, base_url, schemes_json, hosts_json,
      ports_json, tls_verify
    FROM service_destinations
    ORDER BY service_id, slug, id
    LIMIT ?
  `, [MAX_OBJECTS + 1]);
  const credentials = query.all<CredentialRow>(`
    SELECT id, service_id, name, description, usage_kind, usage_name,
      usage_prefix, usage_suffix, enforce_header_ownership, status,
      vault_state, vault_locator, vault_generation
    FROM service_credentials
    ORDER BY service_id, normalized_name, id
    LIMIT ?
  `, [MAX_OBJECTS + 1]);
  const policies = query.all<PolicyRow>(`
    SELECT id, service_id, credential_id, name, description, operating_mode,
      lifecycle
    FROM policies
    ORDER BY service_id, credential_id IS NOT NULL, normalized_name, id
    LIMIT ?
  `, [MAX_OBJECTS + 1]);
  const rules = query.all<RuleRow>(`
    SELECT id, service_id, policy_id, name, reason, effect, priority, enabled,
      methods_json, hosts_json, paths_json, response_safeguards_json
    FROM policy_rules
    ORDER BY service_id, policy_id, priority DESC, effect DESC,
      normalized_name, id
    LIMIT ?
  `, [MAX_OBJECTS + 1]);
  return { services, destinations, credentials, policies, rules };
}

function project(
  rows: ProjectionRows,
  includeSecrets: boolean,
): PortableBackupProjection {
  const { services, destinations, credentials, policies, rules } = rows;
  const objectCount = services.length + destinations.length + credentials.length
    + policies.length + rules.length;
  if (
    objectCount > MAX_OBJECTS
    || [services, destinations, credentials, policies, rules]
      .some((rows) => rows.length > MAX_OBJECTS)
  ) throw new BackupProjectionError("too_large");

  const destinationsByService = grouped(destinations, "service_id");
  const rulesByPolicy = grouped(rules, "policy_id");
  const secretSelection: PortableSecretSelection[] = [];
  const serviceDocument = {
    schema_version: PORTABLE_SCHEMA_VERSION,
    kind: "services",
    services: services.map((service) => ({
      id: service.id,
      slug: service.slug,
      name: service.name,
      ...(service.description === null
        ? {}
        : { description: service.description }),
      ...(service.documentation_url === null
        ? {}
        : { documentation_url: service.documentation_url }),
      lifecycle: service.lifecycle,
      destinations: (destinationsByService.get(service.id) ?? []).map(
        (destination) => ({
          id: destination.id,
          slug: destination.slug,
          base_url: destination.base_url,
          schemes: parseArray(destination.schemes_json),
          hosts: parseArray(destination.hosts_json),
          ports: parseArray(destination.ports_json),
          tls: { verify: destination.tls_verify === 1 },
        }),
      ),
    })),
  };
  const credentialDocument = {
    schema_version: PORTABLE_SCHEMA_VERSION,
    kind: "credentials",
    credentials: credentials.map((credential) => {
      const hasSecret = credential.status === "configured"
        || credential.status === "disabled";
      if (
        includeSecrets
        && hasSecret
        && (
          credential.vault_state !== "idle"
          || credential.vault_locator === null
          || credential.vault_generation === null
        )
      ) throw new BackupProjectionError("inconsistent");
      if (
        includeSecrets
        && hasSecret
        && credential.vault_locator !== null
        && credential.vault_generation !== null
      ) {
        secretSelection.push({
          serviceId: credential.service_id,
          destinationId: credential.service_id,
          credentialId: credential.id,
          locator: credential.vault_locator,
          generation: credential.vault_generation,
        });
      }
      return {
        id: credential.id,
        service_id: credential.service_id,
        name: credential.name,
        ...(credential.description === null
          ? {}
          : { description: credential.description }),
        usage: {
          kind: credential.usage_kind,
          name: credential.usage_name,
          ...(credential.usage_prefix === null
            ? {}
            : { prefix: credential.usage_prefix }),
          ...(credential.usage_suffix === null
            ? {}
            : { suffix: credential.usage_suffix }),
          enforce_header_ownership:
            credential.enforce_header_ownership === 1,
        },
        status: includeSecrets || credential.status === "archived"
          ? credential.status
          : "unconfigured",
        ...(includeSecrets && hasSecret
          ? {
              secret_record: {
                locator: credential.vault_locator!,
                generation: credential.vault_generation!,
              },
            }
          : {}),
      };
    }),
  };
  const policyDocument = {
    schema_version: PORTABLE_SCHEMA_VERSION,
    kind: "policies",
    policies: policies.map((policy) => ({
      id: policy.id,
      service_id: policy.service_id,
      ...(policy.credential_id === null
        ? {}
        : { credential_id: policy.credential_id }),
      name: policy.name,
      ...(policy.description === null
        ? {}
        : { description: policy.description }),
      operating_mode: policy.operating_mode,
      lifecycle: policy.lifecycle,
      rules: (rulesByPolicy.get(policy.id) ?? []).map((rule) => ({
        id: rule.id,
        name: rule.name,
        ...(rule.reason === null ? {} : { reason: rule.reason }),
        effect: rule.effect,
        priority: rule.priority,
        enabled: rule.enabled === 1,
        methods: parseArray(rule.methods_json),
        hosts: parseArray(rule.hosts_json),
        paths: parseArray(rule.paths_json),
        response_safeguards: parseObject(rule.response_safeguards_json),
      })),
    })),
  };
  const documents = {
    services: canonicalYaml(serviceDocument),
    credentials: canonicalYaml(credentialDocument),
    policies: canonicalYaml(policyDocument),
  };
  const totalBytes = Object.values(documents)
    .reduce((total, document) => total + document.byteLength, 0);
  if (totalBytes > MAX_TOTAL_DOCUMENT_BYTES) {
    for (const document of Object.values(documents)) document.fill(0);
    throw new BackupProjectionError("too_large");
  }
  return {
    mode: includeSecrets ? "encrypted-secrets" : "credential-less",
    counts: {
      services: services.length,
      destinations: destinations.length,
      credentials: credentials.length,
      policies: policies.length,
      rules: rules.length,
      secrets: secretSelection.length,
    },
    documents,
    secretSelection,
  };
}

function grouped<T extends Record<K, string>, K extends keyof T>(
  rows: T[],
  key: K,
): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const row of rows) {
    const value = row[key];
    const group = result.get(value) ?? [];
    group.push(row);
    result.set(value, group);
  }
  return result;
}

function parseArray(source: string): unknown[] {
  const value = parseJson(source);
  if (!Array.isArray(value)) throw new BackupProjectionError("inconsistent");
  return value;
}

function parseObject(source: string): Record<string, unknown> {
  const value = parseJson(source);
  if (
    typeof value !== "object"
    || value === null
    || Array.isArray(value)
  ) throw new BackupProjectionError("inconsistent");
  return value as Record<string, unknown>;
}

function parseJson(source: string): unknown {
  try {
    return JSON.parse(source);
  } catch {
    throw new BackupProjectionError("inconsistent");
  }
}

function canonicalYaml(value: unknown): Buffer {
  let source: string;
  try {
    source = stringifyYaml(sortValue(value), {
      aliasDuplicateObjects: false,
      lineWidth: 0,
    });
  } catch {
    throw new BackupProjectionError("inconsistent");
  }
  const document = Buffer.from(
    source.endsWith("\n") ? source : `${source}\n`,
    "utf8",
  );
  if (document.byteLength > MAX_DOCUMENT_BYTES) {
    document.fill(0);
    throw new BackupProjectionError("too_large");
  }
  return document;
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
