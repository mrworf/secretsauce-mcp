import { randomBytes } from "node:crypto";
import type { PersistenceDatabaseOptions } from "../persistence/database.js";
import type {
  PersistenceOwner,
} from "../persistence/worker.js";
import { PersistenceWorker } from "../persistence/worker.js";
import type {
  PersistenceQuery,
  PersistenceTransaction,
} from "../persistence/transaction.js";
import {
  classifyOidcFlowEnvelopePhysicalRoot,
  rewrapOidcFlowEnvelopePhysicalRoot,
  validateOidcFlowEnvelopePhysicalRoot,
  type OidcFlowPurpose,
} from "./oidcFlowEnvelope.js";
import {
  classifyTotpEnvelopePhysicalRoot,
  parseTotpEnvelope,
  rewrapTotpEnvelopePhysicalRoot,
  validateTotpEnvelopePhysicalRoot,
} from "./totp.js";

const ROOT_KEY_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const CURSOR = /^[0-2]:[0-9a-f-]{36}$/;
const TABLE_COLUMNS = {
  local_totp_authenticators: [
    "id",
    "user_id",
    "envelope_json",
    "root_key_id",
    "generation",
    "confirmed_at",
    "version",
    "created_at",
    "updated_at",
  ],
  identity_pending_totp: [
    "restricted_session_id",
    "user_id",
    "authenticator_id",
    "envelope_json",
    "root_key_id",
    "generation",
    "password_policy_version",
    "created_at",
    "expires_at",
  ],
  identity_oidc_flows: [
    "id",
    "provider_id",
    "purpose",
    "state_hash",
    "envelope_json",
    "target_user_id",
    "actor_user_id",
    "actor_session_id",
    "target_version",
    "oauth_intent_id",
    "redirect_uri",
    "created_at",
    "expires_at",
    "claimed_at",
    "consumed_at",
    "version",
  ],
} as const;

type IdentityRootTable = keyof typeof TABLE_COLUMNS;

export interface IdentityRootRewrapInventory {
  totalCount: number;
  oldRootCount: number;
  newRootCount: number;
  tables: Readonly<Record<IdentityRootTable, number>>;
}

export interface IdentityRootRewrapBatch {
  scannedCount: number;
  rewrappedCount: number;
  cursor?: string;
}

export interface IdentityRootRotationMaterialOptions {
  logicalRootKeyId: string;
  oldRoot: Uint8Array;
  newRoot: Uint8Array;
  randomBytes?: (size: number) => Buffer;
  failureInjector?: (
    stage: "before_identity_row_update",
    table: IdentityRootTable,
  ) => void;
}

export interface IdentityRootRotationOptions
  extends PersistenceDatabaseOptions, IdentityRootRotationMaterialOptions {}

interface TotpRow {
  kind: "confirmed" | "pending";
  table: "local_totp_authenticators" | "identity_pending_totp";
  id: string;
  user_id: string;
  envelope_json: string;
  root_key_id: string;
  generation: number;
  version?: number;
  confirmed_at?: number;
  authenticator_id?: string;
  password_policy_version?: number;
  created_at: number;
  expires_at?: number;
  updated_at?: number;
}

interface OidcRow {
  kind: "oidc";
  table: "identity_oidc_flows";
  id: string;
  provider_id: string;
  purpose: OidcFlowPurpose;
  state_hash: string;
  envelope_json: string;
  target_user_id: string | null;
  actor_user_id: string | null;
  actor_session_id: string | null;
  target_version: number | null;
  oauth_intent_id: string | null;
  redirect_uri: string;
  created_at: number;
  expires_at: number;
  claimed_at: number | null;
  consumed_at: number | null;
  version: number;
}

type IdentityRootRow = TotpRow | OidcRow;

export class IdentityRootRotationAdapter {
  readonly #owner: PersistenceOwner;
  readonly #logicalRootKeyId: string;
  readonly #oldRoot: Buffer;
  readonly #newRoot: Buffer;
  readonly #randomBytes: (size: number) => Buffer;
  readonly #failureInjector?: IdentityRootRotationOptions["failureInjector"];
  #closed = false;

