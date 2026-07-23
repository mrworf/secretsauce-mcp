import { createHash, createHmac, randomBytes } from "node:crypto";
import type { AdministrativeAuditEventInput } from "../persistence/administrativeAudit.js";
import { PersistenceError } from "../persistence/errors.js";
import type { PersistenceOwner } from "../persistence/worker.js";
import type { PersistenceTransaction } from "../persistence/transaction.js";
import { UuidV7Generator, isUuidV7 } from "../persistence/uuidV7.js";
import type { IdentityConfig, OidcProviderConfig } from "../types.js";
import {
  decryptOidcFlowSecrets,
  encryptOidcFlowSecrets,
  type OidcFlowPurpose,
} from "./oidcFlowEnvelope.js";
import { OidcTrustClient } from "./oidcTrust.js";
import type { ProviderAssertion } from "./provider.js";
import type { IdentityKeyRing } from "./totp.js";
import type { AlwaysStepUpHandle, StepUpRepository } from "./stepUp.js";

const STATE_DOMAIN = "secretsauce.identity.oidc-state.v1";
const OPAQUE = /^[A-Za-z0-9_-]{43}$/;

interface OidcFlowRow {
  id: string;
  provider_id: string;
  purpose: OidcFlowPurpose;
  envelope_json: string;
  target_user_id: string | null;
  actor_user_id: string | null;
  actor_session_id: string | null;
  target_version: number | null;
  redirect_uri: string;
  expires_at: number;
}

export interface OidcFlowBinding {
  purpose: OidcFlowPurpose;
  targetUserId?: string;
  actorUserId?: string;
  actorSessionId?: string;
  targetVersion?: number;
}

export interface OidcAuthorizationStart {
  authorizationUrl: string;
  expiresAt: number;
}

export class OidcFlowError extends Error {
  constructor() {
    super("OIDC authentication failed.");
    this.name = "OidcFlowError";
  }
}

export class OidcFlowRepository {
  constructor(
    private readonly owner: PersistenceOwner,
    private readonly now: () => number = Date.now,
    private readonly stepUps?: StepUpRepository,
  ) {}

  async create(input: {
    id: string;
    providerId: string;
    purpose: OidcFlowPurpose;
    stateHash: string;
    envelopeJson: string;
    redirectUri: string;
    expiresAt: number;
    maxRecords: number;
    binding: OidcFlowBinding;
    stepUp?: {
      proof: AlwaysStepUpHandle;
      audit: AdministrativeAuditEventInput;
    };
  }): Promise<void> {
    try {
      if (input.stepUp !== undefined) {
        if (this.stepUps === undefined) throw new PersistenceError("authentication_failed");
        await this.stepUps.withConsumedProof(
          input.stepUp.proof,
          input.stepUp.audit,
          (transaction) => this.insert(transaction, input),
        );
      } else {
        await this.owner.execute({
          run: (database) => database.withOperationalTransaction((transaction) => {
            this.insert(transaction, input);
          }),
        });
      }
    } catch {
      throw new OidcFlowError();
    }
  }

  private insert(
    transaction: PersistenceTransaction,
    input: Parameters<OidcFlowRepository["create"]>[0],
  ): void {
    const now = safeNow(this.now);
    transaction.run("DELETE FROM identity_oidc_flows WHERE expires_at <= ?", [now]);
    const count = transaction.get<{ count: number }>(
      "SELECT count(*) AS count FROM identity_oidc_flows",
    )?.count ?? input.maxRecords;
    if (count >= input.maxRecords) throw new PersistenceError("database_unavailable");
    transaction.run(`
      INSERT INTO identity_oidc_flows (
        id, provider_id, purpose, state_hash, envelope_json,
        target_user_id, actor_user_id, actor_session_id, target_version,
        redirect_uri, created_at, expires_at, claimed_at, consumed_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 1)
    `, [
      input.id,
      input.providerId,
      input.purpose,
      input.stateHash,
      input.envelopeJson,
      input.binding.targetUserId ?? null,
      input.binding.actorUserId ?? null,
      input.binding.actorSessionId ?? null,
      input.binding.targetVersion ?? null,
      input.redirectUri,
      now,
      input.expiresAt,
    ]);
  }

