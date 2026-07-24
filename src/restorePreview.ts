import { createHash } from "node:crypto";
import type { ControlAuthenticationContext } from "./control/authentication.js";
import type { PersistenceQuery } from "./persistence/transaction.js";
import type { PersistenceOwner } from "./persistence/worker.js";
import {
  decodeRestoreArchive,
  type DecodedRestoreArchive,
} from "./restoreArchive.js";
import {
  RestoreStagingError,
  RestoreStageCoordinator,
} from "./restoreStaging.js";
import {
  RestoreStateError,
  RestoreStateRepository,
  type RestoreCounts,
  type RestorePreview,
  type RestoreSecretDisposition,
  type RestoreStage,
} from "./restoreState.js";
import {
  type BackupCapabilityInput,
  VaultBackupCapabilityIssuer,
} from "./vault/capabilities.js";
import { canonicalJson } from "./vault/canonicalJson.js";
import type { BackupVaultClient } from "./vault/client.js";
import {
  canonicalizeVaultBackupSelection,
  digestVaultBackupSelection,
} from "./vault/backupSelection.js";
import { VaultRemoteError } from "./vault/client.js";
import { UuidV7Generator } from "./persistence/uuidV7.js";

const DIGEST_DOMAIN = "secretsauce:restore-plan:v1:";

export class RestorePreviewError extends Error {
  constructor(
    readonly code:
      | "invalid"
      | "forbidden"
      | "not_found"
      | "expired"
      | "conflict"
      | "unavailable",
  ) {
    super(code);
    this.name = "RestorePreviewError";
  }
}

export interface RestorePreviewVault {
  validateRestore(
    capability: string,
    passphrase: Uint8Array,
    archive: Uint8Array,
    selection: readonly {
      serviceId: string;
      destinationId: string;
      credentialId: string;
      locator: string;
      generation: number;
    }[],
  ): Promise<{ validated: true; recordCount: number }>;
}

interface CurrentRestoreSummary {
  ids: {
    services: string[];
    destinations: string[];
    credentials: string[];
    policies: string[];
    rules: string[];
  };
  revokedApiKeys: number;
  revokedSessions: number;
  revokedOauthGrants: number;
}

export interface EvaluatedRestorePlan {
  stageId: string;
  archiveSha256: string;
  planDigest: string;
  secretDisposition: RestoreSecretDisposition;
  counts: RestoreCounts;
  decoded: DecodedRestoreArchive;
}

export class RestorePreviewCoordinator {
  readonly #uuid: UuidV7Generator;

  constructor(
    private readonly owner: PersistenceOwner,
    private readonly stages: RestoreStageCoordinator,
    private readonly repository: RestoreStateRepository,
    private readonly vault?: RestorePreviewVault,
    private readonly capabilityIssuer?: Pick<VaultBackupCapabilityIssuer, "issueBackup">,
    now: () => number = Date.now,
  ) {
    this.#uuid = new UuidV7Generator({ now });
  }

  async preview(input: {
    actor: ControlAuthenticationContext;
    stageId: string;
    passphrase?: Uint8Array;
  }): Promise<RestorePreview> {
    return this.withEvaluatedPlan(input, async (plan) =>
      this.repository.createPreview({
        stageId: plan.stageId,
        subjectUserId: input.actor.principalId,
        archiveSha256: plan.archiveSha256,
        planDigest: plan.planDigest,
        secretDisposition: plan.secretDisposition,
        counts: plan.counts,
      }));
  }

  async status(
    actor: ControlAuthenticationContext,
    stageId: string,
  ): Promise<{ stage: RestoreStage; preview?: RestorePreview }> {
    if (
      actor.method !== "browser_session"
      || actor.role !== "superadmin"
    ) throw new RestorePreviewError("forbidden");
    try {
      const stage = await this.stages.status(actor, stageId);
      const preview = await this.repository.latestPreviewForStage(
        stageId,
        actor.principalId,
      );
      return {
        stage,
        ...(preview === undefined ? {} : { preview }),
      };
    } catch (error) {
      if (error instanceof RestorePreviewError) throw error;
      if (error instanceof RestoreStagingError) {
        throw new RestorePreviewError(error.code);
      }
      if (error instanceof RestoreStateError) {
        throw new RestorePreviewError(error.restoreCode);
      }
      throw new RestorePreviewError("unavailable");
    }
  }

