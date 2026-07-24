import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AuditSearchError,
  AuditSearchService,
} from "../src/auditSearch.js";
import { AuditRetentionService } from "../src/auditRetention.js";
import type { ControlAuthenticationContext } from "../src/control/authentication.js";
import type { ControlAuthenticator } from "../src/control/authentication.js";
import { createControlApplication } from "../src/control/server.js";
import { validateConfig } from "../src/config.js";
import { PersistenceWorker } from "../src/persistence/worker.js";

const NOW = 1_785_000_000_000;
const ACTOR_ID = "018f1f2e-7b3c-7a10-8000-000000000001";
const TARGET_ID = "018f1f2e-7b3c-7a10-8000-000000000002";
const SERVICE_ID = "018f1f2e-7b3c-7a10-8000-000000000003";
const RUNTIME_ID = "018f1f2e-7b3c-7a10-8000-000000000004";
const CORRELATION_ID = "req_8ca2d86c-541c-4484-bcc0-feebb54f6311";

describe("scoped audit search", () => {
  it("searches both domains, applies inclusive UTC bounds, and paginates deterministically", async () => {
    const fixture = open();
    try {
      await appendAdministrative(fixture.worker, "security.password_change", "Quarterly review");
      await appendAdministrative(fixture.worker, "security.totp_reset", "Quarterly review");
      await fixture.worker.execute({
        run: (database) => database.appendRuntimeAudit({
          eventId: RUNTIME_ID,
          occurredAt: NOW,
          eventType: "service_request",
          outcome: "allow",
          category: "authorization",
          actorType: "oauth_user",
          subjectId: ACTOR_ID,
          subjectLabel: "Ada User",
          serviceId: SERVICE_ID,
          serviceLabel: "Payments Gateway",
          destination: "primary",
          action: "service_request",
          method: "GET",
          targetHost: "api.example.org",
          targetPath: "/v1/widgets",
          correlationId: CORRELATION_ID,
          source: { category: "mcp", client: "ChatGPT" },
          details: { policy_decision: "allow" },
        }),
      });

      const first = await fixture.service.search(superadmin(), "administrative", {
        q: "quarterly review",
        startUtc: new Date(NOW).toISOString(),
        endUtc: new Date(NOW).toISOString(),
        limit: 1,
      });
      expect(first.events).toHaveLength(1);
      expect(first.nextCursor).toEqual(expect.any(String));
      const second = await fixture.service.search(superadmin(), "administrative", {
        q: "quarterly review",
        startUtc: new Date(NOW).toISOString(),
        endUtc: new Date(NOW).toISOString(),
        limit: 1,
        cursor: first.nextCursor,
      });
      expect(second.events).toHaveLength(1);
      expect(second.events[0]?.eventId).not.toBe(first.events[0]?.eventId);
      expect(second.nextCursor).toBeUndefined();

      const runtime = await fixture.service.search(superadmin(), "runtime", {
        q: "payments widgets chatgpt",
        preset: "24h",
      });
      expect(runtime.events).toEqual([
        expect.objectContaining({
          eventId: RUNTIME_ID,
          domain: "runtime",
          serviceLabel: "Payments Gateway",
        }),
      ]);
    } finally {
      fixture.service.close();
      await fixture.worker.close();
    }
  });

  it("enforces role/service scope before FTS and exposes only reduced own-security events", async () => {
    const fixture = open();
    try {
      await appendAdministrative(fixture.worker, "security.password_change", "Hidden review");
      await expect(fixture.service.search(admin(), "administrative", { q: "hidden" }))
        .resolves.toEqual({ events: [] });
      await expect(fixture.service.search(user(), "administrative", {}))
        .rejects.toEqual(new AuditSearchError("forbidden"));

      const self = await fixture.service.selfSecurity(user(), {
        startUtc: new Date(NOW).toISOString(),
        endUtc: new Date(NOW).toISOString(),
      });
      expect(self.events).toEqual([
        expect.objectContaining({
          actorId: ACTOR_ID,
          action: "security.password_change",
          changes: [],
          source: {},
        }),
      ]);
      expect(self.events[0]).not.toHaveProperty("justification");
    } finally {
      fixture.service.close();
      await fixture.worker.close();
    }
  });

  it("rejects mixed, malformed, excessive, and cursor-rebound filters", async () => {
    const fixture = open();
    try {
      await appendAdministrative(fixture.worker, "security.password_change", "Review");
      const page = await fixture.service.search(superadmin(), "administrative", { limit: 1 });
      const invalid = [
        { preset: "24h" as const, startUtc: new Date(NOW).toISOString(), endUtc: new Date(NOW).toISOString() },
        { startUtc: new Date(NOW).toISOString() },
        { startUtc: new Date(NOW + 1).toISOString(), endUtc: new Date(NOW).toISOString() },
        { q: Array.from({ length: 17 }, () => "term").join(" ") },
        { limit: 101 },
      ];
      for (const filter of invalid) {
        await expect(fixture.service.search(superadmin(), "administrative", filter))
          .rejects.toMatchObject({ code: "invalid_filter" });
      }
      if (page.nextCursor !== undefined) {
        await expect(fixture.service.search(superadmin(), "runtime", {
          limit: 1,
          cursor: page.nextCursor,
        })).rejects.toMatchObject({ statusCode: 400 });
      }
    } finally {
      fixture.service.close();
      await fixture.worker.close();
    }
  });

  it("serves strict no-store explorer routes and denies ordinary users", async () => {
    const fixture = open();
    await appendAdministrative(fixture.worker, "security.password_change", "Review");
    const config = controlConfig();
    const allowed = createControlApplication(config, {
      persistence: fixture.worker,
      auditSearch: fixture.service,
      auditRetention: fixture.retention,
      authenticator: fixedAuthenticator("superadmin"),
    });
    const denied = createControlApplication(config, {
      persistence: fixture.worker,
      auditSearch: fixture.service,
      auditRetention: fixture.retention,
      authenticator: fixedAuthenticator("user"),
    });
    try {
      const response = await allowed.inject({
        method: "GET",
        url: "/api/v2/audits/administrative?preset=24h&q=review",
        headers: { host: "control.example.org" },
      });
      expect(response.statusCode).toBe(200);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.json().data.events).toHaveLength(1);

      const malformed = await allowed.inject({
        method: "GET",
        url: "/api/v2/audits/runtime?limit=101",
        headers: { host: "control.example.org" },
      });
      expect(malformed.statusCode).toBe(400);
      const forbidden = await denied.inject({
        method: "GET",
        url: "/api/v2/audits/administrative",
        headers: { host: "control.example.org" },
      });
      expect(forbidden.statusCode).toBe(403);

      const exported = await allowed.inject({
        method: "POST",
        url: "/api/v2/audits/administrative/export",
        headers: {
          host: "control.example.org",
          origin: "https://control.example.org",
          "x-csrf-token": "valid-csrf-proof",
        },
        payload: {
          q: "review",
          preset: "24h",
          justification: "Incident evidence review",
        },
      });
      expect(exported.statusCode, exported.body).toBe(200);
      expect(exported.json().data).toMatchObject({
        filename: "secretsauce-administrative-audit.ndjson",
        media_type: "application/x-ndjson",
        row_count: 1,
      });
      const lines = exported.json().data.content.trim().split("\n");
      expect(lines).toHaveLength(1);
      expect(JSON.parse(lines[0])).toMatchObject({
        domain: "administrative",
        action: "security.password_change",
      });
      expect(exported.body).not.toContain("Incident evidence review");

      const exportAudit = await fixture.worker.execute({
        run: (database) => database.read((query) => query.get<{
          action: string;
          changes_json: string;
        }>(`
          SELECT action, changes_json
          FROM administrative_audit_events
          WHERE action = 'audit.export'
        `)),
      });
      expect(exportAudit?.action).toBe("audit.export");
      expect(exportAudit?.changes_json).toContain("row_count");
      expect(exportAudit?.changes_json).not.toContain("review");

      const invalidExport = await allowed.inject({
        method: "POST",
        url: "/api/v2/audits/administrative/export",
        headers: {
          host: "control.example.org",
          origin: "https://control.example.org",
          "x-csrf-token": "valid-csrf-proof",
        },
        payload: {
          justification: "line one\nline two",
        },
      });
      expect(invalidExport.statusCode).toBe(400);

      const retention = await allowed.inject({
        method: "GET",
        url: "/api/v2/audits/retention",
        headers: { host: "control.example.org" },
      });
      expect(retention.statusCode, retention.body).toBe(200);
      expect(retention.headers.etag).toBe('"1"');
      expect(retention.json().data.settings).toMatchObject({
        administrative_days: 400,
        runtime_days: 400,
      });

      const invalidRetention = await allowed.inject({
        method: "PATCH",
        url: "/api/v2/audits/retention",
        headers: {
          host: "control.example.org",
          origin: "https://control.example.org",
          "x-csrf-token": "valid-csrf-proof",
          "if-match": '"1"',
        },
        payload: {
          administrative_days: 400,
          runtime_days: 400,
          justification: "Capacity review",
          acknowledgement: "I accept",
        },
      });
      expect(invalidRetention.statusCode).toBe(400);
    } finally {
      await allowed.close();
      await denied.close();
      fixture.service.close();
      await fixture.worker.close();
    }
  });
});