  private constructor(
    owner: PersistenceOwner,
    options: IdentityRootRotationMaterialOptions,
  ) {
    this.#owner = owner;
    this.#logicalRootKeyId = options.logicalRootKeyId;
    this.#oldRoot = Buffer.from(options.oldRoot);
    this.#newRoot = Buffer.from(options.newRoot);
    this.#randomBytes = options.randomBytes ?? randomBytes;
    if (options.failureInjector !== undefined) {
      this.#failureInjector = options.failureInjector;
    }
  }

  static open(options: IdentityRootRotationOptions): IdentityRootRotationAdapter {
    validateOptions(options);
    const owner = PersistenceWorker.open(options);
    return new IdentityRootRotationAdapter(owner, options);
  }

  static attach(
    owner: PersistenceOwner,
    options: IdentityRootRotationMaterialOptions,
  ): IdentityRootRotationAdapter {
    validateOptions(options);
    return new IdentityRootRotationAdapter(owner, options);
  }

  async preflight(): Promise<IdentityRootRewrapInventory> {
    this.#assertOpen();
    await this.#owner.execute({
      run: (database) => database.read((query) => validateClosedSchema(query)),
    });
    return this.inventory();
  }

  async inventory(): Promise<IdentityRootRewrapInventory> {
    this.#assertOpen();
    return this.#owner.execute({
      run: (database) => database.read((query) => {
        validateClosedSchema(query);
        const rows = readIdentityRows(query, undefined, Number.MAX_SAFE_INTEGER);
        const tables: Record<IdentityRootTable, number> = {
          local_totp_authenticators: 0,
          identity_pending_totp: 0,
          identity_oidc_flows: 0,
        };
        const inventory: IdentityRootRewrapInventory = {
          totalCount: 0,
          oldRootCount: 0,
          newRootCount: 0,
          tables,
        };
        for (const row of rows) {
          const classification = this.#classify(row);
          inventory.totalCount += 1;
          tables[row.table] += 1;
          if (classification === "old") inventory.oldRootCount += 1;
          else inventory.newRootCount += 1;
        }
        return inventory;
      }),
    });
  }

  async rewrapBatch(
    cursor: string | undefined,
    limit: number,
  ): Promise<IdentityRootRewrapBatch> {
    this.#assertOpen();
    if (
      (cursor !== undefined && !CURSOR.test(cursor))
      || !Number.isInteger(limit)
      || limit < 1
      || limit > 1_000
    ) throw new Error("Identity root rotation input is invalid.");
    return this.#owner.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        validateClosedSchema(transaction);
        const rows = readIdentityRows(transaction, cursor, limit + 1);
        const selected = rows.slice(0, limit);
        let rewrappedCount = 0;
        for (const row of selected) {
          if (this.#classify(row) === "new") continue;
          this.#failureInjector?.("before_identity_row_update", row.table);
          this.#rewrapRow(transaction, row);
          rewrappedCount += 1;
        }
        const last = selected.at(-1);
        return {
          scannedCount: selected.length,
          rewrappedCount,
          ...(rows.length > selected.length && last !== undefined
            ? { cursor: cursorFor(last) }
            : {}),
        };
      }),
    });
  }

  async verifyZero(): Promise<IdentityRootRewrapInventory> {
    const inventory = await this.inventory();
    if (inventory.oldRootCount !== 0) {
      throw new Error("Identity root rotation is incomplete.");
    }
    return inventory;
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    try {
      await this.#owner.close();
    } finally {
      this.#oldRoot.fill(0);
      this.#newRoot.fill(0);
    }
  }

  #classify(row: IdentityRootRow): "old" | "new" {
    if (row.kind === "oidc") {
      return classifyOidcFlowEnvelopePhysicalRoot(
        row.envelope_json,
        {
          flowId: row.id,
          providerId: row.provider_id,
          purpose: row.purpose,
        },
        this.#logicalRootKeyId,
        this.#oldRoot,
        this.#newRoot,
      );
    }
    const envelope = parseTotpEnvelope(JSON.parse(row.envelope_json));
    if (
      row.root_key_id !== this.#logicalRootKeyId
      || envelope.rootKeyId !== row.root_key_id
      || envelope.generation !== row.generation
    ) throw new Error("Identity root envelope is invalid.");
    return classifyTotpEnvelopePhysicalRoot(
      envelope,
      this.#logicalRootKeyId,
      this.#oldRoot,
      this.#newRoot,
    );
  }

  #rewrapRow(
    transaction: PersistenceTransaction,
    row: IdentityRootRow,
  ): void {
    if (row.kind === "oidc") {
      const envelope = rewrapOidcFlowEnvelopePhysicalRoot(
        row.envelope_json,
        {
          flowId: row.id,
          providerId: row.provider_id,
          purpose: row.purpose,
        },
        this.#logicalRootKeyId,
        this.#oldRoot,
        this.#newRoot,
        this.#randomBytes,
      );
      const result = transaction.run(`
        UPDATE identity_oidc_flows
        SET envelope_json = ?, version = version + 1
        WHERE id = ? AND provider_id = ? AND purpose = ? AND state_hash = ?
          AND envelope_json = ?
          AND target_user_id IS ? AND actor_user_id IS ?
          AND actor_session_id IS ? AND target_version IS ?
          AND oauth_intent_id IS ? AND redirect_uri = ?
          AND created_at = ? AND expires_at = ?
          AND claimed_at IS ? AND consumed_at IS ? AND version = ?
      `, [
        envelope,
        row.id,
        row.provider_id,
        row.purpose,
        row.state_hash,
        row.envelope_json,
        row.target_user_id,
        row.actor_user_id,
        row.actor_session_id,
        row.target_version,
        row.oauth_intent_id,
        row.redirect_uri,
        row.created_at,
        row.expires_at,
        row.claimed_at,
        row.consumed_at,
        row.version,
      ]);
      if (result.changes !== 1) throw new Error("Identity row changed.");
      return;
    }

    const envelope = rewrapTotpEnvelopePhysicalRoot(
      JSON.parse(row.envelope_json),
      this.#logicalRootKeyId,
      this.#oldRoot,
      this.#newRoot,
      this.#randomBytes,
    );
    const envelopeJson = JSON.stringify(envelope);
    if (row.kind === "confirmed") {
      const result = transaction.run(`
        UPDATE local_totp_authenticators
        SET envelope_json = ?, generation = ?, version = version + 1
        WHERE id = ? AND user_id = ? AND envelope_json = ?
          AND root_key_id = ? AND generation = ? AND confirmed_at = ?
          AND version = ? AND created_at = ? AND updated_at = ?
      `, [
        envelopeJson,
        envelope.generation,
        row.id,
        row.user_id,
        row.envelope_json,
        row.root_key_id,
        row.generation,
        row.confirmed_at!,
        row.version!,
        row.created_at,
        row.updated_at!,
      ]);
      if (result.changes !== 1) throw new Error("Identity row changed.");
      return;
    }
    const result = transaction.run(`
      UPDATE identity_pending_totp
      SET envelope_json = ?, generation = ?
      WHERE restricted_session_id = ? AND user_id = ?
        AND authenticator_id = ? AND envelope_json = ?
        AND root_key_id = ? AND generation = ?
        AND password_policy_version = ? AND created_at = ? AND expires_at = ?
    `, [
      envelopeJson,
      envelope.generation,
      row.id,
      row.user_id,
      row.authenticator_id!,
      row.envelope_json,
      row.root_key_id,
      row.generation,
      row.password_policy_version!,
      row.created_at,
      row.expires_at!,
    ]);
    if (result.changes !== 1) throw new Error("Identity row changed.");
  }

  #assertOpen(): void {
    if (this.#closed) throw new Error("Identity root rotation is closed.");
  }
}

