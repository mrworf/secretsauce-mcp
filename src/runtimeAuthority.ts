import { credentialUsageHint } from "./credentialUsage.js";
import { GatewayError } from "./errors.js";
import { isUuidV7 } from "./persistence/uuidV7.js";
import type { PersistenceOwner } from "./persistence/worker.js";
import {
  GATEWAY_ACCESS_ID,
  GATEWAY_ACCESS_USAGE_HINT,
  type ServicePolicyDescription,
  type ServiceSummary,
} from "./registry.js";
import type {
  RuntimeSelector,
  RuntimeServiceSnapshot,
} from "./runtimeSnapshots.js";
import type { AuthContext, CredentialUsageConfig } from "./types.js";
import type { TokenRequestInput } from "./tokens.js";
import type { TokenRecord } from "./tokens.js";

const MAX_ACTIVE_SERVICES = 1_000;

interface RuntimeSubject {
  id: string;
  securityEpoch: number;
  groupIds: string[];
}

export interface PersistedRuntimeServiceView {
  snapshot: RuntimeServiceSnapshot;
  subject: RuntimeSubject;
}

export interface RuntimeReferenceGrant {
  service: string;
  serviceId: string;
  destination: string;
  destinationId: string;
  snapshotId: string;
  publicationGeneration: number;
  serviceAuthorizationGeneration: number;
  subjectSecurityEpoch: number;
  globalReferenceEpoch: number;
  accesses: Array<{
    id: string;
    kind: "credential" | "service";
    usageHint: string;
    credentialId?: string;
    credentialAuthorizationGeneration?: number;
  }>;
}

export interface RuntimeAuthority {
  readiness(): Promise<{
    activation: "ready" | "inactive" | "unavailable";
    serviceCount: number;
  }>;
  listServices(auth: AuthContext): Promise<ServiceSummary[]>;
  describeServicePolicy(
    auth: AuthContext,
    service: string,
  ): Promise<ServicePolicyDescription>;
  serviceView(
    auth: AuthContext,
    service: string,
  ): Promise<PersistedRuntimeServiceView>;
  authorizeReferences(
    auth: AuthContext,
    input: TokenRequestInput,
  ): Promise<RuntimeReferenceGrant>;
  validateReferences(
    auth: AuthContext,
    service: string,
    destination: string,
    records: readonly TokenRecord[],
  ): Promise<PersistedRuntimeServiceView>;
}

export class PersistedRuntimeAuthority implements RuntimeAuthority {
  constructor(
    private readonly owner: PersistenceOwner,
    private readonly beforeRead?: () => Promise<unknown>,
  ) {}

  async readiness(): Promise<{
    activation: "ready" | "inactive" | "unavailable";
    serviceCount: number;
  }> {
    try {
      return await this.owner.execute({
        run: (database) => database.read((query) => {
          const activation = query.get<{ state: string }>(
            "SELECT state FROM runtime_activation WHERE singleton = 1",
          );
          const serviceCount = query.get<{ count: number }>(
            "SELECT count(*) AS count FROM runtime_active_services",
          )?.count ?? 0;
          return {
            activation: activation?.state === "active" && serviceCount > 0
              ? "ready" as const
              : "inactive" as const,
            serviceCount,
          };
        }),
      });
    } catch {
      return { activation: "unavailable", serviceCount: 0 };
    }
  }

  async listServices(auth: AuthContext): Promise<ServiceSummary[]> {
    await this.beforeRead?.();
    const result = await this.owner.execute({
      run: (database) => database.read((query) => {
        if (!activationReady(query.get<{ state: string }>(
          "SELECT state FROM runtime_activation WHERE singleton = 1",
        ))) return { error: "config_error" as const };
        const subject = runtimeSubject(query, auth);
        if (subject === undefined) return { error: "unauthenticated" as const };
        const rows = query.all<{ document_json: string }>(`
          SELECT snapshots.document_json
          FROM runtime_active_services active
          JOIN runtime_service_snapshots snapshots
            ON snapshots.service_id = active.service_id
            AND snapshots.id = active.snapshot_id
          ORDER BY snapshots.service_id
          LIMIT ?
        `, [MAX_ACTIVE_SERVICES + 1]);
        if (rows.length > MAX_ACTIVE_SERVICES) {
          return { error: "config_error" as const };
        }
        return {
          services: rows.map(({ document_json }) => parseSnapshot(document_json))
            .filter((snapshot) => selectorAllows(
              snapshot.serviceSelector,
              subject,
            ))
            .map((snapshot) => serviceSummary(snapshot, subject)),
        };
      }),
    });
    if ("error" in result) {
      throw runtimeError(result.error);
    }
    return result.services;
  }

