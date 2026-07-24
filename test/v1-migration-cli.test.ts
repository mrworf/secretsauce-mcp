import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { UuidV7Generator } from "../src/persistence/uuidV7.js";
import type { GatewayConfig } from "../src/types.js";
import {
  runV1MigrationCli,
  type V1MigrationCliDependencies,
  type V1MigrationCliIo,
} from "../src/v1MigrationCli.js";
import { V1MigrationCommitError } from "../src/v1MigrationCommit.js";

describe("v1 migration CLI", () => {
  it("dry-runs without a terminal or mutations and emits one sanitized closed report", async () => {
    const fixture = migrationFixture();
    const executeDefinitions = vi.fn();
    const executeResolved = vi.fn();
    const io = cliIo({ inputTerminal: false, outputTerminal: false });
    const before = readFileSync(fixture.source);

    const exitCode = await runV1MigrationCli(
      ["dry-run"],
      environment(fixture),
      io,
      dependencies({ executeDefinitions, executeResolved }),
    );

    expect(exitCode).toBe(0);
    expect(executeDefinitions).not.toHaveBeenCalled();
    expect(executeResolved).not.toHaveBeenCalled();
    expect(io.questions).toEqual([]);
    expect(io.stderrValues).toEqual([]);
    expect(io.stdoutValues).toHaveLength(1);
    expect(JSON.parse(io.stdoutValues[0]!)).toMatchObject({
      formatVersion: 1,
      sourceSchemaVersion: 1,
      resolutionMode: "metadata_only",
      outcome: "dry_run",
      counts: { services: 1, discardedAclEntries: 1 },
    });
    expect(readFileSync(fixture.source)).toEqual(before);
    expectSafeOutput(io, fixture);
  });

  it("requires a terminal and an exact source-bound confirmation before commit", async () => {
    const fixture = migrationFixture();
    const executeDefinitions = vi.fn().mockResolvedValue(commitResult());
    const nonTerminal = cliIo({ inputTerminal: false });
    expect(await runV1MigrationCli(
      ["commit"],
      environment(fixture),
      nonTerminal,
      dependencies({ executeDefinitions }),
    )).toBe(2);
    expect(errorCode(nonTerminal)).toBe("terminal_required");

    const cancelled = cliIo({ answer: "MIGRATE V1 incorrect" });
    expect(await runV1MigrationCli(
      ["commit"],
      environment(fixture),
      cancelled,
      dependencies({ executeDefinitions }),
    )).toBe(1);
    expect(errorCode(cancelled)).toBe("confirmation_cancelled");
    expect(executeDefinitions).not.toHaveBeenCalled();

    const confirmed = cliIo({ answerFromPrompt: true });
    expect(await runV1MigrationCli(
      ["commit"],
      environment(fixture),
      confirmed,
      dependencies({ executeDefinitions }),
    )).toBe(0);
    expect(executeDefinitions).toHaveBeenCalledOnce();
    expect(confirmed.stdoutValues).toHaveLength(2);
    expect(JSON.parse(confirmed.stdoutValues[1]!)).toMatchObject({
      outcome: "committed",
      activationGeneration: 1,
      serviceCount: 1,
    });
    expectSafeOutput(confirmed, fixture);
  });

  it("rejects source changes after confirmation without executing a commit", async () => {
    const fixture = migrationFixture();
    const executeDefinitions = vi.fn();
    const io = cliIo({
      answer: async (prompt) => {
        writeFileSync(fixture.source, `${readFileSync(fixture.source, "utf8")}\n`);
        return confirmationFromPrompt(prompt);
      },
    });

    expect(await runV1MigrationCli(
      ["commit"],
      environment(fixture),
      io,
      dependencies({ executeDefinitions }),
    )).toBe(1);
    expect(errorCode(io)).toBe("migration_plan_changed");
    expect(executeDefinitions).not.toHaveBeenCalled();
  });

  it("resolves only allowlisted credentials, detects value changes, and reports no source detail", async () => {
    const fixture = migrationFixture({ credential: true });
    const executeResolved = vi.fn().mockImplementation(({ resolved }) => {
      const ids = resolved.configuredCredentialIds();
      expect(ids).toHaveLength(1);
      expect(resolved.credentialValue(ids[0]!)?.toString("utf8")).toBe("selected-value");
      return commitResult();
    });
    const stable = cliIo({ answerFromPrompt: true });
    const selected = environment(fixture, { SELECTED_ENV: "selected-value" });

    expect(await runV1MigrationCli(
      ["commit", "--resolve-credentials"],
      selected,
      stable,
      dependencies({ executeResolved }),
    )).toBe(0);
    expect(executeResolved).toHaveBeenCalledOnce();
    expectSafeOutput(stable, fixture, ["SELECTED_ENV", "selected-value"]);

    const changedEnvironment = environment(fixture, { SELECTED_ENV: "first-value" });
    const changedCommit = vi.fn();
    const changed = cliIo({
      answer: (prompt) => {
        changedEnvironment.SELECTED_ENV = "second-value";
        return confirmationFromPrompt(prompt);
      },
    });
    expect(await runV1MigrationCli(
      ["commit", "--resolve-credentials"],
      changedEnvironment,
      changed,
      dependencies({ executeResolved: changedCommit }),
    )).toBe(1);
    expect(errorCode(changed)).toBe("migration_plan_changed");
    expect(changedCommit).not.toHaveBeenCalled();
    expectSafeOutput(changed, fixture, [
      "SELECTED_ENV",
      "first-value",
      "second-value",
    ]);

    const changedAllowlistCommit = vi.fn();
    const changedAllowlist = cliIo({
      answer: (prompt) => {
        chmodSync(fixture.allowlist, 0o600);
        writeFileSync(
          fixture.allowlist,
          "version: 1\nenvironment: [SELECTED_ENV, UNUSED_ENV]\nfiles: []\n",
        );
        chmodSync(fixture.allowlist, 0o400);
        return confirmationFromPrompt(prompt);
      },
    });
    expect(await runV1MigrationCli(
      ["commit", "--resolve-credentials"],
      environment(fixture, { SELECTED_ENV: "selected-value" }),
      changedAllowlist,
      dependencies({ executeResolved: changedAllowlistCommit }),
    )).toBe(1);
    expect(errorCode(changedAllowlist)).toBe("migration_plan_changed");
    expect(changedAllowlistCommit).not.toHaveBeenCalled();
  });

  it("uses stable safe codes for arguments, missing inputs, and one-time conflicts", async () => {
    const fixture = migrationFixture();
    const invalid = cliIo();
    expect(await runV1MigrationCli(
      ["commit", "--unknown"],
      environment(fixture),
      invalid,
    )).toBe(2);
    expect(errorCode(invalid)).toBe("invalid_arguments");

    const missing = cliIo();
    expect(await runV1MigrationCli(["dry-run"], {}, missing)).toBe(2);
    expect(errorCode(missing)).toBe("config_required");

    const rerun = cliIo({ answerFromPrompt: true });
    expect(await runV1MigrationCli(
      ["commit"],
      environment(fixture),
      rerun,
      dependencies({
        executeDefinitions: async () => {
          throw new V1MigrationCommitError("already_completed");
        },
      }),
    )).toBe(1);
    expect(errorCode(rerun)).toBe("already_completed");
    expectSafeOutput(rerun, fixture);
  });

  it("exposes the compiled host-local package command", () => {
    const packageJson = JSON.parse(readFileSync(
      new URL("../package.json", import.meta.url),
      "utf8",
    )) as { scripts: Record<string, string> };
    expect(packageJson.scripts["migrate:v1"]).toBe("node dist/v1MigrationCli.js");
  });
});

