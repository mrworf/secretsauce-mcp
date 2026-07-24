import { createHash } from "node:crypto";
import { canonicalControlJson } from "./control/idempotency.js";
import {
  normalizeCredentialPlacement,
  type CredentialPlacement,
} from "./credentialPlacement.js";
import { isUuidV7, UuidV7Generator } from "./persistence/uuidV7.js";
import {
  normalizeManagedPolicyMatchers,
  type ManagedPolicyMatchers,
} from "./policyMatchers.js";
import { SECRET_RULE_IDS } from "./secretlintConfig.js";
import {
  canonicalServiceDraft,
  normalizeServiceDestination,
  normalizeServiceProfile,
  SERVICE_SLUG,
  type ServiceDestinationInput,
  type ServiceDraftDocument,
  type ServiceProfileInput,
} from "./serviceConfiguration.js";
import type {
  V1MigrationService,
  V1MigrationSource,
} from "./v1MigrationSource.js";

export type V1MigrationPlanErrorCode =
  | "invalid_source"
  | "unsafe_destination"
  | "unsupported_placement"
  | "unsafe_policy"
  | "duplicate_name"
  | "id_map_invalid"
  | "slug_collision";

export class V1MigrationPlanError extends Error {
  constructor(readonly code: V1MigrationPlanErrorCode) {
    super("V1 migration plan could not be created.");
    this.name = "V1MigrationPlanError";
  }
}

export interface V1MigrationIdMapEntry {
  serviceId: string;
  policyId: string;
  destinationIds: string[];
  credentialIds: string[];
  ruleIds: string[];
}

export type V1MigrationIdMap = Record<string, V1MigrationIdMapEntry>;

export interface V1MigrationCredentialPlan {
  id: string;
  name: string;
  normalizedName: string;
  placement: CredentialPlacement;
  source:
    | { kind: "env"; name: string }
    | { kind: "file"; path: string };
  status: "unconfigured";
}

export interface V1MigrationRulePlan {
  id: string;
  name: string;
  normalizedName: string;
  reason?: string;
  effect: "allow" | "deny";
  priority: number;
  enabled: false;
  matchers: ManagedPolicyMatchers;
  responseSafeguards: {
    secretlint: { enabled: boolean; disabledRuleIds: string[] };
    binaryResponse: { scan: boolean; maxBytes: number | null };
  };
}

export interface V1MigrationServicePlan {
  id: string;
  sourceKey: string;
  lifecycle: "draft";
  profile: ServiceProfileInput;
  draft: ServiceDraftDocument;
  credentials: V1MigrationCredentialPlan[];
  policy: {
    id: string;
    name: "Migrated service policy";
    normalizedName: "migrated service policy";
    operatingMode: "allow" | "deny";
    lifecycle: "active";
    rules: V1MigrationRulePlan[];
  };
}

export interface V1MigrationReport {
  formatVersion: 1;
  sourceSchemaVersion: 1;
  sourceSha256: string;
  planDigest: string;
  resolutionMode: "metadata_only" | "allowlisted";
  counts: {
    services: number;
    destinations: number;
    credentials: number;
    policies: number;
    rules: number;
    configuredCredentials: number;
    unconfiguredCredentials: number;
    discardedAclEntries: number;
    retainedServiceSlugs: number;
    generatedServiceSlugs: number;
  };
  services: Array<{ id: string; slug: string }>;
  warningCounts: Record<string, number>;
  outcome: "planned";
}

export interface V1MigrationPlan {
  sourceSchemaVersion: 1;
  sourceSha256: string;
  resolutionMode: "metadata_only";
  idMap: V1MigrationIdMap;
  services: V1MigrationServicePlan[];
  digest: string;
  report: V1MigrationReport;
}