  describeServicePolicy(
    auth: AuthContext,
    service: string,
  ): Promise<ServicePolicyDescription> {
    return this.serviceView(auth, service).then(({ snapshot, subject }) =>
      policyDescription(snapshot, subject));
  }

  async serviceView(
    auth: AuthContext,
    service: string,
  ): Promise<PersistedRuntimeServiceView> {
    await this.beforeRead?.();
    const result = await this.owner.execute({
      run: (database) => database.read((query) => {
        if (!activationReady(query.get<{ state: string }>(
          "SELECT state FROM runtime_activation WHERE singleton = 1",
        ))) return { error: "config_error" as const };
        const subject = runtimeSubject(query, auth);
        if (subject === undefined) return { error: "unauthenticated" as const };
        const row = query.get<{ document_json: string }>(`
          SELECT snapshots.document_json
          FROM runtime_active_services active
          JOIN runtime_service_snapshots snapshots
            ON snapshots.service_id = active.service_id
            AND snapshots.id = active.snapshot_id
          WHERE active.service_id = ?
            OR json_extract(snapshots.document_json, '$.service.slug') = ?
          LIMIT 1
        `, [service, service]);
        if (row === undefined) {
          return { error: "unknown_service" as const };
        }
        const snapshot = parseSnapshot(row.document_json);
        if (!selectorAllows(snapshot.serviceSelector, subject)) {
          return { error: "unauthorized_service" as const };
        }
        return { view: { snapshot, subject } };
      }),
    });
    if ("error" in result) throw runtimeError(result.error, service);
    return result.view;
  }

  async authorizeReferences(
    auth: AuthContext,
    input: TokenRequestInput,
  ): Promise<RuntimeReferenceGrant> {
    if (!input.reason.trim()) {
      throw new GatewayError("reference_invalid", "Reference request reason is required.");
    }
    if (input.access_ids.length === 0) {
      throw new GatewayError("unknown_access", "At least one access id is required.");
    }
    const { snapshot, subject } = await this.serviceView(auth, input.service);
    const destination = runtimeDestination(snapshot, input.destination);
    const state = await this.owner.execute({
      run: (database) => database.read((query) => query.get<{
        state: string;
        global_reference_epoch: number;
      }>("SELECT state, global_reference_epoch FROM runtime_activation WHERE singleton = 1")),
    });
    if (state?.state !== "active") throw runtimeError("config_error");
    const accesses = input.access_ids.map((accessId) => {
      if (snapshot.credentials.length === 0) {
        if (accessId !== GATEWAY_ACCESS_ID) {
          throw new GatewayError("unknown_access", `Unknown access id: ${accessId}`);
        }
        return {
          id: accessId,
          kind: "service" as const,
          usageHint: GATEWAY_ACCESS_USAGE_HINT,
        };
      }
      const credential = snapshot.credentials.find(({ id }) => id === accessId);
      if (credential === undefined) {
        throw new GatewayError("unknown_access", `Unknown access id: ${accessId}`);
      }
      if (
        credential.status !== "configured"
        || credential.locator === undefined
        || credential.generation === undefined
        || !selectorAllows(credential.selector, subject)
      ) {
        throw new GatewayError(
          "unknown_access",
          `Access is unavailable: ${accessId}`,
        );
      }
      return {
        id: credential.id,
        kind: "credential" as const,
        credentialId: credential.id,
        credentialAuthorizationGeneration: credential.authorizationGeneration,
        usageHint: credentialUsageHint(runtimeCredentialUsage(credential)),
      };
    });
    return {
      service: snapshot.service.slug,
      serviceId: snapshot.service.id,
      destination: destination.slug,
      destinationId: destination.id,
      snapshotId: snapshot.id,
      publicationGeneration: snapshot.service.publicationGeneration,
      serviceAuthorizationGeneration: snapshot.serviceAuthorizationGeneration,
      subjectSecurityEpoch: subject.securityEpoch,
      globalReferenceEpoch: state.global_reference_epoch,
      accesses,
    };
  }