interface CliIo extends V1MigrationCliIo {
  stdoutValues: string[];
  stderrValues: string[];
  questions: string[];
}

function cliIo(options: {
  inputTerminal?: boolean;
  outputTerminal?: boolean;
  answer?: string | ((prompt: string) => string | Promise<string>);
  answerFromPrompt?: boolean;
} = {}): CliIo {
  const stdoutValues: string[] = [];
  const stderrValues: string[] = [];
  const questions: string[] = [];
  return {
    inputTerminal: options.inputTerminal ?? true,
    outputTerminal: options.outputTerminal ?? true,
    stdoutValues,
    stderrValues,
    questions,
    stdout: (value) => stdoutValues.push(value),
    stderr: (value) => stderrValues.push(value),
    question: async (prompt) => {
      questions.push(prompt);
      if (options.answerFromPrompt) return confirmationFromPrompt(prompt);
      if (typeof options.answer === "function") return options.answer(prompt);
      return options.answer ?? "";
    },
  };
}

function dependencies(
  overrides: V1MigrationCliDependencies = {},
): V1MigrationCliDependencies {
  const generator = new UuidV7Generator({
    now: () => 1_700_000_000_000,
    random: () => Buffer.alloc(10, 0x61),
  });
  return {
    loadConfiguration: () => ({
      runtime: { authority: "database" },
      persistence: { databaseFile: "/tmp/v1-migration-target.sqlite" },
      identity: {},
      services: {},
    } as unknown as GatewayConfig),
    uuid: () => generator.next(),
    correlationUuid: () => "123e4567-e89b-42d3-a456-426614174000",
    osActor: () => "test-operator",
    ...overrides,
  };
}