export function createV1MigrationPlan(
  source: V1MigrationSource,
  options: {
    uuid?: () => string;
    idMap?: V1MigrationIdMap;
  } = {},
): V1MigrationPlan {
  if (
    source.schemaVersion !== 1
    || !/^[a-f0-9]{64}$/.test(source.sha256)
    || !Number.isSafeInteger(source.discardedAclEntryCount)
    || source.discardedAclEntryCount < 0
  ) fail("invalid_source");

  const sourceKeys = Object.keys(source.services).sort();
  const uuid = options.uuid ?? defaultUuid();
  const idMap = options.idMap === undefined
    ? generateIdMap(sourceKeys, source.services, uuid)
    : validateIdMap(sourceKeys, source.services, options.idMap);
  const occupiedServiceSlugs = new Set<string>();
  let retainedServiceSlugs = 0;
  let generatedServiceSlugs = 0;

  const services = sourceKeys.map((sourceKey) => {
    const service = source.services[sourceKey]!;
    const ids = idMap[sourceKey]!;
    const retained = SERVICE_SLUG.test(sourceKey) && !occupiedServiceSlugs.has(sourceKey);
    const slug = retained
      ? sourceKey
      : generatedSlug("migrated", sourceKey, occupiedServiceSlugs);
    occupiedServiceSlugs.add(slug);
    if (retained) retainedServiceSlugs += 1;
    else generatedServiceSlugs += 1;
    return convertService(sourceKey, slug, service, ids);
  });

  const digest = migrationPlanDigest({
    sourceSchemaVersion: source.schemaVersion,
    sourceSha256: source.sha256,
    discardedAclEntryCount: source.discardedAclEntryCount,
    services,
  });
  const counts = {
    services: services.length,
    destinations: sum(services, (service) => service.draft.destinations.length),
    credentials: sum(services, (service) => service.credentials.length),
    policies: services.length,
    rules: sum(services, (service) => service.policy.rules.length),
    configuredCredentials: 0 as const,
    unconfiguredCredentials: sum(services, (service) => service.credentials.length),
    discardedAclEntries: source.discardedAclEntryCount,
    retainedServiceSlugs,
    generatedServiceSlugs,
  };
  const report: V1MigrationReport = {
    formatVersion: 1,
    sourceSchemaVersion: 1,
    sourceSha256: source.sha256,
    planDigest: digest,
    resolutionMode: "metadata_only",
    counts,
    services: services.map((service) => ({
      id: service.id,
      slug: service.profile.slug,
    })),
    warningCounts: counts.unconfiguredCredentials === 0
      ? {}
      : { credential_unconfigured: counts.unconfiguredCredentials },
    outcome: "planned",
  };
  return {
    sourceSchemaVersion: 1,
    sourceSha256: source.sha256,
    resolutionMode: "metadata_only",
    idMap,
    services,
    digest,
    report,
  };
}

export function validateV1MigrationPlan(plan: V1MigrationPlan): boolean {
  try {
    if (
      plan.sourceSchemaVersion !== 1
      || plan.resolutionMode !== "metadata_only"
      || !/^[a-f0-9]{64}$/.test(plan.sourceSha256)
      || plan.report.resolutionMode !== "metadata_only"
      || plan.report.sourceSha256 !== plan.sourceSha256
      || plan.report.sourceSchemaVersion !== 1
      || plan.report.planDigest !== plan.digest
    ) return false;
    const counts = {
      services: plan.services.length,
      destinations: sum(plan.services, (service) => service.draft.destinations.length),
      credentials: sum(plan.services, (service) => service.credentials.length),
      policies: plan.services.length,
      rules: sum(plan.services, (service) => service.policy.rules.length),
    };
    if (
      counts.services !== plan.report.counts.services
      || counts.destinations !== plan.report.counts.destinations
      || counts.credentials !== plan.report.counts.credentials
      || counts.policies !== plan.report.counts.policies
      || counts.rules !== plan.report.counts.rules
      || plan.report.counts.configuredCredentials !== 0
      || plan.report.counts.unconfiguredCredentials !== counts.credentials
      || plan.report.counts.retainedServiceSlugs
        + plan.report.counts.generatedServiceSlugs !== counts.services
      || !Number.isSafeInteger(plan.report.counts.discardedAclEntries)
      || plan.report.counts.discardedAclEntries < 0
    ) return false;
    const seen = new Set<string>();
    for (const service of plan.services) {
      const canonical = canonicalServiceDraft(service.draft);
      if (
        !isUuidV7(service.id)
        || seen.has(service.id)
        || service.lifecycle !== "draft"
        || canonicalControlJson(canonical.document) !== canonicalControlJson(service.draft)
        || canonicalControlJson(service.profile) !== canonicalControlJson(service.draft.service)
        || service.policy.name !== "Migrated service policy"
        || service.policy.normalizedName !== "migrated service policy"
        || service.policy.lifecycle !== "active"
        || !isUuidV7(service.policy.id)
        || seen.has(service.policy.id)
      ) return false;
      seen.add(service.id);
      seen.add(service.policy.id);
      for (const destination of service.draft.destinations) {
        if (!isUuidV7(destination.id) || seen.has(destination.id)) return false;
        seen.add(destination.id);
      }
      for (const credential of service.credentials) {
        if (
          !isUuidV7(credential.id)
          || seen.has(credential.id)
          || credential.status !== "unconfigured"
        ) return false;
        seen.add(credential.id);
      }
      for (const rule of service.policy.rules) {
        if (
          !isUuidV7(rule.id)
          || seen.has(rule.id)
          || rule.enabled !== false
        ) return false;
        seen.add(rule.id);
      }
    }
    return plan.digest === migrationPlanDigest({
      sourceSchemaVersion: 1,
      sourceSha256: plan.sourceSha256,
      discardedAclEntryCount: plan.report.counts.discardedAclEntries,
      services: plan.services,
    });
  } catch {
    return false;
  }
}

