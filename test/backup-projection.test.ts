import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { afterEach, describe, expect, it } from "vitest";
import {
  BackupProjectionError,
  PortableBackupProjectionService,
} from "../src/backupProjection.js";
import { UuidV7Generator } from "../src/persistence/uuidV7.js";
import { PersistenceWorker } from "../src/persistence/worker.js";

const NOW = 1_800_000_000_000;
const USER_ID = "018f1f2e-7b3c-7a10-8000-000000000001";
const SERVICE_ID = "018f1f2e-7b3c-7a10-8000-000000000010";
const DESTINATION_ID = "018f1f2e-7b3c-7a10-8000-000000000011";
const GROUP_ID = "018f1f2e-7b3c-7a10-8000-000000000012";
const CREDENTIAL_ID = "018f1f2e-7b3c-7a10-8000-000000000020";
const POLICY_ID = "018f1f2e-7b3c-7a10-8000-000000000030";
const RULE_ID = "018f1f2e-7b3c-7a10-8000-000000000031";
const LOCATOR = "018f1f2e-7b3c-4a10-8000-000000000040";
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("portable backup projection", () => {
  it("serializes portable Unicode configuration and excludes instance canaries", async () => {
    const worker = await seeded();
    const projection = new PortableBackupProjectionService(worker);
    const first = await projection.project({ includeSecrets: false });
    const second = await projection.project({ includeSecrets: false });
    expect(first.mode).toBe("credential-less");
    expect(first.counts).toEqual({
      services: 1,
      destinations: 1,
      credentials: 1,
      policies: 1,
      rules: 1,
      secrets: 0,
    });
    expect(first.documents.services).toEqual(second.documents.services);
    expect(first.documents.credentials).toEqual(second.documents.credentials);
    expect(first.documents.policies).toEqual(second.documents.policies);

    const services = parseYaml(first.documents.services.toString("utf8"));
    const credentials = parseYaml(first.documents.credentials.toString("utf8"));
    const policies = parseYaml(first.documents.policies.toString("utf8"));
    expect(services).toMatchObject({
      kind: "services",
      schema_version: 1,
      services: [{
        id: SERVICE_ID,
        name: "Café Service",
        destinations: [{
          id: DESTINATION_ID,
          base_url: "https://api.example.org",
          tls: { verify: false },
        }],
      }],
    });
    expect(credentials).toMatchObject({
      kind: "credentials",
      credentials: [{
        id: CREDENTIAL_ID,
        status: "unconfigured",
        usage: {
          kind: "header",
          name: "X-Service-Key",
          prefix: "Bearer ",
          enforce_header_ownership: true,
        },
      }],
    });
    expect(credentials.credentials[0]).not.toHaveProperty("secret_record");
    expect(policies).toMatchObject({
      kind: "policies",
      policies: [{
        id: POLICY_ID,
        rules: [{
          id: RULE_ID,
          effect: "allow",
          paths: [{ kind: "regex", value: "^/widgets$" }],
          response_safeguards: {
            binary_response: { max_bytes: 1024, scan: true },
          },
        }],
      }],
    });

    const exported = Buffer.concat(Object.values(first.documents)).toString("utf8");
    for (const prohibited of [
      "identity-canary@example.org",
      "GROUP-CANARY",
      "ASSIGNMENT-CANARY",
      "LEAK",
      LOCATOR,
      "/private/audit-canary",
    ]) expect(exported).not.toContain(prohibited);
    for (const prohibitedKey of [
      "last_four",
      "vault_locator",
      "authorization_generation",
      "selector_kind",
      "assigned_by_user_id",
      "publication_generation",
      "evaluation_generation",
    ]) expect(exported).not.toContain(prohibitedKey);
  });

  it("selects exact secret records only for a secret-bearing projection", async () => {
    const worker = await seeded();
    const projection = await new PortableBackupProjectionService(worker)
      .project({ includeSecrets: true });
    expect(projection.counts.secrets).toBe(1);
    expect(projection.secretSelection).toEqual([{
      serviceId: SERVICE_ID,
      destinationId: SERVICE_ID,
      credentialId: CREDENTIAL_ID,
      locator: LOCATOR,
      generation: 3,
    }]);
    const credentials = parseYaml(
      projection.documents.credentials.toString("utf8"),
    );
    expect(credentials.credentials[0]).toMatchObject({
      status: "configured",
      secret_record: { locator: LOCATOR, generation: 3 },
    });
    expect(projection.documents.credentials.toString("utf8"))
      .not.toContain("LEAK");
  });

  it("fails secret export for unsettled vault state without blocking credential-less export", async () => {
    const worker = await seeded();
    await worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(`
          UPDATE service_credentials SET vault_state = 'reconcile'
          WHERE id = ?
        `, [CREDENTIAL_ID]);
      }),
    });
    const projection = new PortableBackupProjectionService(worker);
    await expect(projection.project({ includeSecrets: true }))
      .rejects.toEqual(new BackupProjectionError("inconsistent"));
    await expect(projection.project({ includeSecrets: false }))
      .resolves.toMatchObject({ mode: "credential-less" });
    await expect(projection.project({ includeSecrets: "yes" as never }))
      .rejects.toEqual(new BackupProjectionError("invalid"));
  });

  it("rejects object-count limit plus one before serialization", async () => {
    const worker = emptyWorker("object-limit");
    const uuid = new UuidV7Generator({ now: () => NOW });
    await worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        for (let index = 0; index < 10_001; index += 1) {
          transaction.run(`
            INSERT INTO services (
              id, slug, name, lifecycle, draft_digest, publication_generation,
              version, created_at, updated_at
            ) VALUES (?, ?, 'Bounded service', 'draft', ?, 0, 1, ?, ?)
          `, [
            uuid.next(),
            `service-${index.toString().padStart(5, "0")}`,
            "b".repeat(64),
            NOW,
            NOW,
          ]);
        }
      }),
    });
    await expect(new PortableBackupProjectionService(worker).project({
      includeSecrets: false,
    })).rejects.toEqual(new BackupProjectionError("too_large"));
  });
});