function migrationFixture(options: { credential?: boolean } = {}): {
  directory: string;
  source: string;
  config: string;
  allowlist: string;
} {
  const directory = mkdtempSync(join(tmpdir(), "v1-migration-cli-"));
  const source = join(directory, "legacy.yaml");
  const config = join(directory, "v2.yaml");
  const allowlist = join(directory, "allowlist.yaml");
  writeFileSync(config, "runtime: {authority: database}\n");
  writeFileSync(source, `version: 1
auth:
  mode: builtin_oauth
  administrator_password_hash: private-password-hash
services:
  Private Source Key:
    name: Example
    destinations:
      - name: primary
        base_url: https://api.example.org/
${options.credential
    ? `    credentials:
      - id: api-token
        usage: {kind: header, name: X-Api-Token}
        source: {kind: env, name: SELECTED_ENV}`
    : "    no_auth: true"}
    access:
      users: [private-user@example.org]
`);
  writeFileSync(
    allowlist,
    "version: 1\nenvironment: [SELECTED_ENV]\nfiles: []\n",
    { mode: 0o400 },
  );
  chmodSync(allowlist, 0o400);
  return { directory, source, config, allowlist };
}

function environment(
  fixture: ReturnType<typeof migrationFixture>,
  extra: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
  return {
    CONFIG_PATH: fixture.config,
    SECRETSAUCE_V1_CONFIG: fixture.source,
    SECRETSAUCE_MIGRATION_ALLOWLIST_FILE: fixture.allowlist,
    ...extra,
  };
}

function commitResult() {
  return {
    migrationId: "018bcfe5-6800-7000-8000-000000000001",
    activationGeneration: 1,
    globalReferenceEpoch: 1,
    serviceCount: 1,
    remediationCount: 5,
  };
}

function confirmationFromPrompt(prompt: string): string {
  const match = prompt.match(/MIGRATE V1 [a-f0-9]{12}/);
  if (match === null) throw new Error("Confirmation phrase missing.");
  return match[0];
}

function errorCode(io: CliIo): string {
  return (JSON.parse(io.stderrValues.at(-1)!) as {
    error: { code: string };
  }).error.code;
}

function expectSafeOutput(
  io: CliIo,
  fixture: ReturnType<typeof migrationFixture>,
  additional: string[] = [],
): void {
  const rendered = [...io.stdoutValues, ...io.stderrValues].join("");
  for (const forbidden of [
    fixture.source,
    fixture.allowlist,
    "Private Source Key",
    "api.example.org",
    "private-password-hash",
    "private-user@example.org",
    ...additional,
  ]) expect(rendered).not.toContain(forbidden);
}
