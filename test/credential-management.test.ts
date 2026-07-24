import { chmodSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ApiKeyRepository,
  ApiKeyService,
  ApiKeyVerifierPool,
} from "../src/apiKeys.js";
import type { ControlAuthenticationContext } from "../src/control/authentication.js";
import { ControlIdempotencyHasher } from "../src/control/idempotency.js";
import {
  CredentialManagementError,
  CredentialManagementRepository,
  CredentialManagementService,
} from "../src/credentialManagement.js";
import {
  CredentialVaultCoordinator,
  type CredentialControlVault,
} from "../src/credentialVaultCoordinator.js";
import { GroupAssignmentRepository } from "../src/groupAssignments.js";
import { IdentityRepository, type IdentityAuditContext } from "../src/identity/repository.js";
import { AlwaysStepUpHandle } from "../src/identity/stepUp.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import { ActiveSelfApiKeyDetector } from "../src/selfApiKeyProtection.js";
import { UuidV7Generator } from "../src/persistence/uuidV7.js";
import {
  ServiceManagementRepository,
  ServiceManagementService,
  ServiceRelationshipRepository,
} from "../src/serviceManagement.js";
import { vaultError } from "../src/vault/errors.js";
import { VaultCapabilityAuthority } from "../src/vault/capabilities.js";
import { VaultBrokerServer } from "../src/vault/broker.js";
import { ControlVaultClient } from "../src/vault/client.js";
import type {
  VaultCredentialBinding,
  VaultRecordMetadata,
} from "../src/vault/recordStore.js";
import { VaultRecordStore } from "../src/vault/recordStore.js";

const NOW = 1_785_000_000_000;
const CORRELATION = "req_12345678-1234-4234-8234-123456789abc";
const workers = new Set<PersistenceWorker>();
const serviceManagers = new Set<ServiceManagementService>();