function open() {
  const worker = PersistenceWorker.open({
    databaseFile: join(mkdtempSync(join(tmpdir(), "audit-search-")), "control.sqlite"),
    productVersion: "test",
    now: () => NOW,
  });
  return {
    worker,
    service: new AuditSearchService(worker, Buffer.alloc(32, 7), () => NOW),
    retention: new AuditRetentionService(worker, () => NOW),
  };
}

async function appendAdministrative(
  worker: PersistenceWorker,
  action: string,
  justification: string,
): Promise<void> {
  await worker.execute({
    run: (database) => {
      database.appendAdministrativeAudit({
        actor: {
          type: "browser_session",
          id: ACTOR_ID,
          label: "Ada Admin",
          role: "superadmin",
          authenticationMethod: "password_totp",
        },
        category: "security",
        action,
        result: "allow",
        target: { type: "user", id: TARGET_ID, label: "Deleted User" },
        serviceId: SERVICE_ID,
        serviceLabel: "Payments Gateway",
        justification,
        changes: [{ field: "security_epoch", before: 1, after: 2 }],
        correlationId: CORRELATION_ID,
        source: { category: "control", client: "browser" },
      });
    },
  });
}

function superadmin(): ControlAuthenticationContext {
  return { method: "browser_session", principalId: ACTOR_ID, role: "superadmin" };
}

