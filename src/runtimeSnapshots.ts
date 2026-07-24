import { createHash } from "node:crypto";
import { canonicalJson } from "./vault/canonicalJson.js";
import { PersistenceError } from "./persistence/errors.js";
import type {
  PersistenceQuery,
  PersistenceTransaction,
} from "./persistence/transaction.js";
import type { PersistenceOwner } from "./persistence/worker.js";
import { UuidV7Generator } from "./persistence/uuidV7.js";

const MAX_RUNTIME_SNAPSHOT_BYTES = 4 * 1024 * 1024;
const MAX_RUNTIME_SERVICES = 1_000;
const MAX_RUNTIME_CREDENTIALS = 1_000;
const MAX_RUNTIME_RULES = 20_000;

export interface RuntimeSelector {
  kind: "all" | "explicit";
  groupIds: string[];
  userIds: string[];
}

export interface RuntimeServiceSnapshot {
  formatVersion: 1;
  id: string;
  service: {
    id: string;
    slug: string;
    name: string;
    description?: string;
    documentationUrl?: string;
    revisionId: string;
    publicationGeneration: number;
  };
  destinations: Array<{
    id: string;
    slug: string;
    baseUrl: string;
    schemes: string[];
    hosts: unknown[];
    ports: number[];
    tlsVerify: boolean;
  }>;
  serviceSelector?: RuntimeSelector;
  serviceAuthorizationGeneration: number;
  credentials: Array<{
    id: string;
    name: string;
    description?: string;
    usage: {
      kind: "header" | "query" | "body";
      name: string;
      prefix?: string;
      suffix?: string;
      enforceHeaderOwnership: boolean;
    };
    status: "configured" | "unconfigured" | "disabled" | "archived";
    vaultState: string;
    locator?: string;
    generation?: number;
    authorizationGeneration: number;
    selector?: RuntimeSelector;
  }>;
  policies: Array<{
    id: string;
    credentialId?: string;
    mode: "allow" | "deny";
    evaluationGeneration: number;
    rules: Array<{
      id: string;
      effect: "allow" | "deny";
      priority: number;
      enabled: boolean;
      methods: string[];
      hosts: unknown[];
      paths: unknown[];
      reason?: string;
      responseSafeguards: unknown;
      selector?: RuntimeSelector;
    }>;
  }>;
}

export interface CanonicalRuntimeSnapshot {
  document: RuntimeServiceSnapshot;
  json: string;
  digest: string;
}

export interface RuntimeActivationView {
  state: "inactive" | "active";
  activationGeneration: number;
  globalReferenceEpoch: number;
  version: number;
  activatedAt?: number;
}

interface ServiceRow {
  id: string;
  lifecycle: string;
  published_revision_id: string | null;
  publication_generation: number;
}

interface RevisionRow {
  document_json: string;
}

