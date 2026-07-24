import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ControlAuthenticationContext } from "../src/control/authentication.js";
import { AlwaysStepUpHandle } from "../src/identity/stepUp.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import {
  SecurityDashboardError,
  SecurityDashboardService,
} from "../src/securityDashboard.js";

const NOW = 1_800_000_000_000;
const SUPERADMIN_ID = "018f1f2e-7b3c-7a10-8000-000000000001";
const ADMIN_ID = "018f1f2e-7b3c-7a10-8000-000000000002";
const USER_ID = "018f1f2e-7b3c-7a10-8000-000000000003";
const PENDING_ID = "018f1f2e-7b3c-7a10-8000-000000000004";
const SERVICE_ONE = "018f1f2e-7b3c-7a10-8000-000000000010";
const SERVICE_TWO = "018f1f2e-7b3c-7a10-8000-000000000011";
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("closed security dashboard and remediations", () => {
  it("reconciles closed findings and filters global and service signals first", async () => {
    const fixture = await seeded();
    const adminSnapshot = await fixture.security.snapshot(admin());
    expect(adminSnapshot.remediations).toEqual([
      expect.objectContaining({
        code: "api_key.non_expiring",
        serviceId: SERVICE_ONE,
        state: "open",
      }),
    ]);
    expect(adminSnapshot.signals).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "self_api_key.blocked",
        serviceId: SERVICE_ONE,
        severity: "critical",
        count: 1,
      }),
    ]));
    const adminText = JSON.stringify(adminSnapshot);
    expect(adminText).not.toContain(SERVICE_TWO);
    expect(adminText).not.toContain("identity.pending_enrollment");
    expect(adminText).not.toContain("Private User");
    expect(adminText).not.toContain("/private");

    const global = await fixture.security.snapshot(superadmin());
    expect(global.remediations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "credential.missing",
        serviceId: SERVICE_TWO,
      }),
      expect.objectContaining({ code: "identity.pending_enrollment" }),
      expect.objectContaining({ code: "identity.zero_services" }),
    ]));
  });

  it("consumes step-up for atomic audited acknowledgement with scope and version checks", async () => {
    const fixture = await seeded();
    const snapshot = await fixture.security.snapshot(admin());
    const remediation = snapshot.remediations[0]!;
    const updated = await fixture.security.updateRemediation({
      actor: admin(),
      remediationId: remediation.id,
      expectedVersion: remediation.version,
      state: "acknowledged",
      justification: "Reviewed with service owner.",
      correlationId: "req_12345678-1234-4234-8234-123456789abc",
      proof: proof(ADMIN_ID),
    });
    expect(updated.state).toBe("acknowledged");

    const audit = await fixture.worker.execute({
      run: (database) => database.read((query) => query.get<{
        action: string;
        justification: string;
      }>(`
        SELECT action, justification
        FROM administrative_audit_events
        WHERE action = 'dashboard.remediation.acknowledged'
      `)),
    });
    expect(audit).toEqual({
      action: "dashboard.remediation.acknowledged",
      justification: "Reviewed with service owner.",
    });

    await expect(fixture.security.updateRemediation({
      actor: admin(),
      remediationId: remediation.id,
      expectedVersion: remediation.version,
      state: "dismissed",
      justification: "Stale request.",
      correlationId: "req_22345678-1234-4234-8234-123456789abc",
      proof: proof(ADMIN_ID),
    })).rejects.toEqual(new SecurityDashboardError("stale"));
    const other = (await fixture.security.snapshot(superadmin())).remediations
      .find((row) => row.serviceId === SERVICE_TWO)!;
    await expect(fixture.security.updateRemediation({
      actor: admin(),
      remediationId: other.id,
      expectedVersion: other.version,
      state: "acknowledged",
      justification: "Cross-scope attempt.",
      correlationId: "req_32345678-1234-4234-8234-123456789abc",
      proof: proof(ADMIN_ID),
    })).rejects.toEqual(new SecurityDashboardError("not_found"));
  });

  it("hides dismissed findings until resolution and reopens a new generation", async () => {
    const fixture = await seeded();
    const initial = await fixture.security.snapshot(superadmin());
    const missing = initial.remediations.find((row) =>
      row.code === "credential.missing" && row.serviceId === SERVICE_TWO)!;
    const dismissed = await fixture.security.updateRemediation({
      actor: superadmin(),
      remediationId: missing.id,
      expectedVersion: missing.version,
      state: "dismissed",
      justification: "Accepted during migration window.",
      correlationId: "req_42345678-1234-4234-8234-123456789abc",
      proof: proof(SUPERADMIN_ID),
    });
    expect(dismissed.state).toBe("dismissed");
    expect((await fixture.security.snapshot(superadmin())).remediations)
      .not.toEqual(expect.arrayContaining([
        expect.objectContaining({ id: missing.id }),
      ]));

    await fixture.worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(`
          INSERT INTO service_credentials (
            id, service_id, name, normalized_name, usage_kind, usage_name,
            status, vault_state, vault_locator, vault_generation, last_four,
            value_updated_at, authorization_generation, version, created_at,
            updated_at
          ) VALUES (
            '018f1f2e-7b3c-7a10-8000-000000000050', ?, 'Ready', 'ready',
            'header', 'X-Ready', 'configured', 'idle',
            '018f1f2e-7b3c-4a10-8000-000000000050', 1, 'last', ?,
            1, 1, ?, ?
          )
        `, [SERVICE_TWO, NOW, NOW, NOW]);
      }),
    });
    await fixture.security.snapshot(superadmin());
    await fixture.worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(
          "DELETE FROM service_credentials WHERE service_id = ?",
          [SERVICE_TWO],
        );
      }),
    });
    const reopened = (await fixture.security.snapshot(superadmin())).remediations
      .find((row) => row.id === missing.id)!;
    expect(reopened).toMatchObject({
      state: "open",
      generation: 2,
    });
  });

  it("rejects missing proof, malformed justification, and non-human viewers", async () => {
    const fixture = await seeded();
    const remediation = (await fixture.security.snapshot(admin())).remediations[0]!;
    await expect(fixture.security.updateRemediation({
      actor: admin(),
      remediationId: remediation.id,
      expectedVersion: remediation.version,
      state: "acknowledged",
      justification: "No proof.",
      correlationId: "req_52345678-1234-4234-8234-123456789abc",
    })).rejects.toEqual(new SecurityDashboardError("forbidden"));
    await expect(fixture.security.updateRemediation({
      actor: admin(),
      remediationId: remediation.id,
      expectedVersion: remediation.version,
      state: "acknowledged",
      justification: "bad\njustification",
      correlationId: "req_62345678-1234-4234-8234-123456789abc",
      proof: proof(ADMIN_ID),
    })).rejects.toEqual(new SecurityDashboardError("invalid"));
    await expect(fixture.security.snapshot({ ...admin(), role: "user" }))
      .rejects.toEqual(new SecurityDashboardError("forbidden"));
  });
});