afterEach(async () => {
  for (const service of serviceManagers) service.close();
  serviceManagers.clear();
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("service credential metadata and selectors", () => {
  it("writes through the real broker without giving the control caller a plaintext resolve path", async () => {
    const fixture = await credentialFixture("real-vault");
    const service = await fixture.service("real-vault-api");
    const created = await fixture.credentials.create(
      fixture.superadmin,
      service.id,
      {
        name: "Broker token",
        placement: { kind: "body", name: "token" },
        selector: { kind: "all" },
      },
      "create-broker-token",
      CORRELATION,
    );
    const directory = mkdtempSync(join(tmpdir(), "credential-real-vault-"));
    chmodSync(directory, 0o700);
    const run = join(directory, "run");
    const storeDirectory = join(directory, "store");
    mkdirSync(run, { mode: 0o700 });
    mkdirSync(storeDirectory, { mode: 0o700 });
    const socketPath = join(run, "vault.sock");
    const keys = {
      data_plane: Buffer.alloc(32, 81),
      control_plane: Buffer.alloc(32, 82),
      backup: Buffer.alloc(32, 83),
    };
    const server = new VaultBrokerServer({
      socketPath,
      socketMode: 0o600,
      callerKeys: keys,
      capabilityAuthority: new VaultCapabilityAuthority({
        resolveKey: Buffer.alloc(32, 84),
        backupKey: Buffer.alloc(32, 85),
      }),
      store: new VaultRecordStore({
        directory: storeDirectory,
        activeRootKey: "root-a",
        rootKeys: new Map([["root-a", Buffer.alloc(32, 86)]]),
        now: () => NOW,
      }),
    });
    await server.listen();
    const control = new ControlVaultClient({
      socketPath,
      key: keys.control_plane,
    });
    try {
      const coordinator = new CredentialVaultCoordinator(
        fixture.worker,
        fixture.repository,
        control,
        () => NOW,
        () => "abcdef12-3456-4789-8abc-def012345678",
      );
      const view = await coordinator.setValue({
        actor: fixture.superadmin,
        serviceId: service.id,
        credentialId: created.credential.id,
        expectedVersion: created.credential.version,
        value: Buffer.from("broker-only-secret-2468"),
        captureLastFour: true,
        correlationId: CORRELATION,
      });
      expect(view).toMatchObject({ status: "configured", lastFour: "2468" });
      expect(JSON.stringify(view)).not.toContain("broker-only-secret");
      expect((control as unknown as { resolveForRequest?: unknown }).resolveForRequest)
        .toBeUndefined();
    } finally {
      control.close();
      await server.close();
    }
  });

  it("coordinates write-only vault values with service-wide binding and safe metadata", async () => {
    const fixture = await credentialFixture("vault-values");
    const service = await fixture.service("vault-api");
    const created = await fixture.credentials.create(
      fixture.superadmin,
      service.id,
      {
        name: "Vault token",
        placement: { kind: "header", name: "Authorization", prefix: "Bearer " },
        selector: { kind: "all" },
      },
      "create-vault-token",
      CORRELATION,
    );
    const vault = new FakeCredentialVault();
    const locator = "12345678-1234-4234-8234-123456789abc";
    const coordinator = new CredentialVaultCoordinator(
      fixture.worker,
      fixture.repository,
      vault,
      () => NOW,
      () => locator,
    );
    const configured = await coordinator.setValue({
      actor: fixture.superadmin,
      serviceId: service.id,
      credentialId: created.credential.id,
      expectedVersion: created.credential.version,
      value: Buffer.from("first-secret-1234"),
      captureLastFour: true,
      correlationId: CORRELATION,
    });
    expect(configured).toMatchObject({
      status: "configured",
      lastFour: "1234",
      valueUpdatedAt: NOW,
    });
    expect(configured).not.toHaveProperty("vaultLocator");
    expect(vault.lastBinding).toEqual({
      serviceId: service.id,
      destinationId: service.id,
      credentialId: created.credential.id,
    });
    expect(vault).not.toHaveProperty("resolveForRequest");

    vault.throwAfterApply = true;
    const replaced = await coordinator.setValue({
      actor: fixture.superadmin,
      serviceId: service.id,
      credentialId: created.credential.id,
      expectedVersion: configured.version,
      value: Buffer.from("replacement-5678"),
      captureLastFour: true,
      correlationId: CORRELATION,
    });
    expect(replaced).toMatchObject({ status: "configured", lastFour: "5678" });

    vault.throwAfterApply = true;
    const removed = await coordinator.deleteValue({
      actor: fixture.superadmin,
      serviceId: service.id,
      credentialId: created.credential.id,
      expectedVersion: replaced.version,
      archive: false,
      correlationId: CORRELATION,
    });
    expect(removed).toMatchObject({ status: "unconfigured" });
    expect(removed).not.toHaveProperty("lastFour");
    expect(await coordinator.reconcilePending()).toEqual({
      reconciled: 0,
      unresolved: 0,
    });

    const restored = await coordinator.setValue({
      actor: fixture.superadmin,
      serviceId: service.id,
      credentialId: created.credential.id,
      expectedVersion: removed.version,
      value: Buffer.from("restored"),
      correlationId: CORRELATION,
    });
    const disabled = await fixture.credentials.disable(
      fixture.superadmin,
      service.id,
      created.credential.id,
      restored.version,
      { justification: "Temporarily pause downstream access." },
      "disable-vault-token",
      CORRELATION,
    );
    expect(disabled.credential.status).toBe("disabled");
    const enabled = await coordinator.enable({
      actor: fixture.superadmin,
      serviceId: service.id,
      credentialId: created.credential.id,
      expectedVersion: disabled.credential.version,
      correlationId: CORRELATION,
    });
    expect(enabled.status).toBe("configured");
    const archived = await coordinator.deleteValue({
      actor: fixture.superadmin,
      serviceId: service.id,
      credentialId: created.credential.id,
      expectedVersion: enabled.version,
      archive: true,
      correlationId: CORRELATION,
    });
    expect(archived).toMatchObject({ status: "archived" });
    expect(archived.selector).toBeUndefined();
  });

  it("rejects active management keys generally and binds explicit approval to one vault generation", async () => {
    const fixture = await credentialFixture("self-key");
    const service = await fixture.service("self-key-api");
    const created = await fixture.credentials.create(
      fixture.superadmin,
      service.id,
      {
        name: "Recursive authority",
        placement: {
          kind: "header",
          name: "Authorization",
          prefix: "Bearer ",
        },
        selector: { kind: "all" },
      },
      "create-self-key-credential",
      CORRELATION,
    );
    const keyRepository = new ApiKeyRepository(fixture.worker, () => NOW);
    const apiKeys = new ApiKeyService(keyRepository, {
      now: () => NOW,
      uuid: () => "018f1f2e-7b3c-7a10-8000-000000000099",
      random: (size) => Buffer.alloc(size, size === 12 ? 91 : 92),
    });
    const active = await apiKeys.create(fixture.superadmin, {
      nickname: "Recursive deploy key",
      apiRole: "system",
      expiration: { policy: "forever" },
    }, CORRELATION);
    const detector = await ActiveSelfApiKeyDetector.create(
      keyRepository,
      new ApiKeyVerifierPool(),
    );
    const vault = new FakeCredentialVault();
    const coordinator = new CredentialVaultCoordinator(
      fixture.worker,
      fixture.repository,
      vault,
      () => NOW,
      () => "22345678-1234-4234-8234-123456789abc",
      undefined,
      detector,
      {
        withConsumedProof: async (_handle, auditInput, mutation) =>
          fixture.worker.execute({
            run: (database) => database.withGeneratedAdministrativeAudit(
              (transaction) => ({
                value: mutation(transaction),
                auditInput,
              }),
            ),
          }),
      },
    );

    await expect(coordinator.setValue({
      actor: fixture.superadmin,
      serviceId: service.id,
      credentialId: created.credential.id,
      expectedVersion: created.credential.version,
      value: Buffer.from(active.oneTimeKey),
      correlationId: CORRELATION,
      source: "127.0.0.1",
    })).rejects.toEqual(new CredentialManagementError("active_self_api_key"));
    expect(vault.records.size).toBe(0);

    await expect(coordinator.setApprovedSelfApiKeyValue({
      actor: fixture.superadmin,
      serviceId: service.id,
      credentialId: created.credential.id,
      expectedVersion: created.credential.version,
      value: Buffer.from(`Bearer ${active.oneTimeKey}`),
      justification: "A wrapped value must not inherit explicit approval.",
      correlationId: CORRELATION,
      source: "127.0.0.2",
      stepUpProof: new AlwaysStepUpHandle(
        "018f1f2e-7b3c-7a10-8000-000000000097",
        "018f1f2e-7b3c-7a10-8000-000000000096",
        fixture.superadmin.principalId,
      ),
    })).rejects.toEqual(new CredentialManagementError("invalid_request"));
    expect(vault.records.size).toBe(0);

    const approved = await coordinator.setApprovedSelfApiKeyValue({
      actor: fixture.superadmin,
      serviceId: service.id,
      credentialId: created.credential.id,
      expectedVersion: created.credential.version,
      value: Buffer.from(active.oneTimeKey),
      captureLastFour: true,
      justification: "Required recursive deployment integration.",
      correlationId: CORRELATION,
      source: "127.0.0.3",
      stepUpProof: new AlwaysStepUpHandle(
        "018f1f2e-7b3c-7a10-8000-000000000095",
        "018f1f2e-7b3c-7a10-8000-000000000094",
        fixture.superadmin.principalId,
      ),
    });
    expect(approved).toMatchObject({
      credential: {
        status: "configured",
        lastFour: active.oneTimeKey.slice(-4),
      },
      approval: {
        apiKeyId: active.apiKey.id,
        nickname: "Recursive deploy key",
        lastFour: active.oneTimeKey.slice(-4),
        vaultGeneration: 1,
      },
    });
    await expect(selfApproval(fixture.worker, created.credential.id)).resolves
      .toMatchObject({
        api_key_id: active.apiKey.id,
        vault_generation: 1,
        approved_by_user_id: fixture.superadmin.principalId,
        nickname_snapshot: "Recursive deploy key",
        last_four_snapshot: active.oneTimeKey.slice(-4),
      });
    expect(JSON.stringify(await selfApproval(
      fixture.worker,
      created.credential.id,
    ))).not.toContain(active.oneTimeKey);

    const replaced = await coordinator.setValue({
      actor: fixture.superadmin,
      serviceId: service.id,
      credentialId: created.credential.id,
      expectedVersion: approved.credential.version,
      value: Buffer.from("ordinary-downstream-value"),
      correlationId: CORRELATION,
      source: "127.0.0.4",
    });
    expect(replaced.status).toBe("configured");
    await expect(selfApproval(fixture.worker, created.credential.id)).resolves
      .toBeUndefined();
  });

  it("rolls back definite create failure and leaves ambiguous vault work non-usable", async () => {
    const fixture = await credentialFixture("vault-failure");
    const service = await fixture.service("failure-api");
    const created = await fixture.credentials.create(
      fixture.superadmin,
      service.id,
      {
        name: "Failing token",
        placement: { kind: "query", name: "token" },
        selector: { kind: "all" },
      },
      "create-failing-token",
      CORRELATION,
    );
    const vault = new FakeCredentialVault();
    vault.failBeforeApply = true;
    const coordinator = new CredentialVaultCoordinator(
      fixture.worker,
      fixture.repository,
      vault,
      () => NOW,
      () => "87654321-4321-4321-8321-cba987654321",
    );
    await expect(coordinator.setValue({
      actor: fixture.superadmin,
      serviceId: service.id,
      credentialId: created.credential.id,
      expectedVersion: created.credential.version,
      value: Buffer.from("never-written"),
      correlationId: CORRELATION,
    })).rejects.toEqual(new CredentialManagementError("unavailable"));
    expect(await fixture.credentials.credential(
      fixture.superadmin,
      service.id,
      created.credential.id,
    )).toMatchObject({ status: "unconfigured" });
    expect(await coordinator.reconcilePending()).toEqual({
      reconciled: 0,
      unresolved: 0,
    });

    vault.failBeforeApply = false;
    vault.metadataUnavailable = true;
    vault.throwAfterApply = true;
    await expect(coordinator.setValue({
      actor: fixture.superadmin,
      serviceId: service.id,
      credentialId: created.credential.id,
      expectedVersion: (await fixture.credentials.credential(
        fixture.superadmin,
        service.id,
        created.credential.id,
      )).version,
      value: Buffer.from("ambiguous"),
      correlationId: CORRELATION,
    })).rejects.toEqual(new CredentialManagementError("unavailable"));
    expect(await fixture.repository.privateCredential(
      fixture.superadmin,
      service.id,
      created.credential.id,
    )).toMatchObject({
      status: "unconfigured",
      vaultState: "reconcile",
    });
    expect((await fixture.services.validate(
      fixture.superadmin,
      service.id,
      CORRELATION,
    )).issues).toContainEqual({
      code: "credential_reconciliation_required",
      pointer: "/credentials",
    });
  });

  it("creates, reads, and edits only safe credential metadata", async () => {
    const fixture = await credentialFixture("metadata");
    const service = await fixture.service("managed-api");
    const created = await fixture.credentials.create(
      fixture.superadmin,
      service.id,
      {
        name: " API token ",
        description: "Primary automation token.",
        placement: {
          kind: "header",
          name: "X-API-Key",
          prefix: "Bearer ",
          enforce_header_ownership: true,
        },
        selector: { kind: "all" },
      },
      "create-credential-0001",
      CORRELATION,
    );
    expect(created).toMatchObject({
      replayed: false,
      credential: {
        name: "API token",
        status: "unconfigured",
        placement: {
          kind: "header",
          name: "X-API-Key",
          prefix: "Bearer ",
          enforceHeaderOwnership: true,
        },
        selector: { kind: "all", groupIds: [], userIds: [] },
        version: 1,
      },
    });
    expect(created.credential).not.toHaveProperty("vaultLocator");
    expect(created.credential).not.toHaveProperty("vaultGeneration");

    const replay = await fixture.credentials.create(
      fixture.superadmin,
      service.id,
      {
        name: " API token ",
        description: "Primary automation token.",
        placement: {
          kind: "header",
          name: "X-API-Key",
          prefix: "Bearer ",
          enforce_header_ownership: true,
        },
        selector: { kind: "all" },
      },
      "create-credential-0001",
      CORRELATION,
    );
    expect(replay).toMatchObject({
      replayed: true,
      credential: { id: created.credential.id },
    });

    const updated = await fixture.credentials.update(
      fixture.superadmin,
      service.id,
      created.credential.id,
      created.credential.version,
      {
        name: "API token v2",
        placement: { kind: "query", name: "api_key" },
      },
      CORRELATION,
    );
    expect(updated).toMatchObject({
      name: "API token v2",
      placement: {
        kind: "query",
        name: "api_key",
        enforceHeaderOwnership: false,
      },
      status: "unconfigured",
      version: 2,
    });
    expect(await fixture.credentials.credentials(fixture.superadmin, service.id))
      .toEqual([updated]);
  });

  it("rejects unsafe/open metadata, stale writes, duplicate names, and unassigned scope", async () => {
    const fixture = await credentialFixture("negative");
    const service = await fixture.service("safe-api");
    const outsider = await fixture.identity("outsider@example.org", "admin", "active");
    const create = (body: unknown, key: string) => fixture.credentials.create(
      fixture.superadmin,
      service.id,
      body,
      key,
      CORRELATION,
    );
    for (const [body, key] of [
      [{
        name: "Authority",
        placement: { kind: "header", name: "Host" },
        selector: { kind: "all" },
      }, "invalid-host-header"],
      [{
        name: "Unconfirmed",
        placement: { kind: "body", name: "password" },
        selector: {
          kind: "users",
          user_ids: [fixture.superadmin.principalId],
          direct_assignment_confirmed: false,
        },
      }, "invalid-unconfirmed"],
      [{
        name: "Open",
        placement: { kind: "query", name: "key" },
        selector: { kind: "all" },
        secret: "must-not-be-accepted",
      }, "invalid-open"],
    ] as const) {
      await expect(create(body, key))
        .rejects.toEqual(new CredentialManagementError("invalid_request"));
    }

    const created = await create({
      name: "Unique",
      placement: { kind: "header", name: "Authorization" },
      selector: { kind: "all" },
    }, "valid-unique-0001");
    await expect(create({
      name: "unique",
      placement: { kind: "header", name: "X-Key" },
      selector: { kind: "all" },
    }, "duplicate-unique-0001")).rejects.toEqual(
      new CredentialManagementError("conflict"),
    );
    await expect(fixture.credentials.update(
      fixture.superadmin,
      service.id,
      created.credential.id,
      created.credential.version + 1,
      {
        name: "Stale",
        placement: { kind: "header", name: "X-Key" },
      },
      CORRELATION,
    )).rejects.toEqual(new CredentialManagementError("stale"));
    await expect(fixture.credentials.credentials(
      browser(outsider.id, "admin"),
      service.id,
    )).rejects.toEqual(new CredentialManagementError("not_found"));
  });

  it("intersects service and every credential selector and rejects cross-service groups", async () => {
    const fixture = await credentialFixture("selectors");
    const service = await fixture.service("selector-api");
    const otherService = await fixture.service("other-api");
    const user = await fixture.identity("assigned@example.org", "user", "active");
    const other = await fixture.identity("other@example.org", "user", "active");
    const group = await fixture.group(service.id, "Operators", [user.id]);
    const crossGroup = await fixture.group(otherService.id, "Other", [user.id]);
    await fixture.assignService(service.id, {
      kind: "explicit",
      groupIds: [group.id],
      userIds: [other.id],
    });

    const first = await fixture.credentials.create(
      fixture.superadmin,
      service.id,
      {
        name: "Group credential",
        placement: { kind: "header", name: "X-Group-Key" },
        selector: { kind: "groups", group_ids: [group.id] },
      },
      "create-group-credential",
      CORRELATION,
    );
    const second = await fixture.credentials.create(
      fixture.superadmin,
      service.id,
      {
        name: "Direct credential",
        placement: { kind: "body", name: "password" },
        selector: {
          kind: "users",
          user_ids: [other.id],
          direct_assignment_confirmed: true,
        },
      },
      "create-direct-credential",
      CORRELATION,
    );
    await fixture.markConfigured(first.credential.id);
    await fixture.markConfigured(second.credential.id);

    expect(await fixture.credentials.authorizes(
      user.id,
      service.id,
      [first.credential.id],
    )).toBe(true);
    expect(await fixture.credentials.authorizes(
      user.id,
      service.id,
      [second.credential.id],
    )).toBe(false);
    expect(await fixture.credentials.authorizes(
      other.id,
      service.id,
      [second.credential.id],
    )).toBe(true);
    expect(await fixture.credentials.authorizes(
      other.id,
      service.id,
      [first.credential.id, second.credential.id],
    )).toBe(false);

    const configuredFirst = await fixture.credentials.credential(
      fixture.superadmin,
      service.id,
      first.credential.id,
    );
    await expect(fixture.credentials.replaceAssignments(
      fixture.superadmin,
      service.id,
      first.credential.id,
      configuredFirst.version,
      { kind: "groups", group_ids: [crossGroup.id] },
      "cross-service-selector",
      CORRELATION,
    )).rejects.toEqual(new CredentialManagementError("not_found"));
  });

  it("clones and copies without private material, then archives before deletion", async () => {
    const fixture = await credentialFixture("lifecycle");
    const service = await fixture.service("lifecycle-api");
    const created = await fixture.credentials.create(
      fixture.superadmin,
      service.id,
      {
        name: "Source",
        description: "Safe metadata.",
        placement: {
          kind: "header",
          name: "Authorization",
          prefix: "Bearer ",
        },
        selector: { kind: "all" },
      },
      "create-source-credential",
      CORRELATION,
    );
    const cloned = await fixture.credentials.clone(
      fixture.superadmin,
      service.id,
      created.credential.id,
      { name: "Clone" },
      "clone-credential-0001",
      CORRELATION,
    );
    expect(cloned.credential).toMatchObject({
      name: "Clone",
      status: "unconfigured",
      selector: { kind: "all" },
    });
    expect(cloned.credential).not.toHaveProperty("lastFour");
    expect(cloned.credential).not.toHaveProperty("valueUpdatedAt");

    const document = await fixture.credentials.copy(
      fixture.superadmin,
      service.id,
      created.credential.id,
    );
    const serialized = JSON.stringify(document);
    expect(serialized).not.toMatch(
      /"(?:secret|locator|generation|last_four|ciphertext|source|value)"\s*:/i,
    );
    const imported = await fixture.credentials.import(
      fixture.superadmin,
      service.id,
      {
        ...document,
        credential: { ...document.credential, name: "Imported" },
      },
      "import-credential-001",
      CORRELATION,
    );
    expect(imported.credential).toMatchObject({
      name: "Imported",
      status: "unconfigured",
    });
    await expect(fixture.credentials.import(
      fixture.superadmin,
      service.id,
      {
        ...document,
        credential: {
          ...document.credential,
          name: "Unsafe import",
          value: "never-accepted",
        },
      },
      "import-credential-unsafe",
      CORRELATION,
    )).rejects.toEqual(new CredentialManagementError("invalid_request"));

    const archived = await fixture.credentials.archiveUnconfigured(
      fixture.superadmin,
      service.id,
      created.credential.id,
      created.credential.version,
      { justification: "No longer needed." },
      "archive-credential-001",
      CORRELATION,
    );
    expect(archived.credential).toMatchObject({ status: "archived", version: 2 });
    expect(archived.credential.selector).toBeUndefined();
    await expect(fixture.credentials.update(
      fixture.superadmin,
      service.id,
      created.credential.id,
      archived.credential.version,
      {
        name: "Cannot edit",
        placement: { kind: "header", name: "X-Key" },
      },
      CORRELATION,
    )).rejects.toEqual(new CredentialManagementError("conflict"));
    await expect(fixture.credentials.deleteArchived(
      fixture.superadmin,
      service.id,
      created.credential.id,
      archived.credential.version,
      { justification: "Remove archived metadata." },
      "delete-credential-001",
      CORRELATION,
    )).resolves.toMatchObject({
      credentialId: created.credential.id,
      deleted: true,
      replayed: false,
    });
    await expect(fixture.credentials.credential(
      fixture.superadmin,
      service.id,
      created.credential.id,
    )).rejects.toEqual(new CredentialManagementError("not_found"));
    expect(await fixture.deletionInvalidations(created.credential.id)).toBe(1);
  });
});

async function credentialFixture(label: string) {
  const worker = PersistenceWorker.open({
    databaseFile: join(
      mkdtempSync(join(tmpdir(), `secretsauce-credentials-${label}-`)),
      "control.sqlite",
    ),
    productVersion: "test",
    now: () => NOW,
  });
  workers.add(worker);
  const identities = new IdentityRepository(worker, { now: () => NOW });
  const superadminUser = await identities.createLocalIdentity({
    profile: {
      email: `${label}-superadmin@example.org`,
      givenName: "Super",
      familyName: "Admin",
    },
    role: "superadmin",
    status: "active",
  }, audit());
  const relationships = new ServiceRelationshipRepository(worker);
  const services = new ServiceManagementService(
    new ServiceManagementRepository(worker),
    relationships,
    new ControlIdempotencyHasher(Buffer.alloc(32, 71)),
    Buffer.alloc(32, 72),
    { now: () => NOW },
  );
  serviceManagers.add(services);
  const hasher = new ControlIdempotencyHasher(Buffer.alloc(32, 73));
  const repository = new CredentialManagementRepository(worker, () => NOW);
  const credentials = new CredentialManagementService(repository, hasher, () => NOW);
  const groups = new GroupAssignmentRepository(worker, () => NOW);
  const superadmin = browser(superadminUser.id, "superadmin");
  const uuid = new UuidV7Generator({ now: () => NOW });
  return {
    worker,
    identities,
    services,
    credentials,
    repository,
    groups,
    superadmin,
    identity: (
      email: string,
      role: "user" | "admin" | "superadmin",
      status: "active" | "suspended",
    ) => identities.createLocalIdentity({
      profile: { email, givenName: "Example", familyName: "User" },
      role,
      status,
    }, audit()),
    service: async (slug: string) => (await services.create(
      superadmin,
      { slug, name: slug },
      `create-${slug}-0001`,
      CORRELATION,
    )).service,
    group: async (serviceId: string, name: string, userIds: string[]) => {
      const groupId = uuid.next();
      await groups.createGroup({
        actor: superadmin,
        serviceId,
        groupId,
        name,
        correlationId: CORRELATION,
        idempotency: idempotency(
          hasher,
          superadmin.principalId,
          "groups.create",
          `create-${serviceId}-${name}`,
          { serviceId, name },
        ),
      });
      const group = await groups.group(superadmin, serviceId, groupId);
      await groups.replaceMembers({
        actor: superadmin,
        serviceId,
        groupId,
        expectedVersion: group.version,
        userIds,
        correlationId: CORRELATION,
        idempotency: idempotency(
          hasher,
          superadmin.principalId,
          "groups.members.replace",
          `members-${groupId}`,
          { userIds },
        ),
      });
      return groups.group(superadmin, serviceId, groupId);
    },
    assignService: async (
      serviceId: string,
      selector: {
        kind: "explicit";
        groupIds: string[];
        userIds: string[];
      },
    ) => {
      const state = await groups.assignments(superadmin, serviceId);
      return groups.replaceAssignments({
        actor: superadmin,
        serviceId,
        expectedVersion: state.version,
        selector,
        correlationId: CORRELATION,
        idempotency: idempotency(
          hasher,
          superadmin.principalId,
          "services.assignments.replace",
          `assign-${serviceId}`,
          selector,
        ),
      });
    },
    markConfigured: (credentialId: string) => worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(`
          UPDATE service_credentials
          SET status = 'configured', vault_locator = ?,
            vault_generation = 1, value_updated_at = ?, version = version + 1,
            updated_at = ?
          WHERE id = ?
        `, [
          "12345678-1234-4234-8234-123456789abc",
          NOW,
          NOW,
          credentialId,
        ]);
        return undefined;
      }),
    }),
    deletionInvalidations: (credentialId: string) => worker.execute({
      run: (database) => database.read((query) => query.get<{ count: number }>(`
        SELECT count(*) AS count FROM credential_invalidation_events
        WHERE credential_id = ? AND reason = 'delete'
      `, [credentialId])!.count),
    }),
  };
}