function generateIdMap(
  sourceKeys: string[],
  services: Record<string, V1MigrationService>,
  uuid: () => string,
): V1MigrationIdMap {
  const map: V1MigrationIdMap = {};
  const seen = new Set<string>();
  const next = (): string => {
    const id = uuid();
    if (!isUuidV7(id) || seen.has(id)) fail("id_map_invalid");
    seen.add(id);
    return id;
  };
  for (const sourceKey of sourceKeys) {
    const service = services[sourceKey]!;
    map[sourceKey] = {
      serviceId: next(),
      destinationIds: service.destinations.map(() => next()),
      credentialIds: service.credentials.map(() => next()),
      policyId: next(),
      ruleIds: service.policy.rules.map(() => next()),
    };
  }
  return map;
}

function validateIdMap(
  sourceKeys: string[],
  services: Record<string, V1MigrationService>,
  input: V1MigrationIdMap,
): V1MigrationIdMap {
  const actualKeys = Object.keys(input).sort();
  if (
    actualKeys.length !== sourceKeys.length
    || actualKeys.some((key, index) => key !== sourceKeys[index])
  ) fail("id_map_invalid");
  const seen = new Set<string>();
  for (const sourceKey of sourceKeys) {
    const service = services[sourceKey]!;
    const ids = input[sourceKey];
    if (
      ids === undefined
      || ids.destinationIds.length !== service.destinations.length
      || ids.credentialIds.length !== service.credentials.length
      || ids.ruleIds.length !== service.policy.rules.length
    ) fail("id_map_invalid");
    for (const id of [
      ids.serviceId,
      ...ids.destinationIds,
      ...ids.credentialIds,
      ids.policyId,
      ...ids.ruleIds,
    ]) {
      if (!isUuidV7(id) || seen.has(id)) fail("id_map_invalid");
      seen.add(id);
    }
  }
  return cloneIdMap(input);
}