  async validateReferences(
    auth: AuthContext,
    service: string,
    destination: string,
    records: readonly TokenRecord[],
  ): Promise<PersistedRuntimeServiceView> {
    const view = await this.serviceView(auth, service);
    const selectedDestination = runtimeDestination(view.snapshot, destination);
    const state = await this.owner.execute({
      run: (database) => database.read((query) => query.get<{
        state: string;
        global_reference_epoch: number;
      }>("SELECT state, global_reference_epoch FROM runtime_activation WHERE singleton = 1")),
    });
    if (state?.state !== "active") throw runtimeError("config_error");
    for (const record of records) {
      if (
        record.subject !== view.subject.id
        || record.service !== view.snapshot.service.slug
        || record.serviceId !== view.snapshot.service.id
        || record.destination !== selectedDestination.slug
        || record.destinationId !== selectedDestination.id
        || record.snapshotId !== view.snapshot.id
        || record.publicationGeneration
          !== view.snapshot.service.publicationGeneration
        || record.serviceAuthorizationGeneration
          !== view.snapshot.serviceAuthorizationGeneration
        || record.subjectSecurityEpoch !== view.subject.securityEpoch
        || record.globalReferenceEpoch !== state.global_reference_epoch
      ) {
        throw new GatewayError(
          "reference_invalid",
          "Gateway reference is stale or has different authorization bindings.",
        );
      }
      if (record.kind === "credential") {
        const credential = view.snapshot.credentials.find(
          ({ id }) => id === record.credentialId,
        );
        if (
          credential === undefined
          || credential.status !== "configured"
          || credential.locator === undefined
          || credential.generation === undefined
          || !selectorAllows(credential.selector, view.subject)
          || credential.authorizationGeneration
            !== record.credentialAuthorizationGeneration
        ) {
          throw new GatewayError(
            "reference_invalid",
            "Gateway credential reference is no longer authorized.",
          );
        }
      }
    }
    return view;
  }
}

function runtimeSubject(
  query: {
    get<T>(sql: string, parameters?: readonly unknown[]): T | undefined;
    all<T>(sql: string, parameters?: readonly unknown[]): T[];
  },
  auth: AuthContext,
): RuntimeSubject | undefined {
  if (!isUuidV7(auth.subject)) {
    return undefined;
  }
  const user = query.get<{
    id: string;
    role: string;
    status: string;
    security_epoch: number;
  }>("SELECT id, role, status, security_epoch FROM users WHERE id = ?", [
    auth.subject,
  ]);
  if (user === undefined || user.status !== "active" || user.role !== "user") {
    return undefined;
  }
  return {
    id: user.id,
    securityEpoch: user.security_epoch,
    groupIds: query.all<{ group_id: string }>(`
      SELECT members.group_id
      FROM service_group_members members
      JOIN service_groups groups
        ON groups.id = members.group_id
        AND groups.service_id = members.service_id
      WHERE members.user_id = ? AND groups.lifecycle = 'active'
      ORDER BY members.group_id
    `, [user.id]).map(({ group_id }) => group_id),
  };
}

function activationReady(row: { state: string } | undefined): boolean {
  return row?.state === "active";
}

function runtimeError(
  code: "config_error" | "unauthenticated" | "unknown_service" | "unauthorized_service",
  service?: string,
): GatewayError {
  if (code === "config_error") {
    return new GatewayError("config_error", "Persisted runtime is not ready.");
  }
  if (code === "unauthenticated") {
    return new GatewayError("unauthenticated", "Active user identity is required.");
  }
  if (code === "unknown_service") {
    return new GatewayError("unknown_service", `Unknown service: ${service ?? ""}`);
  }
  return new GatewayError(
    "unauthorized_service",
    `Not authorized for service: ${service ?? ""}`,
  );
}

function parseSnapshot(json: string): RuntimeServiceSnapshot {
  try {
    const value = JSON.parse(json) as RuntimeServiceSnapshot;
    if (
      value.formatVersion !== 1
      || !isUuidV7(value.id)
      || !isUuidV7(value.service.id)
      || !Array.isArray(value.destinations)
      || !Array.isArray(value.credentials)
      || !Array.isArray(value.policies)
    ) {
      throw new Error("invalid");
    }
    return value;
  } catch {
    throw new GatewayError("config_error", "Persisted runtime snapshot is invalid.");
  }
}

function selectorAllows(
  selector: RuntimeSelector | undefined,
  subject: RuntimeSubject,
): boolean {
  if (selector === undefined) return false;
  if (selector.kind === "all") return true;
  if (selector.userIds.includes(subject.id)) return true;
  const groups = new Set(subject.groupIds);
  return selector.groupIds.some((groupId) => groups.has(groupId));
}

function serviceSummary(
  snapshot: RuntimeServiceSnapshot,
  subject: RuntimeSubject,
): ServiceSummary {
  const summary: ServiceSummary = {
    id: snapshot.service.slug,
    name: snapshot.service.name,
    destinations: snapshot.destinations.map((destination) => ({
      id: destination.slug,
      base_url_hint: destination.baseUrl,
      tls_verify: destination.tlsVerify,
    })),
    access_methods: accessMethods(snapshot, subject),
    policy_summary: `mode=${servicePolicy(snapshot)?.mode ?? "deny"}`,
  };
  return {
    ...summary,
    ...(snapshot.service.description === undefined
      ? {}
      : { description: snapshot.service.description }),
    ...(snapshot.service.documentationUrl === undefined
      ? {}
      : { api_docs_url: snapshot.service.documentationUrl }),
  };
}