function admin(): ControlAuthenticationContext {
  return { method: "browser_session", principalId: ACTOR_ID, role: "admin" };
}

function user(): ControlAuthenticationContext {
  return { method: "browser_session", principalId: ACTOR_ID, role: "user" };
}

function fixedAuthenticator(
  role: ControlAuthenticationContext["role"],
): ControlAuthenticator {
  return {
    authenticate: async () => ({
      method: "browser_session",
      principalId: ACTOR_ID,
      role,
    }),
    verifyCsrf: async () => true,
  };
}

function controlConfig() {
  const directory = mkdtempSync(join(tmpdir(), "audit-search-control-"));
  const keyFile = join(directory, "idempotency.key");
  writeFileSync(keyFile, `${Buffer.alloc(32, 9).toString("base64url")}\n`, { mode: 0o600 });
  chmodSync(keyFile, 0o600);
  return validateConfig({
    server: {
      listen: "127.0.0.1:8080",
      mcp_path: "/mcp",
      resource: "https://mcp.example.org",
    },
    control: {
      listen: "127.0.0.1:8081",
      public_origin: "https://control.example.org",
      idempotency_hmac_key_file: keyFile,
    },
    persistence: { database_file: join(directory, "control.sqlite") },
    auth: {
      mode: "bearer",
      bearer: { token_env: "TEST_GATEWAY_TOKEN" },
    },
    services: {
      demo: {
        type: "http",
        name: "Demo",
        no_auth: true,
        destinations: [{ name: "primary", base_url: "https://api.example.org" }],
      },
    },
  }, { TEST_GATEWAY_TOKEN: "data-plane-test-token" });
}