export function canonicalRuntimeSnapshot(
  query: Pick<PersistenceQuery, "get" | "all">,
  serviceId: string,
  snapshotId: string,
): CanonicalRuntimeSnapshot {
  const service = query.get<ServiceRow>(`
    SELECT id, lifecycle, published_revision_id, publication_generation
    FROM services WHERE id = ?
  `, [serviceId]);
  if (
    service === undefined
    || service.lifecycle !== "published"
    || service.published_revision_id === null
    || service.publication_generation < 1
  ) {
    throw new PersistenceError("identity_conflict");
  }
  const revision = query.get<RevisionRow>(`
    SELECT document_json FROM service_config_versions
    WHERE id = ? AND service_id = ?
  `, [service.published_revision_id, service.id]);
  if (revision === undefined) throw new PersistenceError("database_unavailable");
  const published = parseObject(revision.document_json);
  const profile = objectField(published, "service");
  const destinations = arrayField(published, "destinations").map((value) => {
    const destination = asObject(value);
    return {
      id: stringField(destination, "id"),
      slug: stringField(destination, "slug"),
      baseUrl: stringField(destination, "baseUrl"),
      schemes: stringArray(destination.schemes),
      hosts: unknownArray(destination.hosts),
      ports: numberArray(destination.ports),
      tlsVerify: booleanField(destination, "tlsVerify"),
    };
  });
  if (destinations.length < 1 || destinations.length > 64) {
    throw new PersistenceError("identity_conflict");
  }
  const serviceState = query.get<{ authorization_generation: number }>(`
    SELECT authorization_generation FROM service_assignment_states
    WHERE service_id = ?
  `, [service.id]);
  if (serviceState === undefined) throw new PersistenceError("database_unavailable");

  const credentials = query.all<{
    id: string;
    name: string;
    description: string | null;
    usage_kind: "header" | "query" | "body";
    usage_name: string;
    usage_prefix: string | null;
    usage_suffix: string | null;
    enforce_header_ownership: 0 | 1;
    status: "configured" | "unconfigured" | "disabled" | "archived";
    vault_state: string;
    vault_locator: string | null;
    vault_generation: number | null;
    authorization_generation: number;
  }>(`
    SELECT id, name, description, usage_kind, usage_name, usage_prefix,
      usage_suffix, enforce_header_ownership, status, vault_state,
      vault_locator, vault_generation, authorization_generation
    FROM service_credentials
    WHERE service_id = ?
    ORDER BY normalized_name, id
    LIMIT ?
  `, [service.id, MAX_RUNTIME_CREDENTIALS + 1]);
  if (credentials.length > MAX_RUNTIME_CREDENTIALS) {
    throw new PersistenceError("identity_conflict");
  }

  let ruleCount = 0;
  const policies = query.all<{
    id: string;
    credential_id: string | null;
    operating_mode: "allow" | "deny";
    evaluation_generation: number;
  }>(`
    SELECT id, credential_id, operating_mode, evaluation_generation
    FROM policies
    WHERE service_id = ? AND lifecycle = 'active'
    ORDER BY credential_id, normalized_name, id
    LIMIT 1001
  `, [service.id]).map((policy) => {
    const rules = query.all<{
      id: string;
      effect: "allow" | "deny";
      priority: number;
      enabled: 0 | 1;
      methods_json: string;
      hosts_json: string;
      paths_json: string;
      reason: string | null;
      response_safeguards_json: string;
    }>(`
      SELECT id, effect, priority, enabled, methods_json, hosts_json,
        paths_json, reason, response_safeguards_json
      FROM policy_rules
      WHERE service_id = ? AND policy_id = ?
      ORDER BY priority DESC, effect DESC, normalized_name, id
      LIMIT 2001
    `, [service.id, policy.id]);
    if (rules.length > 2_000) throw new PersistenceError("identity_conflict");
    ruleCount += rules.length;
    if (ruleCount > MAX_RUNTIME_RULES) throw new PersistenceError("identity_conflict");
    return {
      id: policy.id,
      ...(policy.credential_id === null
        ? {}
        : { credentialId: policy.credential_id }),
      mode: policy.operating_mode,
      evaluationGeneration: policy.evaluation_generation,
      rules: rules.map((rule) => ({
        id: rule.id,
        effect: rule.effect,
        priority: rule.priority,
        enabled: rule.enabled === 1,
        methods: parseArray<string>(rule.methods_json),
        hosts: parseArray(rule.hosts_json),
        paths: parseArray(rule.paths_json),
        ...(rule.reason === null ? {} : { reason: rule.reason }),
        responseSafeguards: parseJson(rule.response_safeguards_json),
        ...(selector(query, "policy_rule_principal_assignments", "rule_id", rule.id)
          === undefined
          ? {}
          : {
              selector: selector(
                query,
                "policy_rule_principal_assignments",
                "rule_id",
                rule.id,
              )!,
            }),
      })),
    };
  });
  if (policies.length > 1_000) throw new PersistenceError("identity_conflict");
  const description = optionalString(profile.description);
  const documentationUrl = optionalString(profile.documentationUrl);

  const document: RuntimeServiceSnapshot = {
    formatVersion: 1,
    id: snapshotId,
    service: {
      id: service.id,
      slug: stringField(profile, "slug"),
      name: stringField(profile, "name"),
      ...(description === undefined ? {} : { description }),
      ...(documentationUrl === undefined ? {} : { documentationUrl }),
      revisionId: service.published_revision_id,
      publicationGeneration: service.publication_generation,
    },
    destinations,
    ...(selector(query, "service_principal_assignments", "service_id", service.id)
      === undefined
      ? {}
      : {
          serviceSelector: selector(
            query,
            "service_principal_assignments",
            "service_id",
            service.id,
          )!,
        }),
    serviceAuthorizationGeneration: serviceState.authorization_generation,
    credentials: credentials.map((credential) => ({
      id: credential.id,
      name: credential.name,
      ...(credential.description === null ? {} : { description: credential.description }),
      usage: {
        kind: credential.usage_kind,
        name: credential.usage_name,
        ...(credential.usage_prefix === null ? {} : { prefix: credential.usage_prefix }),
        ...(credential.usage_suffix === null ? {} : { suffix: credential.usage_suffix }),
        enforceHeaderOwnership: credential.enforce_header_ownership === 1,
      },
      status: credential.status,
      vaultState: credential.vault_state,
      ...(credential.vault_locator === null ? {} : { locator: credential.vault_locator }),
      ...(credential.vault_generation === null
        ? {}
        : { generation: credential.vault_generation }),
      authorizationGeneration: credential.authorization_generation,
      ...(selector(
        query,
        "credential_principal_assignments",
        "credential_id",
        credential.id,
      ) === undefined
        ? {}
        : {
            selector: selector(
              query,
              "credential_principal_assignments",
              "credential_id",
              credential.id,
            )!,
          }),
    })),
    policies,
  };
  const json = canonicalJson(document);
  if (Buffer.byteLength(json, "utf8") > MAX_RUNTIME_SNAPSHOT_BYTES) {
    throw new PersistenceError("identity_conflict");
  }
  return {
    document,
    json,
    digest: createHash("sha256").update(json, "utf8").digest("hex"),
  };
}

