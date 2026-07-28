import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  decryptOidcFlowSecrets,
  encryptOidcFlowSecrets,
} from "../src/identity/oidcFlowEnvelope.js";
import {
  IdentityRootRotationAdapter,
} from "../src/identity/rootRotation.js";
import {
  beginTotpEnrollment,
  decryptTotpSeed,
  IdentityKeyRing,
} from "../src/identity/totp.js";
import { PersistenceWorker } from "../src/persistence/worker.js";

const NOW = 1_800_000_000_000;
const USER_ID = "018f1f2e-7b3c-7a10-8000-000000000001";
const CONFIRMED_ID = "018f1f2e-7b3c-7a10-8000-000000000002";
const SESSION_ID = "018f1f2e-7b3c-7a10-8000-000000000003";
const PENDING_ID = "018f1f2e-7b3c-7a10-8000-000000000004";
const FLOW_ID = "018f1f2e-7b3c-7a10-8000-000000000005";
const oldRoot = Buffer.alloc(32, 41);
const newRoot = Buffer.alloc(32, 42);

describe("identity root rotation adapter", () => {
  it("rewraps every closed identity envelope store in bounded batches", async () => {
    const file = databasePath("all-stores");
    const original = await seedIdentityEnvelopes(file);
    const adapter = openAdapter(file);
    try {
      expect(await adapter.preflight()).toEqual({
        totalCount: 3,
        oldRootCount: 3,
        newRootCount: 0,
        tables: {
          local_totp_authenticators: 1,
          identity_pending_totp: 1,
          identity_oidc_flows: 1,
        },
      });
      expect(() => openWorker(file)).toThrowError(expect.objectContaining({
        code: "database_unavailable",
      }));

      const first = await adapter.rewrapBatch(undefined, 2);
      expect(first).toEqual({
        scannedCount: 2,
        rewrappedCount: 2,
        cursor: `1:${SESSION_ID}`,
      });
      expect(await adapter.inventory()).toMatchObject({
        totalCount: 3,
        oldRootCount: 1,
        newRootCount: 2,
      });
      expect(await adapter.rewrapBatch(first.cursor, 2)).toEqual({
        scannedCount: 1,
        rewrappedCount: 1,
      });
      expect(await adapter.verifyZero()).toMatchObject({
        totalCount: 3,
        oldRootCount: 0,
        newRootCount: 3,
      });
      expect(await adapter.rewrapBatch(undefined, 10)).toEqual({
        scannedCount: 3,
        rewrappedCount: 0,
      });
    } finally {
      await adapter.close();
    }

    const worker = openWorker(file);
    try {
      const rows = await snapshot(worker);
      expect(rows.confirmed.generation).toBe(2);
      expect(rows.confirmed.version).toBe(2);
      expect(rows.confirmed.updated_at).toBe(NOW);
      expect(rows.pending.generation).toBe(2);
      expect(rows.oidc.version).toBe(2);
      expect(rows.confirmed.root_key_id).toBe("root");
      expect(rows.pending.root_key_id).toBe("root");

      const ring = new IdentityKeyRing("root", { root: newRoot });
      const confirmedSeed = decryptTotpSeed(
        JSON.parse(rows.confirmed.envelope_json),
        ring,
      );
      const pendingSeed = decryptTotpSeed(
        JSON.parse(rows.pending.envelope_json),
        ring,
      );
      expect(confirmedSeed).toEqual(original.confirmedSeed);
      expect(pendingSeed).toEqual(original.pendingSeed);
      expect(decryptOidcFlowSecrets(
        rows.oidc.envelope_json,
        ring,
        { flowId: FLOW_ID, providerId: "workforce", purpose: "login" },
      )).toEqual(original.oidcSecrets);
      confirmedSeed.fill(0);
      pendingSeed.fill(0);
      ring.destroy();
    } finally {
      await worker.close();
      original.confirmedSeed.fill(0);
      original.pendingSeed.fill(0);
    }
  });

  it("rolls back an interrupted multi-row transaction and resumes cleanly", async () => {
    const file = databasePath("rollback");
    await seedIdentityEnvelopes(file);
    const adapter = openAdapter(file, (stage, table) => {
      if (
        stage === "before_identity_row_update"
        && table === "identity_pending_totp"
      ) throw new Error("injected");
    });
    await expect(adapter.rewrapBatch(undefined, 3)).rejects.toMatchObject({
      code: "database_unavailable",
    });
    expect(await adapter.inventory()).toMatchObject({
      oldRootCount: 3,
      newRootCount: 0,
    });
    await adapter.close();

    const resumed = openAdapter(file);
    try {
      expect(await resumed.rewrapBatch(undefined, 3)).toEqual({
        scannedCount: 3,
        rewrappedCount: 3,
      });
      expect((await resumed.verifyZero()).oldRootCount).toBe(0);
    } finally {
      await resumed.close();
    }
  });

  it("supports empty stores and rejects invalid batch inputs", async () => {
    const file = databasePath("empty");
    const worker = openWorker(file);
    await worker.close();
    const adapter = openAdapter(file);
    try {
      expect(await adapter.preflight()).toMatchObject({
        totalCount: 0,
        oldRootCount: 0,
        newRootCount: 0,
      });
      expect(await adapter.rewrapBatch(undefined, 10)).toEqual({
        scannedCount: 0,
        rewrappedCount: 0,
      });
      await expect(adapter.rewrapBatch("bad-cursor", 1)).rejects.toThrow();
      await expect(adapter.rewrapBatch(undefined, 0)).rejects.toThrow();
      await expect(adapter.rewrapBatch(undefined, 1_001)).rejects.toThrow();
    } finally {
      await adapter.close();
    }
    await expect(adapter.inventory()).rejects.toThrow();
  });

  it("fails closed for corrupt or unexpectedly rooted envelopes", async () => {
    const corruptFile = databasePath("corrupt");
    await seedIdentityEnvelopes(corruptFile);
    const corruptWorker = openWorker(corruptFile);
    await corruptWorker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(
          "UPDATE identity_oidc_flows SET envelope_json = ? WHERE id = ?",
          ["{}", FLOW_ID],
        );
      }),
    });
    await corruptWorker.close();
    const corrupt = openAdapter(corruptFile);
    await expect(corrupt.preflight()).rejects.toMatchObject({
      code: "database_unavailable",
    });
    await corrupt.close();

    const unexpectedFile = databasePath("unexpected");
    await seedIdentityEnvelopes(unexpectedFile, Buffer.alloc(32, 99));
    const unexpected = openAdapter(unexpectedFile);
    await expect(unexpected.preflight()).rejects.toMatchObject({
      code: "database_unavailable",
    });
    await unexpected.close();
  });

  it("rejects closed-schema drift before mutating rows", async () => {
    const file = databasePath("schema");
    await seedIdentityEnvelopes(file);
    const worker = openWorker(file);
    await worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(
          "ALTER TABLE identity_oidc_flows ADD COLUMN future_envelope TEXT",
        );
      }),
    });
    await worker.close();
    const adapter = openAdapter(file);
    await expect(adapter.preflight()).rejects.toMatchObject({
      code: "database_unavailable",
    });
    await adapter.close();
  });

  it("rejects invalid or identical physical root material", () => {
    const file = databasePath("invalid-root");
    expect(() => IdentityRootRotationAdapter.open({
      databaseFile: file,
      productVersion: "0.1.0-test",
      logicalRootKeyId: "root",
      oldRoot: Buffer.alloc(31),
      newRoot,
    })).toThrow();
    expect(() => IdentityRootRotationAdapter.open({
      databaseFile: file,
      productVersion: "0.1.0-test",
      logicalRootKeyId: "root",
      oldRoot,
      newRoot: oldRoot,
    })).toThrow();
  });
});

