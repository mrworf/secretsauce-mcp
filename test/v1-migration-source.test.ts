import { createHash } from "node:crypto";
import {
  chmodSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  readV1MigrationSource,
  V1MigrationSourceError,
} from "../src/v1MigrationSource.js";

describe("bounded v1 migration source reader", () => {
  it("extracts portable services, fingerprints exact bytes, and only counts discarded ACL identities", () => {
    const source = `version: 1
auth:
  mode: builtin_oauth
  administrator_password_hash: do-not-disclose
services:
  café-service:
    name: Café
    destinations:
      - name: primary
        base_url: https://api.example.org
    no_auth: true
    access:
      users: [first@example.org, second@example.org]
`;
    const file = fixture(source);
    const before = readFileSync(file);

    const result = readV1MigrationSource(file);

    expect(result).toMatchObject({
      schemaVersion: 1,
      discardedAclEntryCount: 2,
      sha256: createHash("sha256").update(before).digest("hex"),
    });
    expect(Object.keys(result.services)).toEqual(["café-service"]);
    expect(JSON.stringify(result)).not.toContain("first@example.org");
    expect(JSON.stringify(result)).not.toContain("do-not-disclose");
    expect(readFileSync(file)).toEqual(before);
  });

  it("accepts the exact ACL boundary and rejects excess ACL and rule counts safely", () => {
    const users = Array.from({ length: 128 }, (_, index) => `user-${index}@example.org`);
    const valid = fixture(minimalSource(`access:\n      users: [${users.join(", ")}]`));
    expect(readV1MigrationSource(valid).discardedAclEntryCount).toBe(128);

    const excessAcl = fixture(minimalSource(
      `access:\n      users: [${[...users, "private-identity@example.org"].join(", ")}]`,
    ));
    expectSafeFailure(excessAcl, "schema_invalid", ["private-identity", excessAcl]);

    const rules = Array.from({ length: 2_001 }, (_, index) => [
      `      - id: rule-${index}`,
      "        effect: deny",
      `        priority: ${index}`,
    ].join("\n")).join("\n");
    const excessRules = fixture(minimalSource(`policy:\n      mode: deny\n      rules:\n${rules}`));
    expectSafeFailure(excessRules, "schema_invalid", ["rule-2000", excessRules]);
  });

  it("rejects malformed, duplicate-key, alias, tag, deep, and oversized scalar YAML with safe reasons", () => {
    expectSafeFailure(fixture("services: [unterminated"), "yaml_invalid", ["unterminated"]);
    expectSafeFailure(fixture(`${minimalSource()}\nservices: {}\n`), "yaml_invalid", ["services"]);
    expectSafeFailure(
      fixture("services: &private\n  x: *private\n"),
      "yaml_alias_forbidden",
      ["private"],
    );
    expectSafeFailure(
      fixture("services: !private-tag {}\n"),
      "yaml_tag_forbidden",
      ["private-tag"],
    );

    let nested = "value";
    for (let index = 0; index < 34; index += 1) nested = `{level: ${nested}}`;
    expectSafeFailure(
      fixture(`server: ${nested}\nservices: {}\n`),
      "yaml_too_deep",
      ["value"],
    );

    expectSafeFailure(
      fixture(`server:\n  private: ${"x".repeat(1024 * 1024 + 1)}\nservices: {}\n`),
      "yaml_scalar_too_large",
      ["xxxxx"],
    );

    expectSafeFailure(
      fixture(`server:\n  settings: [${"false,".repeat(100_001)}]\nservices: {}\n`),
      "yaml_too_complex",
      ["false,false"],
    );
  });

  it("rejects unknown fields, unsupported versions, invalid UTF-8, and excessive portable objects", () => {
    expectSafeFailure(
      fixture(`${minimalSource()}\nprivate_unknown: do-not-disclose\n`),
      "schema_invalid",
      ["do-not-disclose"],
    );
    expectSafeFailure(
      fixture(minimalSource("", "version: 2\n")),
      "unsupported_schema",
      [],
    );
    expectSafeFailure(fixture(Buffer.from([0xff, 0xfe])), "source_not_utf8", []);

    const services = Array.from({ length: 3_334 }, (_, index) => [
      `  service-${index}:`,
      "    name: Service",
      "    destinations:",
      "      - base_url: https://api.example.org",
      "    no_auth: true",
    ].join("\n")).join("\n");
    expectSafeFailure(
      fixture(`services:\n${services}\n`),
      "portable_object_limit",
      ["service-3333"],
    );
  });

  it("requires an absolute canonical non-linked regular source no larger than 16 MiB", () => {
    expect(() => readV1MigrationSource("relative.yaml")).toThrowError(
      expect.objectContaining({ reason: "source_not_canonical" }),
    );

    const target = fixture(minimalSource());
    const link = join(mkdtempSync(join(tmpdir(), "v1-migration-link-")), "source.yaml");
    symlinkSync(target, link);
    expectSafeFailure(link, "source_not_canonical", [target, link]);

    const large = fixture(Buffer.alloc(16 * 1024 * 1024 + 1, 0x61));
    expectSafeFailure(large, "source_too_large", [large]);
    expect(lstatSync(target).isFile()).toBe(true);
    chmodSync(target, 0o600);
  });
});

function minimalSource(extra = "", prefix = ""): string {
  return `${prefix}services:
  example:
    name: Example
    destinations:
      - base_url: https://api.example.org
    no_auth: true
${extra.length === 0 ? "" : `    ${extra}`}
`;
}

function fixture(source: string | Buffer): string {
  const file = join(mkdtempSync(join(tmpdir(), "v1-migration-source-")), "source.yaml");
  writeFileSync(file, source);
  return file;
}

function expectSafeFailure(
  file: string,
  reason: string,
  forbidden: string[],
): void {
  let thrown: unknown;
  try {
    readV1MigrationSource(file);
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(V1MigrationSourceError);
  expect(thrown).toMatchObject({ reason });
  const rendered = String((thrown as Error).message);
  for (const value of forbidden) expect(rendered).not.toContain(value);
}