function convertService(
  sourceKey: string,
  slug: string,
  source: V1MigrationService,
  ids: V1MigrationIdMapEntry,
): V1MigrationServicePlan {
  let profile: ServiceProfileInput;
  try {
    profile = normalizeServiceProfile({
      slug,
      name: source.name,
      ...(source.description === undefined ? {} : { description: source.description }),
      ...(source.api_docs_url === undefined ? {} : { documentationUrl: source.api_docs_url }),
    });
  } catch {
    fail("invalid_source");
  }
  const destinationSlugs = new Set<string>();
  const destinations = source.destinations.map((destination, index) => {
    const candidate = destination.id ?? destination.name;
    const slug = candidate !== undefined
      && SERVICE_SLUG.test(candidate)
      && !destinationSlugs.has(candidate)
      ? candidate
      : generatedSlug(
          `destination-${index + 1}`,
          `${sourceKey}\0${candidate ?? ""}\0${index}`,
          destinationSlugs,
        );
    destinationSlugs.add(slug);
    let parsed: URL;
    try {
      parsed = new URL(destination.base_url);
    } catch {
      fail("unsafe_destination");
    }
    const scheme = parsed.protocol.slice(0, -1);
    if (scheme !== "http" && scheme !== "https") fail("unsafe_destination");
    const hosts: ServiceDestinationInput["hosts"] = (destination.hosts ?? [
      { exact: parsed.hostname },
    ]).map((matcher) => {
      if ("exact" in matcher) return { type: "exact" as const, value: matcher.exact };
      if ("suffix" in matcher) return { type: "suffix" as const, value: matcher.suffix };
      return { type: "regex" as const, value: matcher.regex };
    });
    try {
      const normalized = normalizeServiceDestination({
        slug,
        baseUrl: destination.base_url,
        schemes: (destination.schemes ?? [scheme]) as Array<"http" | "https">,
        hosts,
        ports: destination.ports ?? [
          Number(parsed.port || (scheme === "https" ? 443 : 80)),
        ],
        tlsVerify: destination.tls?.verify ?? source.tls?.verify ?? true,
      });
      return {
        id: ids.destinationIds[index]!,
        slug: normalized.slug,
        baseUrl: normalized.baseUrl,
        schemes: normalized.schemes,
        hosts: normalized.hosts,
        ports: normalized.ports,
        tlsVerify: normalized.tlsVerify,
      };
    } catch {
      fail("unsafe_destination");
    }
  });

  let draft: ServiceDraftDocument;
  try {
    draft = canonicalServiceDraft({
      formatVersion: 1,
      service: profile,
      destinations,
    }).document;
  } catch {
    fail("unsafe_destination");
  }

  const credentialNames = new Set<string>();
  const credentials = source.credentials.map((credential, index) => {
    const named = normalizedName(credential.id);
    if (credentialNames.has(named.normalizedName)) fail("duplicate_name");
    credentialNames.add(named.normalizedName);
    let placement: CredentialPlacement;
    try {
      placement = normalizeCredentialPlacement({
        kind: credential.usage.kind.toLowerCase(),
        ...(credential.usage.name === undefined ? {} : { name: credential.usage.name }),
        ...(credential.usage.prefix === undefined ? {} : { prefix: credential.usage.prefix }),
        ...(credential.usage.suffix === undefined ? {} : { suffix: credential.usage.suffix }),
        enforce_header_ownership: credential.usage.enforce ?? false,
      });
    } catch {
      fail("unsupported_placement");
    }
    return {
      id: ids.credentialIds[index]!,
      ...named,
      placement,
      source: { ...credential.source },
      status: "unconfigured" as const,
    };
  });

  const ruleNames = new Set<string>();
  const rules = source.policy.rules.map((rule, index): V1MigrationRulePlan => {
    const named = normalizedName(rule.id);
    if (ruleNames.has(named.normalizedName)) fail("duplicate_name");
    ruleNames.add(named.normalizedName);
    let matchers: ManagedPolicyMatchers;
    try {
      matchers = normalizeManagedPolicyMatchers({
        methods: rule.methods,
        hosts: rule.hosts.map((value) => ({ kind: "regex" as const, value })),
        paths: rule.paths.map((value) => ({ kind: "regex" as const, value })),
      });
    } catch {
      fail("unsafe_policy");
    }
    return {
      id: ids.ruleIds[index]!,
      ...named,
      ...(rule.reason === undefined ? {} : { reason: normalizedDescription(rule.reason) }),
      effect: rule.effect,
      priority: rule.priority,
      enabled: false,
      matchers,
      responseSafeguards: responseSafeguards(rule),
    };
  });
  return {
    id: ids.serviceId,
    sourceKey,
    lifecycle: "draft",
    profile,
    draft,
    credentials,
    policy: {
      id: ids.policyId,
      name: "Migrated service policy",
      normalizedName: "migrated service policy",
      operatingMode: source.policy.mode,
      lifecycle: "active",
      rules,
    },
  };
}