class FakeCredentialVault implements CredentialControlVault {
  readonly records = new Map<string, VaultRecordMetadata>();
  lastBinding: VaultCredentialBinding | undefined;
  throwAfterApply = false;
  failBeforeApply = false;
  metadataUnavailable = false;

  async create(input: {
    binding: VaultCredentialBinding;
    secret: Uint8Array;
    locator: string;
    captureLastFour?: boolean;
  }) {
    this.lastBinding = input.binding;
    if (this.failBeforeApply) throw vaultError("vault_record_invalid");
    const metadata = this.metadataFor(input.secret, 1, input.captureLastFour);
    this.records.set(input.locator, metadata);
    if (this.throwAfterApply) {
      this.throwAfterApply = false;
      throw vaultError("vault_store_unavailable");
    }
    return { locator: input.locator, metadata };
  }

  async replace(input: {
    binding: VaultCredentialBinding;
    secret: Uint8Array;
    locator: string;
    generation: number;
    captureLastFour?: boolean;
  }) {
    this.lastBinding = input.binding;
    if (this.failBeforeApply) throw vaultError("vault_record_invalid");
    const current = this.records.get(input.locator);
    if (current?.generation !== input.generation) {
      throw vaultError("vault_record_conflict");
    }
    const metadata = this.metadataFor(
      input.secret,
      input.generation + 1,
      input.captureLastFour,
    );
    this.records.set(input.locator, metadata);
    if (this.throwAfterApply) {
      this.throwAfterApply = false;
      throw vaultError("vault_store_unavailable");
    }
    return metadata;
  }

