import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("v1 migration operator documentation", () => {
  const guide = readFileSync("docs/v1-migration.md", "utf8");
  const readme = readFileSync("README.md", "utf8");
  const reference = readFileSync("docs/config-reference.md", "utf8");

  it("documents source/target separation, preview, exact commit, and sole authority", () => {
    expect(guide).toContain("SECRETSAUCE_V1_CONFIG");
    expect(guide).toContain("npm run migrate:v1 -- dry-run");
    expect(guide).toContain("npm run migrate:v1 -- commit");
    expect(guide).toContain("MIGRATE V1 <source fingerprint prefix>");
    expect(guide).toMatch(/database\s+is the sole runtime authority/);
    expect(guide).toContain("services: {}");
    expect(guide).toMatch(/at\s+least one V2 superadmin/);
    expect(readme).toContain("[One-time V1 YAML migration](docs/v1-migration.md)");
    expect(reference).toContain("[One-time V1 YAML migration](v1-migration.md)");
  });

  it("documents opt-in allowlisting, recovery dependencies, and safe remediation", () => {
    for (const value of [
      "--resolve-credentials",
      "SECRETSAUCE_MIGRATION_ALLOWLIST_FILE",
      "SECRETSAUCE_VAULT_CONTROL_KEY_FILE",
      "SECRETSAUCE_VAULT_BACKUP_KEY_FILE",
      "SECRETSAUCE_VAULT_BACKUP_CAPABILITY_KEY_FILE",
      "SECRETSAUCE_RESTORE_DIRECTORY",
      "SECRETSAUCE_RESTORE_RECOVERY_KEY_FILE",
      "migration_plan_changed",
      "absent from MCP discovery in both Codex and ChatGPT",
    ]) expect(guide).toContain(value);
    expect(guide).toContain("do not add it to the ordinary gateway runtime");
    expect(guide).toContain("Authorization");
    expect(guide).toContain("downstream response bodies");
  });

  it("uses public stand-ins and does not suggest destructive source handling", () => {
    const documentedHosts = [...guide.matchAll(/https?:\/\/([^\s/]+)/g)]
      .map((match) => match[1]);
    expect(documentedHosts.every((host) => host?.endsWith(".example.org")))
      .toBe(true);
    expect(guide).not.toMatch(/https?:\/\/[^\s/]+\.(?:corp|internal|lan|local)\b/i);
    expect(guide).not.toMatch(/\brm\s+-/);
    expect(guide).not.toContain("delete the original");
  });
});
