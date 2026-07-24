import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ControlIdempotencyHasher } from "../src/control/idempotency.js";
import { ControlRouteRegistry } from "../src/control/routeRegistry.js";
import { registerSecurityRoutes } from "../src/control/securityRoutes.js";
import {
  GlobalSecurityEventError,
  GlobalSecurityEvents,
} from "../src/globalSecurityEvents.js";
import { AlwaysStepUpHandle } from "../src/identity/stepUp.js";
import { IdentityRepository } from "../src/identity/repository.js";
import type { AdministrativeAuditEventInput } from "../src/persistence/administrativeAudit.js";
import type { PersistenceTransaction } from "../src/persistence/transaction.js";
import { PersistenceWorker } from "../src/persistence/worker.js";

const NOW = 1_785_000_000_000;
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("global security events", () => {
  it("forces password change, erases TOTP, invalidates human state, preserves API keys, and replays once", async () => {
    const worker = open();
    const identities = new IdentityRepository(worker, { now: () => NOW });
    const actor = await create(identities, "root", "superadmin");
    const user = await create(identities, "person", "user");
    await seedAuthenticators(worker, [actor.id, user.id]);
    await seedSystemApiKey(worker, actor.id);
    const events = new GlobalSecurityEvents(
      worker,
      fakeStepUps(worker),
      () => NOW,
    );
    const version = await events.stateVersion();
    const password = await events.execute({
      kind: "password_change",
      actor: browserActor(actor.id),
      expectedVersion: version,
      justification: "Annual credential rotation",
      correlationId: correlation(1),
      proof: proof(actor.id, 1),
      idempotency: idempotency(actor.id, "security.password_change", "one"),
    });
    expect(password).toMatchObject({
      replayed: false,
      event: { kind: "password_change", affectedUsers: 2 },
    });
    const replay = await events.execute({
      kind: "password_change",
      actor: browserActor(actor.id),
      expectedVersion: version,
      justification: "Annual credential rotation",
      correlationId: correlation(2),
      proof: proof(actor.id, 2),
      idempotency: idempotency(actor.id, "security.password_change", "one"),
    });
    expect(replay).toMatchObject({
      replayed: true,
      event: { id: password.event.id },
    });
    expect((await events.list()).filter((event) =>
      event.kind === "password_change")).toHaveLength(1);

    const totp = await events.execute({
      kind: "totp_reset",
      actor: browserActor(actor.id),
      expectedVersion: await events.stateVersion(),
      justification: "Authenticator fleet replacement",
      correlationId: correlation(3),
      proof: proof(actor.id, 3),
      idempotency: idempotency(actor.id, "security.totp_reset", "two"),
    });
    expect(totp.event).toMatchObject({ kind: "totp_reset", affectedUsers: 2 });
    expect(await worker.execute({
      run: (database) => database.read((query) => query.get<{
        events: number;
        credentials: number;
        totp: number;
        api_keys: number;
        global_epoch: number;
        password_epoch: number;
        reference_epoch: number;
      }>(`
        SELECT
          (SELECT count(*) FROM security_global_events) AS events,
          (SELECT count(*) FROM local_password_credentials) AS credentials,
          (SELECT count(*) FROM local_totp_authenticators) AS totp,
          (SELECT count(*) FROM api_keys) AS api_keys,
          (SELECT global_security_epoch FROM identity_security_state
            WHERE singleton = 1) AS global_epoch,
          (SELECT password_change_epoch FROM identity_security_state
            WHERE singleton = 1) AS password_epoch,
          (SELECT global_reference_epoch FROM runtime_activation
            WHERE singleton = 1) AS reference_epoch
      `)),
    })).toEqual({
      events: 2,
      credentials: 2,
      totp: 0,
      api_keys: 1,
      global_epoch: 3,
      password_epoch: 2,
      reference_epoch: 2,
    });
    await expect(events.execute({
      kind: "totp_reset",
      actor: browserActor(actor.id),
      expectedVersion: 1,
      justification: "Stale attempt",
      correlationId: correlation(4),
      proof: proof(actor.id, 4),
      idempotency: idempotency(actor.id, "security.totp_reset", "stale"),
    })).rejects.toEqual(new GlobalSecurityEventError("stale"));
  });

  it("publishes strict and operation-bound HTTP contracts", () => {
    const registry = new ControlRouteRegistry();
    registerSecurityRoutes(registry, {
      repository: {} as never,
      store: {} as never,
      inactivityJob: {} as never,
      globalEvents: {} as never,
      idempotency: new ControlIdempotencyHasher(Buffer.alloc(32, 17)),
    });
    const routes = registry.definitions();
    const password = routes.find(({ id }) =>
      id === "security.events.password_change")!;
    const totp = routes.find(({ id }) => id === "security.events.totp_reset")!;
    const list = routes.find(({ id }) => id === "security.events.list")!;

    expect(password).toMatchObject({
      authentication: ["browser_session"],
      permission: "global_authenticator_event",
      stepUp: "always",
      concurrency: "if-match",
      idempotency: "required",
    });
    expect(password.schemas.body!.safeParse({
      justification: "Rotate every local password.",
      acknowledgement: "REQUIRE ALL LOCAL USERS TO CHANGE PASSWORDS",
    }).success).toBe(true);
    expect(password.schemas.body!.safeParse({
      justification: "Rotate every local password.",
      acknowledgement: "require all local users to change passwords",
    }).success).toBe(false);
    expect(totp.schemas.body!.safeParse({
      justification: "Replace the authenticator fleet.",
      acknowledgement: "ERASE ALL LOCAL TOTP AUTHENTICATORS",
      unexpected: true,
    }).success).toBe(false);
    expect(list.schemas.query!.safeParse({ limit: "100" }).success).toBe(true);
    expect(list.schemas.query!.safeParse({ limit: "101" }).success).toBe(false);
    expect(list.schemas.query!.safeParse({ limit: "0" }).success).toBe(false);
  });
});