export async function preflightIdentityRootStore(
  owner: PersistenceOwner,
  logicalRootKeyId: string,
  oldRoot: Uint8Array,
): Promise<Readonly<Record<IdentityRootTable, number>>> {
  if (!ROOT_KEY_ID.test(logicalRootKeyId) || oldRoot.byteLength !== 32) {
    throw new Error("Identity root rotation configuration is invalid.");
  }
  return owner.execute({
    run: (database) => database.read((query) => {
      validateClosedSchema(query);
      const tables: Record<IdentityRootTable, number> = {
        local_totp_authenticators: 0,
        identity_pending_totp: 0,
        identity_oidc_flows: 0,
      };
      for (const row of readIdentityRows(
        query,
        undefined,
        Number.MAX_SAFE_INTEGER,
      )) {
        if (row.kind === "oidc") {
          validateOidcFlowEnvelopePhysicalRoot(
            row.envelope_json,
            {
              flowId: row.id,
              providerId: row.provider_id,
              purpose: row.purpose,
            },
            logicalRootKeyId,
            oldRoot,
          );
        } else {
          const envelope = parseTotpEnvelope(JSON.parse(row.envelope_json));
          if (
            row.root_key_id !== logicalRootKeyId
            || envelope.rootKeyId !== row.root_key_id
            || envelope.generation !== row.generation
          ) throw new Error("Identity root envelope is invalid.");
          validateTotpEnvelopePhysicalRoot(
            envelope,
            logicalRootKeyId,
            oldRoot,
          );
        }
        tables[row.table] += 1;
      }
      return tables;
    }),
  });
}

