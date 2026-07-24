import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UuidV7Generator } from "../src/persistence/uuidV7.js";
import { createV1MigrationPlan } from "../src/v1MigrationPlan.js";
import {
  resolveV1MigrationCredentials,
  V1MigrationAllowlistError,
  V1MigrationResolutionContext,
} from "../src/v1MigrationSecrets.js";
import { readV1MigrationSource } from "../src/v1MigrationSource.js";

describe("allowlisted v1 credential source resolution", () => {
  it("resolves exact environment and trimmed file values and binds changes without reporting details", () => {
    const directory = mkdtempSync(join(tmpdir(), "v1-migration-secrets-"));
    const secretFile = join(directory, "file-secret");
    writeFileSync(secretFile, "  file-value\n", { mode: 0o600 });
    const plan = migrationPlan(sourceWithCredentials([
      envCredential("environment", "SELECTED_ENV"),
      fileCredential("file", secretFile),
      envCredential("missing", "MISSING_ENV"),
      envCredential("blocked", "BLOCKED_ENV"),
    ]));
    const allowlist = allowlistFile(directory, {
      environment: ["MISSING_ENV", "SELECTED_ENV"],
      files: [secretFile],
    });
    const context = new V1MigrationResolutionContext(Buffer.alloc(32, 0x41));

    const resolved = resolveV1MigrationCredentials(plan, {
      allowlistFile: allowlist,
      environment: {
        SELECTED_ENV: "environment-value",
        BLOCKED_ENV: "blocked-value",
      },
      context,
    });

    expect(resolved.configuredCredentialIds()).toHaveLength(2);
    const values = resolved.configuredCredentialIds().map((id) =>
      resolved.credentialValue(id)!.toString("utf8"));
    expect(values.sort()).toEqual(["environment-value", "file-value"]);
    expect(resolved.report.counts).toMatchObject({
      configuredCredentials: 2,
      unconfiguredCredentials: 2,
    });
    expect(resolved.report.warningCounts).toEqual({
      source_missing: 1,
      source_not_allowlisted: 1,
    });
    const report = JSON.stringify(resolved.report);
    for (const forbidden of [
      "environment-value",
      "file-value",
      "blocked-value",
      "SELECTED_ENV",
      secretFile,
    ]) expect(report).not.toContain(forbidden);

    const same = resolveV1MigrationCredentials(plan, {
      allowlistFile: allowlist,
      environment: { SELECTED_ENV: "environment-value" },
      context,
    });
    expect(same.digest).toBe(resolved.digest);
    same.dispose();
    const changed = resolveV1MigrationCredentials(plan, {
      allowlistFile: allowlist,
      environment: { SELECTED_ENV: "changed-value" },
      context,
    });
    expect(changed.digest).not.toBe(resolved.digest);
    changed.dispose();

    const retained = resolved.credentialValue(resolved.configuredCredentialIds()[0]!)!;
    resolved.dispose();
    expect(retained.every((byte) => byte === 0)).toBe(true);
    expect(resolved.configuredCredentialIds()).toEqual([]);
    context.dispose();
    expect(readFileSync(secretFile, "utf8")).toBe("  file-value\n");
  });

  it("uses warning-only unconfigured fallback for unsafe, malformed, missing, and oversized sources", () => {
    const directory = mkdtempSync(join(tmpdir(), "v1-migration-fallback-"));
    const unsafe = join(directory, "unsafe");
    const malformed = join(directory, "malformed");
    const oversized = join(directory, "oversized");
    const missing = join(directory, "missing");
    writeFileSync(unsafe, "unsafe", { mode: 0o644 });
    writeFileSync(malformed, Buffer.from([0xff]), { mode: 0o600 });
    writeFileSync(oversized, Buffer.alloc(65_537, 0x61), { mode: 0o600 });
    const plan = migrationPlan(sourceWithCredentials([
      fileCredential("unsafe", unsafe),
      fileCredential("malformed", malformed),
      fileCredential("oversized", oversized),
      fileCredential("missing", missing),
      envCredential("empty", "EMPTY"),
      envCredential("invalid", "INVALID"),
      envCredential("large", "LARGE"),
    ]));
    const allowlist = allowlistFile(directory, {
      environment: ["EMPTY", "INVALID", "LARGE"],
      files: [malformed, missing, oversized, unsafe],
    });
    const context = new V1MigrationResolutionContext(Buffer.alloc(32, 0x42));

    const resolved = resolveV1MigrationCredentials(plan, {
      allowlistFile: allowlist,
      environment: {
        EMPTY: "",
        INVALID: "bad\0value",
        LARGE: "x".repeat(65_537),
      },
      context,
    });

    expect(resolved.configuredCredentialIds()).toEqual([]);
    expect(resolved.report.warningCounts).toEqual({
      source_malformed: 3,
      source_missing: 1,
      source_oversized: 2,
      source_unsafe: 1,
    });
    resolved.dispose();
    context.dispose();
  });

  it("accepts the exact 65,536-byte value boundary", () => {
    const directory = mkdtempSync(join(tmpdir(), "v1-migration-boundary-"));
    const plan = migrationPlan(sourceWithCredentials([
      envCredential("boundary", "BOUNDARY"),
    ]));
    const allowlist = allowlistFile(directory, {
      environment: ["BOUNDARY"],
      files: [],
    });
    const context = new V1MigrationResolutionContext(Buffer.alloc(32, 0x43));
    const resolved = resolveV1MigrationCredentials(plan, {
      allowlistFile: allowlist,
      environment: { BOUNDARY: "x".repeat(65_536) },
      context,
    });
    expect(resolved.configuredCredentialIds()).toHaveLength(1);
    expect(resolved.credentialValue(resolved.configuredCredentialIds()[0]!)?.byteLength)
      .toBe(65_536);
    resolved.dispose();
    context.dispose();
  });

  it("requires a canonical owner/root mode-0400 closed allowlist with unique bounded entries", () => {
    const directory = mkdtempSync(join(tmpdir(), "v1-migration-allowlist-"));
    const plan = migrationPlan(sourceWithCredentials([]));
    const context = new V1MigrationResolutionContext(Buffer.alloc(32, 0x44));
    const loose = allowlistFile(directory, { environment: [], files: [] });
    chmodSync(loose, 0o600);
    expectAllowlistFailure(plan, loose, context, "allowlist_unsafe");

    const target = allowlistFile(directory, { environment: [], files: [] }, "target.yaml");
    const link = join(directory, "link.yaml");
    symlinkSync(target, link);
    expectAllowlistFailure(plan, link, context, "allowlist_unsafe");

    const duplicate = join(directory, "duplicate.yaml");
    writeFileSync(duplicate, "version: 1\nenvironment: [SAME, SAME]\nfiles: []\n", { mode: 0o400 });
    expectAllowlistFailure(plan, duplicate, context, "allowlist_invalid");

    const unknown = join(directory, "unknown.yaml");
    writeFileSync(unknown, "version: 1\nenvironment: []\nfiles: []\nprivate: value\n", { mode: 0o400 });
    expectAllowlistFailure(plan, unknown, context, "allowlist_invalid");
    context.dispose();
  });
});