async function seeded() {
  const worker = PersistenceWorker.open({
    databaseFile: join(
      mkdtempSync(join(tmpdir(), "security-dashboard-")),
      "control.sqlite",
    ),
    productVersion: "test",
    now: () => NOW,
  });
  workers.add(worker);
  await worker.execute({
    run: (database) => database.withOperationalTransaction((transaction) => {
      for (const [id, email, role, status] of [
        [SUPERADMIN_ID, "root@example.org", "superadmin", "active"],
        [ADMIN_ID, "admin@example.org", "admin", "active"],
        [USER_ID, "user@example.org", "user", "active"],
        [PENDING_ID, "pending@example.org", "user", "enrollment_required"],
      ] as const) {
        transaction.run(`
          INSERT INTO users (
            id, email, normalized_email, given_name, family_name, role, status,
            security_epoch, password_policy_version, version, created_at, updated_at
          ) VALUES (?, ?, ?, '', '', ?, ?, 1, 1, 1, ?, ?)
        `, [id, email, email, role, status, NOW - 100, NOW - 100]);
      }
      for (const [id, slug, name] of [
        [SERVICE_ONE, "alpha", "Alpha Service"],
        [SERVICE_TWO, "beta", "Beta Service"],
      ] as const) {
        transaction.run(`
          INSERT INTO services (
            id, slug, name, lifecycle, draft_digest, publication_generation,
            version, created_at, updated_at
          ) VALUES (?, ?, ?, 'published', ?, 1, 1, ?, ?)
        `, [id, slug, name, "a".repeat(64), NOW - 100, NOW - 100]);
      }
      transaction.run(`
        INSERT INTO service_admins (
          service_id, user_id, assigned_by_user_id, created_at
        ) VALUES (?, ?, ?, ?)
      `, [SERVICE_ONE, ADMIN_ID, SUPERADMIN_ID, NOW]);
      transaction.run(`
        INSERT INTO service_credentials (
          id, service_id, name, normalized_name, usage_kind, usage_name,
          status, vault_state, vault_locator, vault_generation, last_four,
          value_updated_at, authorization_generation, version, created_at,
          updated_at
        ) VALUES (
          '018f1f2e-7b3c-7a10-8000-000000000020', ?, 'Ready', 'ready',
          'header', 'X-Ready', 'configured', 'idle',
          '018f1f2e-7b3c-4a10-8000-000000000020', 1, 'last', ?,
          1, 1, ?, ?
        )
      `, [SERVICE_ONE, NOW, NOW, NOW]);
      transaction.run(`
        INSERT INTO api_keys (
          id, identifier, verifier_hash, nickname, last_four, api_role,
          service_id, expiration_policy, expires_at, status, creator_id,
          version, created_at, updated_at
        ) VALUES (
          '018f1f2e-7b3c-7a10-8000-000000000030',
          'AAAAAAAAAAAAAAAA', ?, 'Never expires', 'AAAA', 'service', ?,
          'forever', NULL, 'active', ?, 1, ?, ?
        )
      `, [
        `$argon2id$${"x".repeat(64)}`,
        SERVICE_ONE,
        SUPERADMIN_ID,
        NOW - 100,
        NOW - 100,
      ]);
    }),
  });
  await worker.execute({
    run: (database) => database.appendRuntimeAudit({
      eventId: "018f1f2e-7b3c-7a10-8000-000000000040",
      occurredAt: NOW - 1,
      eventType: "self_api_key_blocked",
      outcome: "deny",
      category: "security",
      actorType: "oauth_user",
      subjectId: USER_ID,
      subjectLabel: "Private User",
      serviceId: SERVICE_ONE,
      serviceLabel: "Alpha Service",
      destination: "primary",
      action: "self_api_key_blocked",
      method: "GET",
      targetHost: "api.example.org",
      targetPath: "/private",
      source: {},
      details: {},
    }),
  });
  const stepUps = {
    withConsumedProofGenerated: async <T>(
      _handle: AlwaysStepUpHandle,
      mutation: Parameters<
        NonNullable<ConstructorParameters<typeof SecurityDashboardService>[1]>["stepUps"]
      >[1],
    ): Promise<T> => worker.execute({
      run: (database) => database.withGeneratedAdministrativeAudit(
        mutation as never,
      ) as T,
    }),
  };
  return {
    worker,
    security: new SecurityDashboardService(worker, {
      now: () => NOW,
      findingKey: new Uint8Array(32).fill(7),
      stepUps: stepUps as never,
    }),
  };
}

function proof(userId: string): AlwaysStepUpHandle {
  return new AlwaysStepUpHandle(
    "018f1f2e-7b3c-7a10-8000-000000000090",
    "018f1f2e-7b3c-7a10-8000-000000000091",
    userId,
  );
}

function superadmin(): ControlAuthenticationContext {
  return {
    method: "browser_session",
    principalId: SUPERADMIN_ID,
    role: "superadmin",
  };
}

function admin(): ControlAuthenticationContext {
  return {
    method: "browser_session",
    principalId: ADMIN_ID,
    role: "admin",
  };
}