async function seedIdentityEnvelopes(
  databaseFile: string,
  encryptionRoot: Buffer = oldRoot,
): Promise<{
  confirmedSeed: Buffer;
  pendingSeed: Buffer;
  oidcSecrets: { nonce: string; verifier: string };
}> {
  const ring = new IdentityKeyRing("root", { root: encryptionRoot });
  const confirmed = beginTotpEnrollment({
    authenticatorId: CONFIRMED_ID,
    userId: USER_ID,
    issuer: "SecretSauce",
    label: "confirmed@example.org",
    keyRing: ring,
    random: (size) => Buffer.alloc(size, 51),
  });
  const pending = beginTotpEnrollment({
    authenticatorId: PENDING_ID,
    userId: USER_ID,
    issuer: "SecretSauce",
    label: "pending@example.org",
    keyRing: ring,
    random: (size) => Buffer.alloc(size, 52),
  });
  const confirmedSeed = decryptTotpSeed(confirmed.envelope, ring);
  const pendingSeed = decryptTotpSeed(pending.envelope, ring);
  const oidcSecrets = {
    nonce: "n".repeat(43),
    verifier: "v".repeat(43),
  };
  const oidcEnvelope = encryptOidcFlowSecrets({
    flowId: FLOW_ID,
    providerId: "workforce",
    purpose: "login",
    secrets: oidcSecrets,
    keyRing: ring,
    random: (size) => Buffer.alloc(size, 53),
  });
  ring.destroy();

  const worker = openWorker(databaseFile);
  try {
    await worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(`
          INSERT INTO users (
            id, email, normalized_email, given_name, family_name,
            role, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          USER_ID,
          "operator@example.org",
          "operator@example.org",
          "Test",
          "Operator",
          "user",
          "active",
          NOW,
          NOW,
        ]);
        transaction.run(`
          INSERT INTO identity_restricted_sessions (
            id, user_id, purpose, session_hash, csrf_hash,
            issued_security_epoch, issued_global_epoch, issued_at, expires_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          SESSION_ID,
          USER_ID,
          "totp_enrollment",
          "1".repeat(64),
          "2".repeat(64),
          1,
          1,
          NOW,
          NOW + 60_000,
        ]);
        transaction.run(`
          INSERT INTO local_totp_authenticators (
            id, user_id, envelope_json, root_key_id, generation,
            confirmed_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          CONFIRMED_ID,
          USER_ID,
          JSON.stringify(confirmed.envelope),
          "root",
          1,
          NOW,
          NOW,
          NOW,
        ]);
        transaction.run(`
          INSERT INTO identity_pending_totp (
            restricted_session_id, user_id, authenticator_id,
            envelope_json, root_key_id, generation,
            password_policy_version, created_at, expires_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          SESSION_ID,
          USER_ID,
          PENDING_ID,
          JSON.stringify(pending.envelope),
          "root",
          1,
          1,
          NOW,
          NOW + 60_000,
        ]);
        transaction.run(`
          INSERT INTO identity_oidc_flows (
            id, provider_id, purpose, state_hash, envelope_json,
            redirect_uri, created_at, expires_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          FLOW_ID,
          "workforce",
          "login",
          "3".repeat(64),
          oidcEnvelope,
          "https://example.org/callback",
          NOW,
          NOW + 60_000,
        ]);
      }),
    });
  } finally {
    await worker.close();
  }
  return { confirmedSeed, pendingSeed, oidcSecrets };
}

function openAdapter(
  databaseFile: string,
  failureInjector?: (
    stage: "before_identity_row_update",
    table:
      | "local_totp_authenticators"
      | "identity_pending_totp"
      | "identity_oidc_flows",
  ) => void,
): IdentityRootRotationAdapter {
  return IdentityRootRotationAdapter.open({
    databaseFile,
    productVersion: "0.1.0-test",
    now: () => NOW + 1,
    logicalRootKeyId: "root",
    oldRoot,
    newRoot,
    randomBytes: (size) => Buffer.alloc(size, 61),
    ...(failureInjector === undefined ? {} : { failureInjector }),
  });
}

function openWorker(databaseFile: string): PersistenceWorker {
  return PersistenceWorker.open({
    databaseFile,
    productVersion: "0.1.0-test",
    now: () => NOW,
  });
}

async function snapshot(worker: PersistenceWorker): Promise<{
  confirmed: {
    envelope_json: string;
    root_key_id: string;
    generation: number;
    version: number;
    updated_at: number;
  };
  pending: {
    envelope_json: string;
    root_key_id: string;
    generation: number;
  };
  oidc: {
    envelope_json: string;
    version: number;
  };
}> {
  return worker.execute({
    run: (database) => database.read((query) => ({
      confirmed: query.get(`
        SELECT envelope_json, root_key_id, generation, version, updated_at
        FROM local_totp_authenticators WHERE id = ?
      `, [CONFIRMED_ID])!,
      pending: query.get(`
        SELECT envelope_json, root_key_id, generation
        FROM identity_pending_totp WHERE restricted_session_id = ?
      `, [SESSION_ID])!,
      oidc: query.get(`
        SELECT envelope_json, version
        FROM identity_oidc_flows WHERE id = ?
      `, [FLOW_ID])!,
    })),
  });
}

function databasePath(name: string): string {
  return join(
    mkdtempSync(join(tmpdir(), `identity-root-${name}-`)),
    "control.sqlite",
  );
}