  async delete(
    locator: string,
    generation: number,
    binding: VaultCredentialBinding,
  ) {
    this.lastBinding = binding;
    if (this.failBeforeApply) throw vaultError("vault_record_invalid");
    const current = this.records.get(locator);
    if (current?.generation !== generation) throw vaultError("vault_record_conflict");
    this.records.delete(locator);
    if (this.throwAfterApply) {
      this.throwAfterApply = false;
      throw vaultError("vault_store_unavailable");
    }
    return { deleted: true as const };
  }

  async metadata(locator: string, binding: VaultCredentialBinding) {
    this.lastBinding = binding;
    if (this.metadataUnavailable) throw vaultError("vault_store_unavailable");
    const metadata = this.records.get(locator);
    if (metadata === undefined) throw vaultError("vault_record_not_found");
    return metadata;
  }

  private metadataFor(
    secret: Uint8Array,
    generation: number,
    captureLastFour: boolean | undefined,
  ): VaultRecordMetadata {
    const text = Buffer.from(secret).toString("utf8");
    return {
      status: "configured",
      generation,
      sizeClass: "up_to_32_bytes",
      ...(captureLastFour === true ? { lastFour: text.slice(-4) } : {}),
      createdAt: NOW,
      updatedAt: NOW,
    };
  }
}

function idempotency(
  hasher: ControlIdempotencyHasher,
  principalId: string,
  routeId: string,
  key: string,
  body: unknown,
) {
  return {
    keyHash: hasher.keyHash({ key, principalId, routeId }),
    principalId,
    routeId,
    requestDigest: hasher.requestDigest(body),
  };
}

function selfApproval(worker: PersistenceWorker, credentialId: string) {
  return worker.execute({
    run: (database) => database.read((query) => query.get<{
      api_key_id: string;
      vault_generation: number;
      approved_by_user_id: string;
      nickname_snapshot: string;
      last_four_snapshot: string;
      justification_digest: string;
    }>(
      "SELECT * FROM credential_self_api_key_approvals WHERE credential_id = ?",
      [credentialId],
    )),
  });
}

function browser(
  principalId: string,
  role: "user" | "admin" | "superadmin",
): ControlAuthenticationContext {
  return { method: "browser_session", principalId, role };
}

function audit(): IdentityAuditContext {
  return {
    actor: {
      type: "local_cli",
      label: "fixture",
      authenticationMethod: "host_terminal",
    },
    correlationId: CORRELATION,
    source: { category: "identity" },
  };
}