function fakeStepUps(worker: PersistenceWorker) {
  return {
    withConsumedProof: async <T>(
      _proof: AlwaysStepUpHandle,
      audit: AdministrativeAuditEventInput,
      mutation: (transaction: PersistenceTransaction) => T,
    ): Promise<T> => worker.execute({
      run: (database) => database.withGeneratedAdministrativeAudit(
        (transaction) => ({ value: mutation(transaction), auditInput: audit }),
      ),
    }),
  };
}

async function seedAuthenticators(
  worker: PersistenceWorker,
  userIds: string[],
): Promise<void> {
  await worker.execute({
    run: (database) => database.withOperationalTransaction((transaction) => {
      userIds.forEach((userId, index) => {
        transaction.run(`
          INSERT INTO local_password_credentials (
            user_id, encoded_hash, policy_version, password_change_epoch,
            version, created_at, updated_at
          ) VALUES (?, ?, 1, 1, 1, ?, ?)
        `, [userId, `$argon2id$${String(index).repeat(64)}`, NOW, NOW]);
        transaction.run(`
          INSERT INTO local_totp_authenticators (
            id, user_id, envelope_json, root_key_id, generation,
            confirmed_at, version, created_at, updated_at
          ) VALUES (?, ?, ?, 'root', 1, ?, 1, ?, ?)
        `, [
          `018f1f2e-7b3c-7a10-8000-0000000000${20 + index}`,
          userId,
          JSON.stringify({ padding: "x".repeat(128) }),
          NOW,
          NOW,
          NOW,
        ]);
        transaction.run(`
          UPDATE local_authenticator_states
          SET password_state = 'configured', totp_state = 'configured'
          WHERE user_id = ?
        `, [userId]);
      });
    }),
  });
}

async function seedSystemApiKey(
  worker: PersistenceWorker,
  actorId: string,
): Promise<void> {
  await worker.execute({
    run: (database) => database.withOperationalTransaction((transaction) => {
      transaction.run(`
        INSERT INTO api_keys (
          id, identifier, verifier_hash, nickname, last_four,
          api_role, service_id, expiration_policy, expires_at,
          status, creator_id, version, created_at, updated_at
        ) VALUES (
          '018f1f2e-7b3c-7a10-8000-000000000090',
          'abcdefghijklmnop', ?, 'automation', 'wxyz',
          'system', NULL, 'forever', NULL,
          'active', ?, 1, ?, ?
        )
      `, [`$argon2id$${"x".repeat(64)}`, actorId, NOW, NOW]);
    }),
  });
}

async function create(
  repository: IdentityRepository,
  name: string,
  role: "superadmin" | "user",
) {
  return repository.createLocalIdentity({
    profile: {
      email: `${name}@example.org`,
      givenName: name,
      familyName: "User",
    },
    role,
    status: "active",
  }, audit());
}

function browserActor(principalId: string) {
  return {
    method: "browser_session" as const,
    principalId,
    role: "superadmin" as const,
  };
}

function proof(userId: string, sequence: number) {
  return new AlwaysStepUpHandle(
    `018f1f2e-7b3c-7a10-8000-0000000001${sequence.toString().padStart(2, "0")}`,
    `018f1f2e-7b3c-7a10-8000-0000000002${sequence.toString().padStart(2, "0")}`,
    userId,
  );
}

function idempotency(principalId: string, routeId: string, value: string) {
  return {
    keyHash: digest(`key:${value}`),
    principalId,
    routeId,
    requestDigest: digest(`request:${value}`),
  };
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function correlation(value: number) {
  return `req_12345678-1234-4234-8234-${value.toString().padStart(12, "0")}`;
}

function audit() {
  return {
    actor: {
      type: "local_cli" as const,
      label: "global-security-fixture",
      authenticationMethod: "host_terminal",
    },
    correlationId: correlation(0),
    source: { category: "identity" },
  };
}

function open(): PersistenceWorker {
  const worker = PersistenceWorker.open({
    databaseFile: join(
      mkdtempSync(join(tmpdir(), "secretsauce-global-security-")),
      "control.sqlite",
    ),
    productVersion: "test",
    now: () => NOW,
  });
  workers.add(worker);
  return worker;
}
