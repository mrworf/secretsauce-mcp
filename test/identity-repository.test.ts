import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { IdentityError } from "../src/identity/errors.js";
import {
  IdentityRepository,
  type IdentityAuditContext,
} from "../src/identity/repository.js";
import { isUuidV7 } from "../src/persistence/uuidV7.js";
import { PersistenceWorker } from "../src/persistence/worker.js";

const workers = new Set<PersistenceWorker>();
const NOW = 1_785_000_000_000;

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("transactional identity repository", () => {
  it("creates durable UUID identities and keeps IDs stable across normalized profile changes", async () => {
    const file = databasePath("profile");
    let worker = open(file);
    let identities = new IdentityRepository(worker, { now: () => NOW });
    const created = await identities.createLocalIdentity({
      profile: {
        email: "Person@BÜCHER.Example",
        givenName: " First ",
        familyName: " Person ",
      },
      role: "admin",
      status: "invited",
    }, audit());

    expect(isUuidV7(created.id)).toBe(true);
    expect(created).toMatchObject({
      normalizedEmail: "person@xn--bcher-kva.example",
      role: "admin",
      status: "invited",
      securityEpoch: 1,
      version: 1,
      mcpEligible: false,
    });
    expect(await identities.localAuthenticatorState(created.id)).toMatchObject({
      userId: created.id,
      passwordState: "not_configured",
      totpState: "not_configured",
      version: 1,
    });

    const updated = await identities.updateProfile(created.id, 1, {
      email: "renamed@example.org",
      givenName: "Renamed",
      familyName: "",
    }, audit());
    expect(updated).toMatchObject({
      id: created.id,
      normalizedEmail: "renamed@example.org",
      securityEpoch: 2,
      version: 2,
      mcpEligible: false,
    });

    await worker.close();
    workers.delete(worker);
    worker = open(file);
    identities = new IdentityRepository(worker, { now: () => NOW + 1 });
    expect(await identities.identity(created.id)).toEqual(updated);

    const audits = await worker.execute({
      run: (database) => database.read((query) => query.get<{ events: string }>(`
        SELECT json_group_array(json_object(
          'target', target_label_snapshot,
          'changes', changes_json
        )) AS events
        FROM administrative_audit_events
      `)?.events ?? "[]"),
    });
    expect(audits).not.toContain("Person@");
    expect(audits).not.toContain("renamed@example.org");
    expect(audits).toContain(`user:${created.id}`);
  });

  it("enforces normalized email uniqueness and rolls mutations back when audit is invalid", async () => {
    const worker = open(databasePath("unique"));
    const identities = new IdentityRepository(worker, { now: () => NOW });
    const first = await identities.createLocalIdentity({
      profile: profile("First@Example.org"),
      role: "user",
      status: "invited",
    }, audit());

    await expect(identities.createLocalIdentity({
      profile: profile(" first@example.ORG "),
      role: "admin",
      status: "invited",
    }, audit())).rejects.toEqual(new IdentityError("identity_conflict"));

    await expect(identities.updateProfile(
      first.id,
      first.version,
      profile("changed@example.org"),
      { ...audit(), correlationId: "raw-secret-invalid-correlation" },
    )).rejects.toMatchObject({ code: "invalid_audit_event" });
    expect(await identities.identity(first.id)).toEqual(first);
    await expect(identities.updateProfile(
      first.id,
      99,
      profile("changed@example.org"),
      audit(),
    )).rejects.toEqual(new IdentityError("identity_stale"));
  });

  it("maps exact provider subjects to UUIDs and never falls back to email", async () => {
    const worker = open(databasePath("provider"));
    const identities = new IdentityRepository(worker, { now: () => NOW });
    const first = await identities.createLocalIdentity({
      profile: profile("match@example.org"),
      role: "user",
      status: "invited",
    }, audit());
    const second = await identities.createLocalIdentity({
      profile: profile("other@example.org"),
      role: "user",
      status: "invited",
    }, audit());
    const provider = {
      providerId: "workforce",
      issuer: "https://id.example.org",
      subject: "immutable-subject",
    };

    const link = await identities.linkProvider(first.id, provider, audit());
    expect(link).toMatchObject({ userId: first.id, ...provider });
    expect(await identities.findByProvider(provider)).toMatchObject({ id: first.id });
    expect(await identities.findByProvider({
      ...provider,
      subject: "unknown-subject",
    })).toBeUndefined();
    expect(await identities.updateProfile(first.id, first.version, {
      email: "new@example.org",
      givenName: "",
      familyName: "",
    }, audit())).toMatchObject({ id: first.id });
    expect(await identities.findByProvider(provider)).toMatchObject({ id: first.id });

    await expect(identities.linkProvider(second.id, provider, audit()))
      .rejects.toEqual(new IdentityError("identity_conflict"));
    await expect(identities.findByProvider({
      ...provider,
      subject: "not-linked",
      email: "new@example.org",
    })).rejects.toEqual(new IdentityError("invalid_provider_identity"));
  });

  it("applies valid lifecycle changes and transactionally protects the last active superadmin", async () => {
    const worker = open(databasePath("lifecycle"));
    const identities = new IdentityRepository(worker, { now: () => NOW });
    const first = await identities.createLocalIdentity({
      profile: profile("first@example.org"),
      role: "superadmin",
      status: "active",
    }, audit());
    await expect(identities.changeStatus(first.id, first.version, "suspended", audit()))
      .rejects.toEqual(new IdentityError("last_active_superadmin"));
    await expect(identities.changeRole(first.id, first.version, "admin", audit()))
      .rejects.toEqual(new IdentityError("last_active_superadmin"));

    const second = await identities.createLocalIdentity({
      profile: profile("second@example.org"),
      role: "superadmin",
      status: "active",
    }, audit());
    const suspended = await identities.changeStatus(first.id, first.version, "suspended", audit());
    expect(suspended).toMatchObject({
      status: "suspended",
      version: 2,
      securityEpoch: 2,
    });
    await expect(identities.changeRole(second.id, second.version, "admin", audit()))
      .rejects.toEqual(new IdentityError("last_active_superadmin"));

    const invited = await identities.createLocalIdentity({
      profile: profile("third@example.org"),
      role: "user",
      status: "invited",
    }, audit());
    const enrollment = await identities.changeStatus(
      invited.id,
      invited.version,
      "enrollment_required",
      audit(),
    );
    const active = await identities.changeStatus(
      invited.id,
      enrollment.version,
      "active",
      audit(),
    );
    expect(active).toMatchObject({ status: "active", version: 3, securityEpoch: 3 });
    await expect(identities.changeStatus(active.id, active.version, "invited", audit()))
      .rejects.toEqual(new IdentityError("invalid_identity_transition"));
    await expect(identities.changeRole(active.id, active.version, "user", audit()))
      .rejects.toEqual(new IdentityError("invalid_identity_transition"));
  });

  it("rejects malformed IDs, versions, roles, and missing provider targets", async () => {
    const worker = open(databasePath("malformed"));
    const identities = new IdentityRepository(worker, { now: () => NOW });
    await expect(identities.identity("not-a-uuid"))
      .rejects.toEqual(new IdentityError("identity_not_found"));
    await expect(identities.createLocalIdentity({
      profile: profile("one@example.org"),
      role: "owner" as never,
      status: "active",
    }, audit())).rejects.toEqual(new IdentityError("invalid_identity_transition"));
    await expect(identities.linkProvider(
      "018f1f2e-7b3c-7a10-8000-000000000099",
      {
        providerId: "workforce",
        issuer: "https://id.example.org",
        subject: "one",
      },
      audit(),
    )).rejects.toEqual(new IdentityError("identity_not_found"));
  });
});

function profile(email: string) {
  return { email, givenName: "", familyName: "" };
}

function audit(): IdentityAuditContext {
  return {
    actor: {
      type: "local_cli",
      label: "host operator",
      authenticationMethod: "host_terminal",
    },
    correlationId: "req_8ca2d86c-541c-4484-bcc0-feebb54f6311",
    source: { category: "identity", client: "repository-test" },
  };
}

function open(databaseFile: string): PersistenceWorker {
  const worker = PersistenceWorker.open({
    databaseFile,
    productVersion: "0.1.0-test",
    now: () => NOW,
  });
  workers.add(worker);
  return worker;
}

function databasePath(name: string): string {
  return join(mkdtempSync(join(tmpdir(), `secretsauce-identity-${name}-`)), "control.sqlite");
}