  async withEvaluatedPlan<T>(
    input: {
      actor: ControlAuthenticationContext;
      stageId: string;
      passphrase?: Uint8Array;
    },
    use: (plan: EvaluatedRestorePlan) => T | Promise<T>,
  ): Promise<T> {
    if (
      input.actor.method !== "browser_session"
      || input.actor.role !== "superadmin"
    ) {
      wipe(input.passphrase);
      throw new RestorePreviewError("forbidden");
    }
    let archive: Buffer | undefined;
    let secrets: Buffer | undefined;
    let delegated = false;
    try {
      if (
        input.passphrase !== undefined
        && (
          !(input.passphrase instanceof Uint8Array)
          || input.passphrase.byteLength < 12
          || input.passphrase.byteLength > 1_024
        )
      ) throw new RestorePreviewError("invalid");
      const active = await this.owner.execute({
        run: (database) => database.read((query) =>
          query.get<{ active: number }>(`
            SELECT count(*) AS active FROM users
            WHERE role = 'superadmin' AND status = 'active'
          `)?.active ?? 0),
      });
      if (active < 1) throw new RestorePreviewError("conflict");

      const staged = await this.stages.read(input.actor, input.stageId);
      archive = staged.archive;
      const decoded = decodeRestoreArchive(archive);
      secrets = decoded.secrets;
      if (
        decoded.archiveId !== staged.stage.archiveId
        || decoded.archiveSha256 !== staged.stage.archiveSha256
      ) throw new RestorePreviewError("conflict");

      const secretDisposition = await this.secretDisposition(
        input.actor,
        staged.stage.id,
        decoded,
        input.passphrase,
      );
      const current = await this.owner.execute({
        run: (database) => database.read(loadCurrentSummary),
      });
      const counts = restoreCounts(decoded, current, secretDisposition);
      const planDigest = digestPlan({
        actorId: input.actor.principalId,
        stageId: staged.stage.id,
        archiveSha256: staged.stage.archiveSha256,
        expiresAt: staged.stage.expiresAt,
        decoded,
        secretDisposition,
        counts,
      });
      delegated = true;
      return await use({
        stageId: staged.stage.id,
        archiveSha256: staged.stage.archiveSha256,
        planDigest,
        secretDisposition,
        counts,
        decoded,
      });
    } catch (error) {
      if (delegated) throw error;
      if (error instanceof RestorePreviewError) throw error;
      if (error instanceof RestoreStagingError) {
        throw new RestorePreviewError(error.code);
      }
      if (error instanceof RestoreStateError) {
        throw new RestorePreviewError(error.restoreCode);
      }
      throw new RestorePreviewError("unavailable");
    } finally {
      archive?.fill(0);
      secrets?.fill(0);
      wipe(input.passphrase);
    }
  }

  private async secretDisposition(
    actor: ControlAuthenticationContext,
    stageId: string,
    decoded: DecodedRestoreArchive,
    passphrase?: Uint8Array,
  ): Promise<RestoreSecretDisposition> {
    if (
      decoded.secrets === undefined
      || decoded.secretSelection.length === 0
      || passphrase === undefined
    ) return "configuration_only";
    if (this.vault === undefined || this.capabilityIssuer === undefined) {
      throw new RestorePreviewError("unavailable");
    }
    const selection = canonicalizeVaultBackupSelection(decoded.secretSelection);
    const planBinding = createHash("sha256")
      .update("secretsauce:restore-validation:v1:")
      .update(stageId)
      .update(decoded.archiveSha256)
      .update(actor.principalId)
      .digest("hex");
    const capabilityInput: BackupCapabilityInput = {
      operation: "validate_restore",
      authorizationId: this.#uuid.next(),
      subjectId: actor.principalId,
      operationDigest: digestVaultBackupSelection(selection),
      restorePlanId: this.#uuid.next(),
      archiveSha256: decoded.archiveSha256,
      planDigest: planBinding,
    };
    try {
      const result = await this.vault.validateRestore(
        this.capabilityIssuer.issueBackup(capabilityInput),
        passphrase,
        decoded.secrets,
        selection,
      );
      if (result.recordCount !== selection.length) {
        throw new RestorePreviewError("unavailable");
      }
      return "encrypted_secrets";
    } catch (error) {
      if (
        error instanceof VaultRemoteError
        && error.code === "vault_archive_authentication_failed"
      ) return "configuration_only";
      throw error;
    }
  }
}

