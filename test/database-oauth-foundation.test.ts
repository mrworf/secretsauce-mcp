import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DatabaseOAuthEligibilityRepository,
  DatabaseOAuthTokenHasher,
  isCanonicalOpaqueOAuthValue,
} from "../src/oauth/databaseOAuth.js";
import { IdentityRepository } from "../src/identity/repository.js";
import { PersistenceWorker } from "../src/persistence/worker.js";

const NOW = 1_785_100_000_000;
const SERVICE_ID = "018f1f2e-7b3c-7a10-8000-000000000101";
const SNAPSHOT_ID = "018f1f2e-7b3c-7a10-8000-000000000102";
const ASSIGNMENT_ID = "018f1f2e-7b3c-7a10-8000-000000000103";
const LINK_ID = "018f1f2e-7b3c-7a10-8000-000000000104";
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("database OAuth foundation", () => {
  it("uses canonical, domain-separated, key-only opaque token hashes", () => {
    const key = Buffer.alloc(32, 91);
    const hasher = new DatabaseOAuthTokenHasher(key);
    const value = Buffer.alloc(32, 92).toString("base64url");

    expect(isCanonicalOpaqueOAuthValue(value)).toBe(true);
    expect(hasher.hash("access", value)).toMatch(/^[a-f0-9]{64}$/);
    expect(hasher.hash("access", value)).not.toBe(hasher.hash("refresh", value));
    expect(() => hasher.hash("access", `${value}=`)).toThrow();
    expect(() => new DatabaseOAuthTokenHasher(key.subarray(0, 31))).toThrow();
    hasher.close();
    expect(JSON.stringify(hasher)).not.toContain(key.toString("base64url"));
  });

  it("requires an active ordinary user with configured local proof and current activated access", async () => {
    const worker = open("eligibility");
    const identities = new IdentityRepository(worker, { now: () => NOW });
    const user = await identities.createLocalIdentity({
      profile: {
        email: "eligible@example.org",
        givenName: "Eligible",
        familyName: "User",
      },
      role: "user",
      status: "active",
    }, audit());
    const admin = await identities.createLocalIdentity({
      profile: {
        email: "admin@example.org",
        givenName: "Service",
        familyName: "Admin",
      },
      role: "admin",
      status: "active",
    }, audit());
    await worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(`
          UPDATE local_authenticator_states
          SET password_state = 'configured', totp_state = 'configured',
              version = version + 1, updated_at = ?
          WHERE user_id IN (?, ?)
        `, [NOW, user.id, admin.id]);
        insertActiveService(transaction, user.id);
        transaction.run(`
          INSERT INTO external_identities (
            id, user_id, provider_id, issuer, subject,
            version, created_at, updated_at
          ) VALUES (?, ?, 'workforce', 'https://id.example.org',
            'external-subject', 1, ?, ?)
        `, [LINK_ID, user.id, NOW, NOW]);
      }),
    });
    const repository = new DatabaseOAuthEligibilityRepository(worker);

    await expect(repository.byEmail(" Eligible@Example.org "))
      .resolves.toMatchObject({
        userId: user.id,
        role: "user",
        status: "active",
        hasEffectiveService: true,
        localEligible: true,
      });
    await expect(repository.byExternalIdentity(
      "workforce",
      "https://id.example.org",
      "external-subject",
    )).resolves.toMatchObject({
      userId: user.id,
      hasEffectiveService: true,
    });
    await expect(repository.byUserId(admin.id)).resolves.toMatchObject({
      role: "admin",
      localEligible: false,
    });
    await expect(repository.byEmail("missing@example.org"))
      .resolves.toBeUndefined();
    await expect(repository.byExternalIdentity(
      "workforce",
      "https://id.example.org",
      "wrong-subject",
    )).resolves.toBeUndefined();
  });

  it("fails eligibility when activation or the final assignment disappears", async () => {
    const worker = open("dynamic");
    const identities = new IdentityRepository(worker, { now: () => NOW });
    const user = await identities.createLocalIdentity({
      profile: {
        email: "dynamic@example.org",
        givenName: "Dynamic",
        familyName: "User",
      },
      role: "user",
      status: "active",
    }, audit());
    await worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(`
          UPDATE local_authenticator_states
          SET password_state = 'configured', totp_state = 'configured',
              version = version + 1, updated_at = ?
          WHERE user_id = ?
        `, [NOW, user.id]);
        insertActiveService(transaction, user.id);
      }),
    });
    const repository = new DatabaseOAuthEligibilityRepository(worker);
    await expect(repository.byUserId(user.id)).resolves.toMatchObject({
      localEligible: true,
    });

    await worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(
          "DELETE FROM service_principal_assignments WHERE id = ?",
          [ASSIGNMENT_ID],
        );
      }),
    });
    await expect(repository.byUserId(user.id)).resolves.toMatchObject({
      hasEffectiveService: false,
      localEligible: false,
    });

    await worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(`
          INSERT INTO service_principal_assignments (
            id, service_id, selector_kind, group_id, user_id,
            assigned_by_user_id, created_at
          ) VALUES (?, ?, 'user', NULL, ?, ?, ?)
        `, [ASSIGNMENT_ID, SERVICE_ID, user.id, user.id, NOW]);
        transaction.run(`
          UPDATE runtime_activation SET state = 'inactive',
            activated_at = NULL, version = version + 1, updated_at = ?
          WHERE singleton = 1
        `, [NOW]);
      }),
    });
    await expect(repository.byUserId(user.id)).resolves.toMatchObject({
      hasEffectiveService: false,
      localEligible: false,
    });
  });
});

