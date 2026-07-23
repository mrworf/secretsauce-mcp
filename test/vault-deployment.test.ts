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

  it("gives the data caller only its caller key and socket, never root/control/backup keys or the store", () => {
    const compose = parse(readFileSync("docker-compose.example.yaml", "utf8")) as any;
    const data = compose.services.secretsauce;
    const serialized = JSON.stringify(data);

    expect(data.volumes).toContain("./vault-keys/data-plane.key:/run/vault-caller/data-plane.key:ro");
    expect(data.volumes).toContain("./vault-runtime:/run/secretsauce-vault:ro");
    expect(data.environment.SECRETSAUCE_VAULT_DATA_KEY_FILE).toBe("/run/vault-caller/data-plane.key");
    expect(serialized).not.toContain("root-primary.key");
    expect(serialized).not.toContain("control-plane.key");
    expect(serialized).not.toContain("backup-capability.key");
    expect(serialized).not.toContain("/var/lib/secretsauce/vault");
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
