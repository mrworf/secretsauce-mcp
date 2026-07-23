import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { GatewayConfig } from "../src/types.js";
import {
  runIdentityBootstrapCli,
  type IdentityBootstrapIo,
} from "../src/identity/bootstrapCli.js";
import { IdentityError } from "../src/identity/errors.js";
import { IdentityRepository } from "../src/identity/repository.js";
import { PersistenceWorker } from "../src/persistence/worker.js";

const NOW = 1_785_000_000_000;
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("host-local identity bootstrap", () => {
  it("creates exactly one enrollment-pending superadmin with a sanitized break-glass audit", async () => {
    const databaseFile = databasePath("success");
    const io = fakeIo([
      " Initial@BÜCHER.Example ",
      " Initial ",
      " Operator ",
      "YES",
    ]);
    const marker = "configured-audit-marker";
    const exitCode = await runIdentityBootstrapCli([], { CONFIG_PATH: "/config/example.yaml" }, io, {
      loadConfiguration: () => fakeConfig(databaseFile, marker),
      now: () => NOW,
      osActor: () => `operator ${marker}`,
    });

    expect(exitCode).toBe(0);
    expect(io.errors).toEqual([]);
    expect(io.output).toHaveLength(1);
    const output = JSON.parse(io.output[0]!) as Record<string, unknown>;
    expect(output).toMatchObject({
      status: "enrollment_required",
      role: "superadmin",
      enrollment: "pending",
    });
    expect(output.user_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(io.output.join("")).not.toContain("Initial@");
    expect(io.output.join("")).not.toContain(marker);
    expect(statSync(databaseFile).mode & 0o777).toBe(0o600);

    const worker = open(databaseFile);
    const state = await worker.execute({
      run: (database) => database.read((query) => ({
        user: query.get<Record<string, unknown>>(
          "SELECT * FROM users WHERE id = ?",
          [String(output.user_id)],
        ),
        authenticator: query.get<Record<string, unknown>>(
          "SELECT * FROM local_authenticator_states WHERE user_id = ?",
          [String(output.user_id)],
        ),
        marker: query.get<Record<string, unknown>>(
          "SELECT * FROM identity_bootstrap WHERE singleton = 1",
        ),
        audit: query.get<Record<string, unknown>>(
          "SELECT * FROM administrative_audit_events WHERE action = 'identity.bootstrap'",
        ),
      })),
    });
    expect(state.user).toMatchObject({
      role: "superadmin",
      status: "enrollment_required",
      security_epoch: 1,
      version: 1,
    });
    expect(state.authenticator).toMatchObject({
      password_state: "not_configured",
      totp_state: "not_configured",
    });
    expect(state.marker).toMatchObject({ singleton: 1, user_id: output.user_id });
    expect(state.audit).toMatchObject({
      actor_type: "local_cli",
      authentication_method: "host_terminal",
      action: "identity.bootstrap",
      result: "allow",
      target_id_snapshot: output.user_id,
    });
    const serializedAudit = JSON.stringify(state.audit);
    expect(serializedAudit).toContain("[REDACTED]");
    expect(serializedAudit).not.toContain(marker);
    expect(serializedAudit).not.toContain("Initial@");
  });

  it("retains bootstrap lockout across restart and emits no profile details", async () => {
    const databaseFile = databasePath("restart");
    const first = fakeIo(["one@example.org", "", "", "YES"]);
    expect(await runIdentityBootstrapCli([], { CONFIG_PATH: "/config/example.yaml" }, first, {
      loadConfiguration: () => fakeConfig(databaseFile),
      now: () => NOW,
      osActor: () => "operator",
    })).toBe(0);

    const second = fakeIo(["two@example.org", "Raw", "Input", "YES"]);
    expect(await runIdentityBootstrapCli([], { CONFIG_PATH: "/config/example.yaml" }, second, {
      loadConfiguration: () => fakeConfig(databaseFile),
      now: () => NOW + 1,
      osActor: () => "operator",
    })).toBe(1);
    expect(second.output).toEqual([]);
    expect(second.errors).toEqual(['{"error":{"code":"bootstrap_unavailable"}}\n']);
    expect(second.errors.join("")).not.toContain("two@example.org");

    const worker = open(databaseFile);
    expect(await worker.execute({
      run: (database) => database.read((query) =>
        query.get<{ count: number }>("SELECT count(*) AS count FROM users")?.count),
    })).toBe(1);
    expect(worker.readiness.schema).toBe("ready");
  });

  it("serializes racing bootstrap attempts so only one commits", async () => {
    const worker = open(databasePath("race"));
    const identities = new IdentityRepository(worker, { now: () => NOW });
    const attempts = await Promise.allSettled([
      identities.bootstrapInitialSuperadmin(
        { email: "one@example.org", givenName: "", familyName: "" },
        auditContext("req_8ca2d86c-541c-4484-bcc0-feebb54f6311"),
      ),
      identities.bootstrapInitialSuperadmin(
        { email: "two@example.org", givenName: "", familyName: "" },
        auditContext("req_9ca2d86c-541c-4484-bcc0-feebb54f6312"),
      ),
    ]);

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    const rejected = attempts.find((attempt) => attempt.status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: new IdentityError("bootstrap_unavailable"),
    });
    expect(await worker.execute({
      run: (database) => database.read((query) => ({
        users: query.get<{ count: number }>("SELECT count(*) AS count FROM users")?.count,
        markers: query.get<{ count: number }>(
          "SELECT count(*) AS count FROM identity_bootstrap",
        )?.count,
        audits: database.administrativeAuditCount(),
      })),
    })).toEqual({ users: 1, markers: 1, audits: 1 });
  });

  it("requires a direct host terminal and accepts no profile or secret arguments", async () => {
    let questions = 0;
    const nonTerminal = fakeIo([], false);
    nonTerminal.question = async () => {
      questions += 1;
      return "";
    };
    expect(await runIdentityBootstrapCli([], { CONFIG_PATH: "/config/example.yaml" }, nonTerminal))
      .toBe(2);
    expect(nonTerminal.errors).toEqual(['{"error":{"code":"terminal_required"}}\n']);
    expect(questions).toBe(0);

    const rawArgument = "raw-profile@example.org";
    const withArguments = fakeIo([]);
    expect(await runIdentityBootstrapCli(
      ["--email", rawArgument, "--password", "raw-secret"],
      { CONFIG_PATH: "/config/example.yaml" },
      withArguments,
    )).toBe(2);
    expect(withArguments.errors).toEqual(['{"error":{"code":"invalid_arguments"}}\n']);
    expect(withArguments.errors.join("")).not.toContain(rawArgument);
    expect(withArguments.errors.join("")).not.toContain("raw-secret");

    const unauthorizedWorker = open(databasePath("authority"));
    const identities = new IdentityRepository(unauthorizedWorker, { now: () => NOW });
    await expect(identities.bootstrapInitialSuperadmin(
      { email: "one@example.org", givenName: "", familyName: "" },
      {
        ...auditContext("req_8ca2d86c-541c-4484-bcc0-feebb54f6311"),
        actor: {
          type: "browser_session",
          label: "remote",
          authenticationMethod: "password_totp",
        },
      },
    )).rejects.toEqual(new IdentityError("bootstrap_unavailable"));
  });

  it("fails closed for cancellation, malformed input, missing persistence, and existing users", async () => {
    const cancelled = fakeIo(["one@example.org", "", "", "no"]);
    expect(await runIdentityBootstrapCli([], { CONFIG_PATH: "/config/example.yaml" }, cancelled, {
      loadConfiguration: () => fakeConfig(databasePath("cancelled")),
    })).toBe(1);
    expect(cancelled.errors).toEqual(['{"error":{"code":"bootstrap_cancelled"}}\n']);

    const noPersistence = fakeIo([]);
    expect(await runIdentityBootstrapCli([], { CONFIG_PATH: "/config/example.yaml" }, noPersistence, {
      loadConfiguration: () => ({ ...fakeConfig(databasePath("none")), persistence: undefined }),
    })).toBe(1);
    expect(noPersistence.errors).toEqual(['{"error":{"code":"persistence_required"}}\n']);

    const malformedFile = databasePath("malformed");
    const malformed = fakeIo(["raw\u0000@example.org", "", "", "YES"]);
    expect(await runIdentityBootstrapCli([], { CONFIG_PATH: "/config/example.yaml" }, malformed, {
      loadConfiguration: () => fakeConfig(malformedFile),
    })).toBe(1);
    expect(malformed.errors).toEqual(['{"error":{"code":"bootstrap_failed"}}\n']);
    expect(malformed.errors.join("")).not.toContain("raw");

    const existingFile = databasePath("existing");
    const worker = open(existingFile);
    const identities = new IdentityRepository(worker, { now: () => NOW });
    await identities.createLocalIdentity({
      profile: { email: "existing@example.org", givenName: "", familyName: "" },
      role: "user",
      status: "invited",
    }, {
      actor: {
        type: "local_cli",
        label: "fixture",
        authenticationMethod: "host_terminal",
      },
      correlationId: "req_8ca2d86c-541c-4484-bcc0-feebb54f6311",
      source: { category: "identity" },
    });
    await worker.close();
    workers.delete(worker);

    const existing = fakeIo(["new@example.org", "", "", "YES"]);
    expect(await runIdentityBootstrapCli([], { CONFIG_PATH: "/config/example.yaml" }, existing, {
      loadConfiguration: () => fakeConfig(existingFile),
    })).toBe(1);
    expect(existing.errors).toEqual(['{"error":{"code":"bootstrap_unavailable"}}\n']);
  });
});

interface FakeIo extends IdentityBootstrapIo {
  output: string[];
  errors: string[];
  question(prompt: string): Promise<string>;
}

function fakeIo(answers: string[], terminal = true): FakeIo {
  const remaining = [...answers];
  const output: string[] = [];
  const errors: string[] = [];
  return {
    inputTerminal: terminal,
    outputTerminal: terminal,
    output,
    errors,
    question: async () => remaining.shift() ?? "",
    stdout: (value) => output.push(value),
    stderr: (value) => errors.push(value),
  };
}

function fakeConfig(databaseFile: string, secret = ""): GatewayConfig {
  return {
    persistence: { databaseFile },
    services: {
      fixture: {
        credentials: secret === "" ? [] : [{ secret }],
      },
    },
  } as unknown as GatewayConfig;
}

function auditContext(correlationId: string) {
  return {
    actor: {
      type: "local_cli" as const,
      label: "host-local operator",
      authenticationMethod: "host_terminal",
    },
    correlationId,
    source: {
      category: "break_glass" as const,
      client: "identity-bootstrap-test",
      osActor: "operator",
    },
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
  return join(mkdtempSync(join(tmpdir(), `secretsauce-bootstrap-${name}-`)), "control.sqlite");
}
