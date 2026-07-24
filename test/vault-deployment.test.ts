import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

describe("vault deployment boundary", () => {
  it("runs the vault as a no-TCP process with only its private mounts", () => {
    const compose = parse(readFileSync("docker-compose.example.yaml", "utf8")) as any;
    const vault = compose.services["secretsauce-vault"];

    expect(vault.command).toEqual(["node", "dist/vault/main.js"]);
    expect(vault.ports).toBeUndefined();
    expect(vault.environment.SECRETSAUCE_VAULT_CONFIG).toBe("/config/vault.yaml");
    expect(vault.healthcheck.test).toEqual(["CMD", "node", "dist/vault/healthCli.js"]);
    expect(vault.volumes).toContain("./vault-keys:/run/vault-keys:ro");
    expect(vault.volumes).toContain("./vault-store:/var/lib/secretsauce/vault");
    expect(vault.volumes).toContain("./vault-runtime:/run/secretsauce-vault");
  });

  it("gives the combined application only role-limited caller keys and the socket", () => {
    const compose = parse(readFileSync("docker-compose.example.yaml", "utf8")) as any;
    const data = compose.services.secretsauce;
    const serialized = JSON.stringify(data);

    expect(data.volumes).toContain("./vault-keys/data-plane.key:/run/vault-caller/data-plane.key:ro");
    expect(data.volumes).toContain("./vault-keys/control-plane.key:/run/vault-caller/control-plane.key:ro");
    expect(data.volumes).toContain("./vault-keys/resolve-capability.key:/run/vault-caller/resolve-capability.key:ro");
    expect(data.volumes).toContain("./vault-keys/backup.key:/run/vault-caller/backup.key:ro");
    expect(data.volumes).toContain("./vault-keys/backup-capability.key:/run/vault-caller/backup-capability.key:ro");
    expect(data.volumes).toContain("./vault-runtime:/run/secretsauce-vault:ro");
    expect(data.environment.SECRETSAUCE_VAULT_DATA_KEY_FILE).toBe("/run/vault-caller/data-plane.key");
    expect(data.environment.SECRETSAUCE_VAULT_CONTROL_KEY_FILE)
      .toBe("/run/vault-caller/control-plane.key");
    expect(data.environment.SECRETSAUCE_VAULT_RESOLVE_KEY_FILE)
      .toBe("/run/vault-caller/resolve-capability.key");
    expect(data.environment.SECRETSAUCE_VAULT_BACKUP_KEY_FILE)
      .toBe("/run/vault-caller/backup.key");
    expect(data.environment.SECRETSAUCE_VAULT_BACKUP_CAPABILITY_KEY_FILE)
      .toBe("/run/vault-caller/backup-capability.key");
    expect(serialized).not.toContain("root-primary.key");
    expect(serialized).not.toContain("/var/lib/secretsauce/vault");
    expect(data.volumes).not.toContain("./vault-keys:/run/vault-keys:ro");
    expect(data.environment.SECRETSAUCE_MCP_TOKEN).not.toContain("change-me");
  });

  it("documents only path contracts and never embeds key material", () => {
    const source = readFileSync("examples/vault.yaml", "utf8");
    const config = parse(source) as any;
    expect(config.version).toBe(1);
    expect(config.socket.path).toBe("/run/secretsauce-vault/vault.sock");
    expect(config.socket.mode).toBe(0o660);
    expect(source).not.toMatch(/[A-Za-z0-9_-]{43}/);
    expect(source).not.toContain("Authorization");
  });
});