function expectAllowlistFailure(
  plan: ReturnType<typeof migrationPlan>,
  allowlistFile: string,
  context: V1MigrationResolutionContext,
  code: string,
): void {
  let thrown: unknown;
  try {
    resolveV1MigrationCredentials(plan, { allowlistFile, context });
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(V1MigrationAllowlistError);
  expect(thrown).toMatchObject({ code });
  expect(String((thrown as Error).message)).not.toContain(allowlistFile);
}

function migrationPlan(source: string) {
  const generator = new UuidV7Generator({
    now: () => 1_700_000_000_000,
    random: () => Buffer.alloc(10, 0x51),
  });
  const directory = mkdtempSync(join(tmpdir(), "v1-migration-source-secret-"));
  const sourceFile = join(directory, "source.yaml");
  writeFileSync(sourceFile, source);
  return createV1MigrationPlan(readV1MigrationSource(sourceFile), {
    uuid: () => generator.next(),
  });
}

function allowlistFile(
  directory: string,
  input: { environment: string[]; files: string[] },
  name = "allowlist.yaml",
): string {
  const file = join(directory, name);
  writeFileSync(file, [
    "version: 1",
    `environment: [${input.environment.join(", ")}]`,
    ...(input.files.length === 0
      ? ["files: []"]
      : ["files:", ...input.files.map((path) => `  - ${JSON.stringify(path)}`)]),
    "",
  ].join("\n"), { mode: 0o400 });
  return file;
}

function sourceWithCredentials(credentials: string[]): string {
  return `services:
  example:
    name: Example
    destinations:
      - name: primary
        base_url: https://api.example.org/
${credentials.length === 0
    ? "    no_auth: true"
    : `    credentials:\n${credentials.join("\n")}`}
`;
}

function envCredential(id: string, name: string): string {
  return `      - id: ${id}
        usage: {kind: header, name: X-${id}}
        source: {kind: env, name: ${name}}`;
}

function fileCredential(id: string, path: string): string {
  return `      - id: ${id}
        usage: {kind: query, name: ${id}}
        source: {kind: file, path: ${JSON.stringify(path)}}`;
}