function responseSafeguards(
  rule: V1MigrationService["policy"]["rules"][number],
): V1MigrationRulePlan["responseSafeguards"] {
  let secretlint: V1MigrationRulePlan["responseSafeguards"]["secretlint"];
  if (rule.secretlint === undefined) {
    secretlint = { enabled: true, disabledRuleIds: [] };
  } else if ("enabled" in rule.secretlint) {
    secretlint = { enabled: false, disabledRuleIds: [] };
  } else {
    const ids = [...rule.secretlint.disabled_rules];
    if (
      new Set(ids).size !== ids.length
      || ids.some((id) => !(SECRET_RULE_IDS as readonly string[]).includes(id))
    ) fail("unsafe_policy");
    secretlint = { enabled: true, disabledRuleIds: ids.sort() };
  }
  const maxSize = rule.binary_response?.max_size ?? "100kb";
  let maxBytes: number | null;
  if (maxSize === "unlimited") {
    maxBytes = null;
  } else {
    const match = /^(\d+)(b|kb|mb)$/i.exec(maxSize);
    if (match === null) fail("unsafe_policy");
    const amount = Number(match[1]);
    const multiplier = match[2]!.toLowerCase() === "mb"
      ? 1024 * 1024
      : match[2]!.toLowerCase() === "kb"
        ? 1024
        : 1;
    maxBytes = amount * multiplier;
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 100 * 1024 * 1024) {
      fail("unsafe_policy");
    }
  }
  return {
    secretlint,
    binaryResponse: {
      scan: rule.binary_response?.scan ?? true,
      maxBytes,
    },
  };
}

function normalizedName(value: string): { name: string; normalizedName: string } {
  const name = value.normalize("NFKC").trim();
  const normalizedName = name.toLocaleLowerCase("und");
  if (
    name.length < 1
    || name.length > 120
    || normalizedName.length > 120
    || /[\u0000-\u001f\u007f]/u.test(name)
  ) fail("invalid_source");
  return { name, normalizedName };
}

function normalizedDescription(value: string): string {
  const description = value.normalize("NFKC").trim();
  if (description.length < 1 || description.length > 1_024 || description.includes("\0")) {
    fail("invalid_source");
  }
  return description;
}

function generatedSlug(prefix: string, source: string, occupied: Set<string>): string {
  const digest = createHash("sha256")
    .update("secretsauce-v1-migration-slug-v1\0")
    .update(prefix)
    .update("\0")
    .update(source)
    .digest("hex");
  for (let length = 12; length <= digest.length; length += 1) {
    const slug = `${prefix}-${digest.slice(0, length)}`;
    if (slug.length > 64) break;
    if (!occupied.has(slug)) return slug;
  }
  fail("slug_collision");
}

function projectForDigest(service: V1MigrationServicePlan): unknown {
  return {
    id: service.id,
    lifecycle: service.lifecycle,
    profile: service.profile,
    draft: service.draft,
    credentials: service.credentials.map(({ source: _source, ...credential }) => credential),
    policy: service.policy,
  };
}

function migrationPlanDigest(input: {
  sourceSchemaVersion: 1;
  sourceSha256: string;
  discardedAclEntryCount: number;
  services: V1MigrationServicePlan[];
}): string {
  return createHash("sha256")
    .update("secretsauce-v1-migration-plan-v1\0")
    .update(canonicalControlJson({
      formatVersion: 1,
      sourceSchemaVersion: input.sourceSchemaVersion,
      sourceSha256: input.sourceSha256,
      resolutionMode: "metadata_only",
      discardedAclEntryCount: input.discardedAclEntryCount,
      services: input.services.map(projectForDigest),
    }))
    .digest("hex");
}

function cloneIdMap(input: V1MigrationIdMap): V1MigrationIdMap {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, {
    serviceId: value.serviceId,
    policyId: value.policyId,
    destinationIds: [...value.destinationIds],
    credentialIds: [...value.credentialIds],
    ruleIds: [...value.ruleIds],
  }]));
}

function defaultUuid(): () => string {
  const generator = new UuidV7Generator();
  return () => generator.next();
}

function sum<T>(values: T[], count: (value: T) => number): number {
  return values.reduce((total, value) => total + count(value), 0);
}

function fail(code: V1MigrationPlanErrorCode): never {
  throw new V1MigrationPlanError(code);
}