export function persistRuntimeSnapshot(
  transaction: PersistenceTransaction,
  serviceId: string,
  snapshotId: string,
): CanonicalRuntimeSnapshot {
  const snapshot = canonicalRuntimeSnapshot(transaction, serviceId, snapshotId);
  const now = transaction.timestamp();
  transaction.run(`
    INSERT INTO runtime_service_snapshots (
      id, service_id, publication_generation, document_json, digest, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `, [
    snapshotId,
    serviceId,
    snapshot.document.service.publicationGeneration,
    snapshot.json,
    snapshot.digest,
    now,
  ]);
  const active = transaction.get<{ state: string }>(
    "SELECT state FROM runtime_activation WHERE singleton = 1",
  );
  if (active?.state === "active") {
    transaction.run(`
      INSERT INTO runtime_active_services (
        service_id, snapshot_id, publication_generation, activated_at
      ) VALUES (?, ?, ?, ?)
      ON CONFLICT(service_id) DO UPDATE SET
        snapshot_id = excluded.snapshot_id,
        publication_generation = excluded.publication_generation,
        activated_at = excluded.activated_at
    `, [
      serviceId,
      snapshotId,
      snapshot.document.service.publicationGeneration,
      now,
    ]);
  }
  pruneRuntimeSnapshots(transaction, serviceId);
  return snapshot;
}