  async claim(providerId: string, stateHash: string): Promise<OidcFlowRow> {
    try {
      return await this.owner.execute({
        run: (database) => database.withOperationalTransaction((transaction) => {
          const now = safeNow(this.now);
          const row = transaction.get<OidcFlowRow>(`
            SELECT
              id, provider_id, purpose, envelope_json, target_user_id,
              actor_user_id, actor_session_id, target_version, redirect_uri,
              expires_at
            FROM identity_oidc_flows
            WHERE provider_id = ? AND state_hash = ?
              AND claimed_at IS NULL AND consumed_at IS NULL AND expires_at > ?
          `, [providerId, stateHash, now]);
          if (row === undefined) throw new PersistenceError("authentication_failed");
          const claimed = transaction.run(`
            UPDATE identity_oidc_flows
            SET claimed_at = ?, version = version + 1
            WHERE id = ? AND claimed_at IS NULL AND consumed_at IS NULL
          `, [now, row.id]);
          if (claimed.changes !== 1) throw new PersistenceError("authentication_failed");
          return row;
        }),
      });
    } catch {
      throw new OidcFlowError();
    }
  }

  async complete(flow: OidcFlowRow, correlationId: string): Promise<void> {
    try {
      await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          const now = safeNow(this.now);
          const completed = transaction.run(`
            UPDATE identity_oidc_flows
            SET consumed_at = ?, version = version + 1
            WHERE id = ? AND claimed_at IS NOT NULL AND consumed_at IS NULL
          `, [now, flow.id]);
          if (completed.changes !== 1) throw new PersistenceError("authentication_failed");
          return {
            value: undefined,
            auditInput: {
              actor: {
                type: "system",
                label: "external identity assertion",
                authenticationMethod: "oidc",
              },
              action: "identity.oidc_assertion",
              result: "allow",
              target: {
                type: "authentication",
                label: `oidc:${flow.provider_id}`,
              },
              changes: [{ field: "assertion", after: "verified" }],
              correlationId,
              source: { category: "authentication" },
            } satisfies AdministrativeAuditEventInput,
          };
        }),
      });
    } catch {
      throw new OidcFlowError();
    }
  }

  async recordDenied(correlationId: string): Promise<void> {
    await this.owner.execute({
      run: (database) => {
        database.appendAdministrativeAudit({
          actor: {
            type: "system",
            label: "anonymous OIDC callback",
            authenticationMethod: "oidc",
          },
          action: "identity.oidc_assertion",
          result: "deny",
          target: { type: "authentication", label: "external identity" },
          correlationId,
          source: { category: "authentication" },
          failureCode: "authentication.invalid",
        } satisfies AdministrativeAuditEventInput);
      },
    });
  }
}

export class OidcFlowService {
  readonly #providers: Record<string, OidcProviderConfig>;
  readonly #stateKey: Buffer;
  readonly #random: (size: number) => Buffer;
  readonly #uuid: () => string;
  readonly #now: () => number;