function policyDescription(
  snapshot: RuntimeServiceSnapshot,
  subject: RuntimeSubject,
): ServicePolicyDescription {
  const policy = servicePolicy(snapshot);
  return {
    id: snapshot.service.slug,
    name: snapshot.service.name,
    ...(snapshot.service.description === undefined
      ? {}
      : { description: snapshot.service.description }),
    ...(snapshot.service.documentationUrl === undefined
      ? {}
      : { api_docs_url: snapshot.service.documentationUrl }),
    destinations: snapshot.destinations.map((destination) => ({
      id: destination.slug,
      base_url_hint: destination.baseUrl,
      tls_verify: destination.tlsVerify,
    })),
    access_methods: accessMethods(snapshot, subject),
    policy: {
      mode: policy?.mode ?? "deny",
      rules: (policy?.rules ?? [])
        .filter((rule) => rule.enabled && selectorAllows(rule.selector, subject))
        .map((rule) => ({
          id: rule.id,
          effect: rule.effect,
          priority: rule.priority,
          methods: [...rule.methods],
          hosts: matcherStrings(rule.hosts),
          paths: matcherStrings(rule.paths),
          binary_response: binarySafeguard(rule.responseSafeguards),
          ...(rule.reason === undefined ? {} : { reason: rule.reason }),
        })),
    },
  };
}

function servicePolicy(snapshot: RuntimeServiceSnapshot) {
  return snapshot.policies.find((policy) => policy.credentialId === undefined);
}

function accessMethods(
  snapshot: RuntimeServiceSnapshot,
  subject: RuntimeSubject,
): ServiceSummary["access_methods"] {
  if (snapshot.credentials.length === 0) {
    return [{ id: GATEWAY_ACCESS_ID, usage_hint: GATEWAY_ACCESS_USAGE_HINT }];
  }
  return snapshot.credentials
    .filter((credential) =>
      credential.status === "configured"
      && selectorAllows(credential.selector, subject))
    .map((credential) => ({
      id: credential.id,
      usage_hint: credentialUsageHint(runtimeCredentialUsage(credential)),
    }));
}

function runtimeCredentialUsage(
  credential: RuntimeServiceSnapshot["credentials"][number],
): CredentialUsageConfig {
  return {
    kind: credential.usage.kind,
    name: credential.usage.name,
    ...(credential.usage.prefix === undefined
      ? {}
      : { prefix: credential.usage.prefix }),
    ...(credential.usage.suffix === undefined
      ? {}
      : { suffix: credential.usage.suffix }),
    enforce: credential.usage.enforceHeaderOwnership,
  };
}

function runtimeDestination(
  snapshot: RuntimeServiceSnapshot,
  requested: string | undefined,
): RuntimeServiceSnapshot["destinations"][number] {
  if (requested !== undefined) {
    const destination = snapshot.destinations.find(
      ({ id, slug }) => id === requested || slug === requested,
    );
    if (destination === undefined) {
      throw new GatewayError(
        "unknown_destination",
        `Unknown destination: ${requested}`,
      );
    }
    return destination;
  }
  if (snapshot.destinations.length === 1) {
    return snapshot.destinations[0]!;
  }
  throw new GatewayError(
    "unknown_destination",
    "destination is required when a service has multiple destinations",
  );
}

function matcherStrings(matchers: unknown[]): string[] {
  return matchers.map((matcher) => {
    if (typeof matcher === "string") return matcher;
    if (matcher && typeof matcher === "object") {
      const value = (matcher as { value?: unknown }).value;
      if (typeof value === "string") return value;
    }
    throw new GatewayError("config_error", "Persisted policy matcher is invalid.");
  });
}

function binarySafeguard(value: unknown): {
  scan: boolean;
  max_size_bytes: number | null;
} {
  if (value && typeof value === "object") {
    const binary = (value as {
      binaryResponse?: { scan?: unknown; maxBytes?: unknown };
    }).binaryResponse;
    if (
      binary
      && typeof binary.scan === "boolean"
      && (binary.maxBytes === null || typeof binary.maxBytes === "number")
    ) {
      return {
        scan: binary.scan,
        max_size_bytes: binary.maxBytes as number | null,
      };
    }
  }
  return { scan: true, max_size_bytes: null };
}