export function activateRuntimeSnapshots(
  transaction: PersistenceTransaction,
  nextUuid: () => string,
): { activationGeneration: number; globalReferenceEpoch: number; serviceCount: number } {
  const activation = transaction.get<{
    state: string;
    activation_generation: number;
    global_reference_epoch: number;
    version: number;
  }>("SELECT * FROM runtime_activation WHERE singleton = 1");
  if (activation === undefined || activation.state !== "inactive") {
    throw new PersistenceError("identity_conflict");
  }
  const services = transaction.all<{ id: string }>(`
    SELECT id FROM services
    WHERE lifecycle = 'published' AND published_revision_id IS NOT NULL
    ORDER BY id
    LIMIT ?
  `, [MAX_RUNTIME_SERVICES + 1]);
  if (services.length < 1 || services.length > MAX_RUNTIME_SERVICES) {
    throw new PersistenceError("identity_conflict");
  }
  const now = transaction.timestamp();
  transaction.run("DELETE FROM runtime_active_services");
  for (const service of services) {
    const snapshotId = nextUuid();
    const snapshot = canonicalRuntimeSnapshot(
      transaction,
      service.id,
      snapshotId,
    );
    transaction.run(`
      INSERT INTO runtime_service_snapshots (
        id, service_id, publication_generation, document_json, digest, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      snapshotId,
      service.id,
      snapshot.document.service.publicationGeneration,
      snapshot.json,
      snapshot.digest,
      now,
    ]);
    transaction.run(`
      INSERT INTO runtime_active_services (
        service_id, snapshot_id, publication_generation, activated_at
      ) VALUES (?, ?, ?, ?)
    `, [
      service.id,
      snapshotId,
      snapshot.document.service.publicationGeneration,
      now,
    ]);
  }
  const activationGeneration = activation.activation_generation + 1;
  const globalReferenceEpoch = activation.global_reference_epoch + 1;
  const updated = transaction.run(`
    UPDATE runtime_activation
    SET state = 'active', activation_generation = ?,
      global_reference_epoch = ?, version = version + 1,
      activated_at = ?, updated_at = ?
    WHERE singleton = 1 AND version = ? AND state = 'inactive'
  `, [
    activationGeneration,
    globalReferenceEpoch,
    now,
    now,
    activation.version,
  ]);
  if (updated.changes !== 1) throw new PersistenceError("identity_stale");
  return { activationGeneration, globalReferenceEpoch, serviceCount: services.length };
}

export class RuntimeActivationRepository {
  readonly #uuid: () => string;

  constructor(
    private readonly owner: PersistenceOwner,
    now: () => number = Date.now,
    uuid?: () => string,
  ) {
    const generator = new UuidV7Generator({ now });
    this.#uuid = uuid ?? (() => generator.next());
  }

  state(): Promise<RuntimeActivationView> {
    return this.owner.execute({
      run: (database) => database.read((query) => {
        const row = query.get<{
          state: "inactive" | "active";
          activation_generation: number;
          global_reference_epoch: number;
          version: number;
          activated_at: number | null;
        }>("SELECT * FROM runtime_activation WHERE singleton = 1");
        if (row === undefined) throw new PersistenceError("database_unavailable");
        return {
          state: row.state,
          activationGeneration: row.activation_generation,
          globalReferenceEpoch: row.global_reference_epoch,
          version: row.version,
          ...(row.activated_at === null ? {} : { activatedAt: row.activated_at }),
        };
      }),
    });
  }

  activate(input: {
    correlationId: string;
    osActor: string;
  }): Promise<{
    activationGeneration: number;
    globalReferenceEpoch: number;
    serviceCount: number;
  }> {
    return this.owner.execute({
      run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
        const result = activateRuntimeSnapshots(transaction, this.#uuid);
        return {
          value: result,
          auditInput: {
            actor: {
              type: "local_cli" as const,
              label: "host-local operator",
              authenticationMethod: "host_terminal",
            },
            action: "runtime.activate_v2",
            result: "allow" as const,
            target: {
              type: "runtime_activation",
              label: "persisted runtime authority",
            },
            justification: "Activate published v2 database configuration as MCP authority.",
            changes: [
              { field: "state", before: "inactive", after: "active" },
              {
                field: "activation_generation",
                after: result.activationGeneration,
              },
              { field: "service_count", after: result.serviceCount },
            ],
            correlationId: input.correlationId,
            source: {
              category: "runtime_activation",
              client: "runtime-activate-v2-cli",
              osActor: input.osActor,
            },
          },
        };
      }),
    });
  }
}

function selector(
  query: Pick<PersistenceQuery, "all">,
  table: "service_principal_assignments"
    | "credential_principal_assignments"
    | "policy_rule_principal_assignments",
  parentColumn: "service_id" | "credential_id" | "rule_id",
  parentId: string,
): RuntimeSelector | undefined {
  const rows = query.all<{
    selector_kind: "all" | "group" | "user";
    group_id: string | null;
    user_id: string | null;
  }>(`
    SELECT selector_kind, group_id, user_id
    FROM ${table}
    WHERE ${parentColumn} = ?
    ORDER BY selector_kind, coalesce(group_id, user_id), id
  `, [parentId]);
  if (rows.some(({ selector_kind }) => selector_kind === "all")) {
    return { kind: "all", groupIds: [], userIds: [] };
  }
  const groupIds = rows.filter(({ selector_kind }) => selector_kind === "group")
    .map(({ group_id }) => group_id!);
  const userIds = rows.filter(({ selector_kind }) => selector_kind === "user")
    .map(({ user_id }) => user_id!);
  if (groupIds.length + userIds.length === 0) return undefined;
  return { kind: "explicit", groupIds, userIds };
}

function pruneRuntimeSnapshots(
  transaction: PersistenceTransaction,
  serviceId: string,
): void {
  transaction.run(`
    DELETE FROM runtime_service_snapshots
    WHERE service_id = ? AND id NOT IN (
      SELECT snapshot_id FROM runtime_active_services WHERE service_id = ?
    ) AND id NOT IN (
      SELECT id FROM runtime_service_snapshots
      WHERE service_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 100
    )
  `, [serviceId, serviceId, serviceId]);
}

function parseObject(json: string): Record<string, unknown> {
  try {
    return asObject(JSON.parse(json));
  } catch {
    throw new PersistenceError("database_unavailable");
  }
}

function parseJson(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    throw new PersistenceError("database_unavailable");
  }
}

function parseArray<T = unknown>(json: string): T[] {
  const value = parseJson(json);
  if (!Array.isArray(value)) throw new PersistenceError("database_unavailable");
  return value as T[];
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new PersistenceError("database_unavailable");
  }
  return value as Record<string, unknown>;
}

function objectField(value: Record<string, unknown>, key: string) {
  return asObject(value[key]);
}

function arrayField(value: Record<string, unknown>, key: string): unknown[] {
  return unknownArray(value[key]);
}

function unknownArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new PersistenceError("database_unavailable");
  return value;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new PersistenceError("database_unavailable");
  }
  return value;
}

function numberArray(value: unknown): number[] {
  if (
    !Array.isArray(value)
    || value.some((entry) => !Number.isSafeInteger(entry))
  ) throw new PersistenceError("database_unavailable");
  return value as number[];
}

function stringField(value: Record<string, unknown>, key: string): string {
  const result = value[key];
  if (typeof result !== "string") throw new PersistenceError("database_unavailable");
  return result;
}

function booleanField(value: Record<string, unknown>, key: string): boolean {
  const result = value[key];
  if (typeof result !== "boolean") throw new PersistenceError("database_unavailable");
  return result;
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new PersistenceError("database_unavailable");
  return value;
}