async function seeded(): Promise<PersistenceWorker> {
  const worker = emptyWorker("seeded");
  await worker.execute({
    run: (database) => database.withOperationalTransaction((transaction) => {
      transaction.run(`
        INSERT INTO users (
          id, email, normalized_email, given_name, family_name, role, status,
          security_epoch, password_policy_version, version, created_at, updated_at
        ) VALUES (?, 'identity-canary@example.org',
          'identity-canary@example.org', 'Identity', 'Canary',
          'superadmin', 'active', 1, 1, 1, ?, ?)
      `, [USER_ID, NOW, NOW]);
      transaction.run(`
        INSERT INTO services (
          id, slug, name, description, documentation_url, lifecycle,
          draft_digest, publication_generation, version, created_at, updated_at
        ) VALUES (?, 'cafe', 'Café Service', 'Portable description',
          'https://docs.example.org/cafe', 'published', ?, 7, 4, ?, ?)
      `, [SERVICE_ID, "a".repeat(64), NOW, NOW]);
      transaction.run(`
        INSERT INTO service_destinations (
          id, service_id, slug, base_url, schemes_json, hosts_json, ports_json,
          tls_verify, version, created_at, updated_at
        ) VALUES (?, ?, 'primary', 'https://api.example.org', '["https"]',
          '[{"kind":"exact","value":"api.example.org"}]', '[443]',
          0, 3, ?, ?)
      `, [DESTINATION_ID, SERVICE_ID, NOW, NOW]);
      transaction.run(`
        INSERT INTO service_admins (
          service_id, user_id, assigned_by_user_id, created_at
        ) VALUES (?, ?, 'ASSIGNMENT-CANARY', ?)
      `, [SERVICE_ID, USER_ID, NOW]);
      transaction.run(`
        INSERT INTO service_groups (
          id, service_id, name, normalized_name, lifecycle, version,
          created_at, updated_at
        ) VALUES (?, ?, 'GROUP-CANARY', 'group-canary', 'active', 1, ?, ?)
      `, [GROUP_ID, SERVICE_ID, NOW, NOW]);
      transaction.run(`
        INSERT INTO service_credentials (
          id, service_id, name, normalized_name, description, usage_kind,
          usage_name, usage_prefix, enforce_header_ownership, status,
          vault_state, vault_locator, vault_generation, last_four,
          value_updated_at, authorization_generation, version, created_at,
          updated_at
        ) VALUES (?, ?, 'Service key', 'service key', 'Portable credential',
          'header', 'X-Service-Key', 'Bearer ', 1, 'configured', 'idle', ?,
          3, 'LEAK', ?, 9, 2, ?, ?)
      `, [CREDENTIAL_ID, SERVICE_ID, LOCATOR, NOW, NOW, NOW]);
      transaction.run(`
        INSERT INTO policies (
          id, service_id, credential_id, name, normalized_name, description,
          operating_mode, lifecycle, evaluation_generation, version,
          created_at, updated_at
        ) VALUES (?, ?, ?, 'Widget reads', 'widget reads',
          'Portable policy', 'deny', 'active', 8, 2, ?, ?)
      `, [POLICY_ID, SERVICE_ID, CREDENTIAL_ID, NOW, NOW]);
      transaction.run(`
        INSERT INTO policy_rules (
          id, service_id, policy_id, name, normalized_name, reason, effect,
          priority, enabled, methods_json, hosts_json, paths_json,
          response_safeguards_json, version, created_at, updated_at
        ) VALUES (?, ?, ?, 'Read widgets', 'read widgets', 'Portable reason',
          'allow', 100, 1, '["GET"]',
          '[{"kind":"exact","value":"api.example.org"}]',
          '[{"kind":"regex","value":"^/widgets$"}]',
          '{"binary_response":{"scan":true,"max_bytes":1024}}',
          2, ?, ?)
      `, [RULE_ID, SERVICE_ID, POLICY_ID, NOW, NOW]);
      transaction.run(`
        INSERT INTO service_principal_assignments (
          id, service_id, selector_kind, user_id, assigned_by_user_id, created_at
        ) VALUES ('018f1f2e-7b3c-7a10-8000-000000000050', ?,
          'user', ?, 'ASSIGNMENT-CANARY', ?)
      `, [SERVICE_ID, USER_ID, NOW]);
    }),
  });
  await worker.execute({
    run: (database) => database.appendRuntimeAudit({
      eventId: "018f1f2e-7b3c-7a10-8000-000000000060",
      occurredAt: NOW,
      eventType: "service_request",
      outcome: "allow",
      category: "service",
      actorType: "oauth_user",
      subjectId: USER_ID,
      subjectLabel: "Identity Canary",
      serviceId: SERVICE_ID,
      serviceLabel: "Café Service",
      destination: "primary",
      action: "service_request",
      method: "GET",
      targetHost: "api.example.org",
      targetPath: "/private/audit-canary",
      source: {},
      details: {},
    }),
  });
  return worker;
}

function emptyWorker(label: string): PersistenceWorker {
  const worker = PersistenceWorker.open({
    databaseFile: join(
      mkdtempSync(join(tmpdir(), `backup-projection-${label}-`)),
      "control.sqlite",
    ),
    productVersion: "test",
    now: () => NOW,
  });
  workers.add(worker);
  return worker;
}