function open(label: string): PersistenceWorker {
  const worker = PersistenceWorker.open({
    databaseFile: join(
      mkdtempSync(join(tmpdir(), `secretsauce-oauth-${label}-`)),
      "control.sqlite",
    ),
    productVersion: "test",
    now: () => NOW,
  });
  workers.add(worker);
  return worker;
}

function insertActiveService(
  transaction: {
    run(sql: string, parameters?: unknown[]): unknown;
  },
  userId: string,
): void {
  transaction.run(`
    INSERT INTO services (
      id, slug, name, description, documentation_url, lifecycle,
      draft_digest, published_revision_id, published_digest,
      publication_generation, version, created_at, updated_at
    ) VALUES (?, 'oauth-api', 'OAuth API', NULL, NULL, 'published',
      ?, ?, ?, 1, 1, ?, ?)
  `, [
    SERVICE_ID,
    "a".repeat(64),
    "018f1f2e-7b3c-7a10-8000-000000000105",
    "b".repeat(64),
    NOW,
    NOW,
  ]);
  transaction.run(`
    INSERT INTO runtime_service_snapshots (
      id, service_id, publication_generation, document_json, digest, created_at
    ) VALUES (?, ?, 1, '{}', ?, ?)
  `, [SNAPSHOT_ID, SERVICE_ID, "c".repeat(64), NOW]);
  transaction.run(`
    UPDATE runtime_activation
    SET state = 'active', activation_generation = 1,
      global_reference_epoch = 1, version = 2,
      activated_at = ?, updated_at = ?
    WHERE singleton = 1
  `, [NOW, NOW]);
  transaction.run(`
    INSERT INTO runtime_active_services (
      service_id, snapshot_id, publication_generation, activated_at
    ) VALUES (?, ?, 1, ?)
  `, [SERVICE_ID, SNAPSHOT_ID, NOW]);
  transaction.run(`
    INSERT INTO service_principal_assignments (
      id, service_id, selector_kind, group_id, user_id,
      assigned_by_user_id, created_at
    ) VALUES (?, ?, 'user', NULL, ?, ?, ?)
  `, [ASSIGNMENT_ID, SERVICE_ID, userId, userId, NOW]);
}

function audit() {
  return {
    actor: {
      type: "local_cli" as const,
      label: "oauth-fixture",
      authenticationMethod: "host_terminal",
    },
    correlationId: "req_12345678-1234-4234-8234-123456789abc",
    source: { category: "identity" },
  };
}