function loadCurrentSummary(query: PersistenceQuery): CurrentRestoreSummary {
  const ids = {
    services: idsFrom(query, "services"),
    destinations: idsFrom(query, "service_destinations"),
    credentials: idsFrom(query, "service_credentials"),
    policies: idsFrom(query, "policies"),
    rules: idsFrom(query, "policy_rules"),
  };
  return {
    ids,
    revokedApiKeys: count(query, "api_keys", "status = 'active'"),
    revokedSessions: count(query, "browser_sessions", "revoked_at IS NULL"),
    revokedOauthGrants: count(query, "oauth_grants", "status = 'active'"),
  };
}

function idsFrom(query: PersistenceQuery, table: string): string[] {
  return query.all<{ id: string }>(
    `SELECT id FROM ${table} ORDER BY id LIMIT 100001`,
  ).map((row) => row.id);
}

function count(
  query: PersistenceQuery,
  table: string,
  predicate: string,
): number {
  return query.get<{ total: number }>(
    `SELECT count(*) AS total FROM ${table} WHERE ${predicate}`,
  )?.total ?? 0;
}

function restoreCounts(
  decoded: DecodedRestoreArchive,
  current: CurrentRestoreSummary,
  disposition: RestoreSecretDisposition,
): RestoreCounts {
  const incoming = {
    services: decoded.services.map((entry) => entry.id),
    destinations: decoded.services.flatMap((entry) =>
      entry.destinations.map((destination) => destination.id)),
    credentials: decoded.credentials.map((entry) => entry.id),
    policies: decoded.policies.map((entry) => entry.id),
    rules: decoded.policies.flatMap((entry) =>
      entry.rules.map((rule) => rule.id)),
  };
  let replacements = 0;
  let removals = 0;
  for (const key of Object.keys(incoming) as (keyof typeof incoming)[]) {
    const next = new Set(incoming[key]);
    replacements += current.ids[key].filter((id) => next.has(id)).length;
    removals += current.ids[key].filter((id) => !next.has(id)).length;
  }
  const availableSecrets = disposition === "encrypted_secrets"
    ? decoded.secretSelection.length
    : 0;
  const unavailableSecrets = decoded.secretSelection.length - availableSecrets;
  const servicesWithUnavailableSecrets = new Set(
    decoded.secretSelection
      .filter((entry) =>
        disposition !== "encrypted_secrets")
      .map((entry) => entry.serviceId),
  ).size;
  return {
    services: decoded.counts.services,
    destinations: decoded.counts.destinations,
    credentials: decoded.counts.credentials,
    policies: decoded.counts.policies,
    rules: decoded.counts.rules,
    availableSecrets,
    unavailableSecrets,
    replacements,
    removals,
    revokedApiKeys: current.revokedApiKeys,
    revokedSessions: current.revokedSessions,
    revokedOauthGrants: current.revokedOauthGrants,
    remediations: decoded.counts.services * 3
      + decoded.counts.policies
      + unavailableSecrets
      + servicesWithUnavailableSecrets,
  };
}

function digestPlan(input: {
  actorId: string;
  stageId: string;
  archiveSha256: string;
  expiresAt: number;
  decoded: DecodedRestoreArchive;
  secretDisposition: RestoreSecretDisposition;
  counts: RestoreCounts;
}): string {
  return createHash("sha256")
    .update(DIGEST_DOMAIN)
    .update(canonicalJson({
      actorId: input.actorId,
      stageId: input.stageId,
      archiveSha256: input.archiveSha256,
      expiresAt: input.expiresAt,
      services: input.decoded.services,
      credentials: input.decoded.credentials,
      policies: input.decoded.policies,
      secretDisposition: input.secretDisposition,
      secretCredentialIds: input.secretDisposition === "encrypted_secrets"
        ? input.decoded.secretSelection.map((entry) => entry.credentialId).sort()
        : [],
      counts: input.counts,
    }))
    .digest("hex");
}

function wipe(value?: Uint8Array): void {
  value?.fill(0);
}

export type ProductionRestorePreviewVault = Pick<
  BackupVaultClient,
  "validateRestore"
>;