  constructor(
    private readonly repository: OidcFlowRepository,
    private readonly trust: OidcTrustClient,
    private readonly keyRing: IdentityKeyRing,
    config: NonNullable<IdentityConfig["oidc"]>,
    stateKey: Buffer,
    options: {
      random?: (size: number) => Buffer;
      uuid?: () => string;
      now?: () => number;
    } = {},
  ) {
    if (stateKey.byteLength !== 32) throw new Error("Invalid OIDC state key.");
    this.#providers = config.providers;
    this.#stateKey = Buffer.from(stateKey);
    this.#random = options.random ?? randomBytes;
    this.#now = options.now ?? Date.now;
    const generator = new UuidV7Generator({ now: this.#now });
    this.#uuid = options.uuid ?? (() => generator.next());
    this.config = config;
  }

  private readonly config: NonNullable<IdentityConfig["oidc"]>;

  async begin(
    providerId: string,
    binding: OidcFlowBinding,
    stepUp?: {
      proof: AlwaysStepUpHandle;
      audit: AdministrativeAuditEventInput;
    },
  ): Promise<OidcAuthorizationStart> {
    const provider = this.provider(providerId);
    validateBinding(binding);
    const discovery = await this.trust.discover(provider);
    const flowId = this.nextUuid();
    const state = opaque(this.#random);
    const nonce = opaque(this.#random);
    const verifier = opaque(this.#random);
    const redirectUri = callbackUri(provider);
    const expiresAt = safeNow(this.#now) + this.config.flowTtlMs;
    const envelopeJson = encryptOidcFlowSecrets({
      flowId,
      providerId,
      purpose: binding.purpose,
      secrets: { nonce, verifier },
      keyRing: this.keyRing,
      random: this.#random,
    });
    await this.repository.create({
      id: flowId,
      providerId,
      purpose: binding.purpose,
      stateHash: stateHash(this.#stateKey, state),
      envelopeJson,
      redirectUri,
      expiresAt,
      maxRecords: this.config.maxFlowRecords,
      binding,
      ...(stepUp === undefined ? {} : { stepUp }),
    });
    const authorization = new URL(discovery.authorizationEndpoint);
    authorization.searchParams.set("response_type", "code");
    authorization.searchParams.set("client_id", provider.clientId);
    authorization.searchParams.set("redirect_uri", redirectUri);
    authorization.searchParams.set("scope", provider.scopes.join(" "));
    authorization.searchParams.set("state", state);
    authorization.searchParams.set("nonce", nonce);
    authorization.searchParams.set(
      "code_challenge",
      createHash("sha256").update(verifier, "ascii").digest("base64url"),
    );
    authorization.searchParams.set("code_challenge_method", "S256");
    return { authorizationUrl: authorization.toString(), expiresAt };
  }

  async callback(
    providerId: string,
    state: string,
    code: string,
    correlationId: string,
  ): Promise<{ assertion: ProviderAssertion; binding: OidcFlowBinding }> {
    try {
      if (!OPAQUE.test(state) || correlationId.length < 1 || correlationId.length > 128) {
        throw new OidcFlowError();
      }
      const provider = this.provider(providerId);
      const flow = await this.repository.claim(providerId, stateHash(this.#stateKey, state));
      const secrets = decryptOidcFlowSecrets(flow.envelope_json, this.keyRing, {
        flowId: flow.id,
        providerId: flow.provider_id,
        purpose: flow.purpose,
      });
      const token = await this.trust.exchangeCode(
        provider,
        code,
        secrets.verifier,
        flow.redirect_uri,
      );
      const assertion = await this.trust.verifyIdToken(provider, token, secrets.nonce);
      await this.repository.complete(flow, correlationId);
      return {
        assertion,
        binding: {
          purpose: flow.purpose,
          ...(flow.target_user_id === null ? {} : { targetUserId: flow.target_user_id }),
          ...(flow.actor_user_id === null ? {} : { actorUserId: flow.actor_user_id }),
          ...(flow.actor_session_id === null ? {} : { actorSessionId: flow.actor_session_id }),
          ...(flow.target_version === null ? {} : { targetVersion: flow.target_version }),
        },
      };
    } catch {
      try {
        await this.repository.recordDenied(correlationId);
      } catch {
        // Authentication failures remain uniform even when best-effort denial auditing is unavailable.
      }
      throw new OidcFlowError();
    }
  }

  async deny(correlationId: string): Promise<void> {
    try {
      await this.repository.recordDenied(correlationId);
    } catch {
      // Public authentication failures remain uniform when auditing is unavailable.
    }
  }

  close(): void {
    this.#stateKey.fill(0);
  }

  private provider(providerId: string): OidcProviderConfig {
    if (!/^[a-z][a-z0-9_.-]{0,63}$/.test(providerId)) throw new OidcFlowError();
    const provider = this.#providers[providerId];
    if (provider === undefined) throw new OidcFlowError();
    return provider;
  }

  private nextUuid(): string {
    const id = this.#uuid();
    if (!isUuidV7(id)) throw new OidcFlowError();
    return id;
  }
}

function validateBinding(binding: OidcFlowBinding): void {
  if (
    (binding.targetUserId !== undefined && !isUuidV7(binding.targetUserId)) ||
    (binding.actorUserId !== undefined && !isUuidV7(binding.actorUserId)) ||
    (binding.actorSessionId !== undefined && !isUuidV7(binding.actorSessionId)) ||
    (binding.targetVersion !== undefined &&
      (!Number.isSafeInteger(binding.targetVersion) || binding.targetVersion < 1)) ||
    (binding.purpose === "login" &&
      (binding.targetUserId !== undefined ||
        binding.actorUserId !== undefined ||
        binding.actorSessionId !== undefined ||
        binding.targetVersion !== undefined))
  ) throw new OidcFlowError();
}

function callbackUri(provider: OidcProviderConfig): string {
  return `${provider.redirectOrigin}/api/v2/auth/oidc/${provider.id}/callback`;
}

function opaque(random: (size: number) => Buffer): string {
  const value = random(32);
  if (value.byteLength !== 32) throw new OidcFlowError();
  return value.toString("base64url");
}

function stateHash(key: Buffer, state: string): string {
  return createHmac("sha256", key).update(STATE_DOMAIN).update("\0").update(state).digest("hex");
}

function safeNow(now: () => number): number {
  const value = Math.trunc(now());
  if (!Number.isSafeInteger(value) || value < 0) throw new PersistenceError("database_unavailable");
  return value;
}