function validateOptions(options: IdentityRootRotationMaterialOptions): void {
  if (
    !ROOT_KEY_ID.test(options.logicalRootKeyId)
    || options.oldRoot.byteLength !== 32
    || options.newRoot.byteLength !== 32
    || options.oldRoot.every(
      (byte, index) => byte === options.newRoot[index],
    )
  ) throw new Error("Identity root rotation configuration is invalid.");
}

function validateClosedSchema(query: PersistenceQuery): void {
  for (const [table, expected] of Object.entries(TABLE_COLUMNS)) {
    const actual = query.all<{ name: string }>(
      `PRAGMA table_info("${table}")`,
    ).map((value) => value.name);
    if (
      actual.length !== expected.length
      || actual.some((value, index) => value !== expected[index])
    ) throw new Error("Identity root rotation schema is unsupported.");
  }
}

function readIdentityRows(
  query: PersistenceQuery,
  cursor: string | undefined,
  limit: number,
): IdentityRootRow[] {
  const parsedCursor = cursor === undefined
    ? { table: 0, id: "" }
    : { table: Number(cursor[0]), id: cursor.slice(2) };
  const rows: IdentityRootRow[] = [];
  const remaining = (): number => Math.max(0, limit - rows.length);

  if (parsedCursor.table <= 0 && remaining() > 0) {
    const after = parsedCursor.table === 0 ? parsedCursor.id : "";
    rows.push(...query.all<Omit<TotpRow, "kind" | "table">>(`
      SELECT
        id, user_id, envelope_json, root_key_id, generation, confirmed_at,
        version, created_at, updated_at
      FROM local_totp_authenticators
      WHERE id > ?
      ORDER BY id
      LIMIT ?
    `, [after, remaining()]).map((row) => ({
      ...row,
      kind: "confirmed" as const,
      table: "local_totp_authenticators" as const,
    })));
  }
  if (parsedCursor.table <= 1 && remaining() > 0) {
    const after = parsedCursor.table === 1 ? parsedCursor.id : "";
    rows.push(...query.all<{
      id: string;
      user_id: string;
      authenticator_id: string;
      envelope_json: string;
      root_key_id: string;
      generation: number;
      password_policy_version: number;
      created_at: number;
      expires_at: number;
    }>(`
      SELECT
        restricted_session_id AS id, user_id, authenticator_id,
        envelope_json, root_key_id, generation, password_policy_version,
        created_at, expires_at
      FROM identity_pending_totp
      WHERE restricted_session_id > ?
      ORDER BY restricted_session_id
      LIMIT ?
    `, [after, remaining()]).map((row) => ({
      ...row,
      kind: "pending" as const,
      table: "identity_pending_totp" as const,
    })));
  }
  if (parsedCursor.table <= 2 && remaining() > 0) {
    const after = parsedCursor.table === 2 ? parsedCursor.id : "";
    rows.push(...query.all<Omit<OidcRow, "kind" | "table">>(`
      SELECT
        id, provider_id, purpose, state_hash, envelope_json,
        target_user_id, actor_user_id, actor_session_id, target_version,
        oauth_intent_id, redirect_uri, created_at, expires_at,
        claimed_at, consumed_at, version
      FROM identity_oidc_flows
      WHERE id > ?
      ORDER BY id
      LIMIT ?
    `, [after, remaining()]).map((row) => ({
      ...row,
      kind: "oidc" as const,
      table: "identity_oidc_flows" as const,
    })));
  }
  return rows;
}

function cursorFor(row: IdentityRootRow): string {
  const table = row.table === "local_totp_authenticators"
    ? 0
    : row.table === "identity_pending_totp"
    ? 1
    : 2;
  return `${table}:${row.id}`;
}
