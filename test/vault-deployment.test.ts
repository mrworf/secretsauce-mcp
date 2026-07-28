import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

describe("vault deployment boundary", () => {
  it("runs the vault as a no-TCP process with only its private mounts", () => {
    const compose = parse(readFileSync("docker-compose.example.yaml", "utf8")) as any;
    const vault = compose.services["secretsauce-vault"];

    expect(vault.command).toEqual(["node", "dist/vault/main.js"]);
    expect(vault.ports).toBeUndefined();
    expect(vault.network_mode).toBe("none");
    expect(vault.user).toBe("0:0");
    expect(vault.environment.SECRETSAUCE_VAULT_CONFIG).toBe("/config/vault.yaml");
    expect(vault.environment.SECRETSAUCE_VAULT_STATUS_SOCKET)
      .toBe("/run/secretsauce-vault/status.sock");
    expect(vault.environment).not.toHaveProperty(
      "SECRETSAUCE_VAULT_DATA_KEY_FILE",
    );
    expect(vault.healthcheck.test).toEqual(["CMD", "node", "dist/vault/healthCli.js"]);
    expect(vault.volumes).toContain(
      "vault-generated:/var/lib/secretsauce/generated",
    );
    expect(vault.volumes).toContain(
      "vault-setup-state:/var/lib/secretsauce/setup",
    );
    expect(vault.volumes).toContain("./database:/inventory/database:ro");
    expect(vault.volumes).toContain("./audit:/inventory/audit:ro");
    expect(vault.volumes).toContain("./oauth-state:/inventory/oauth:ro");
    expect(vault.volumes).toContain("./vault-store:/var/lib/secretsauce/vault");
    expect(vault.volumes).toContain("./vault-runtime:/run/secretsauce-vault");
  });

  it("gives the combined application only role-limited caller keys and the socket", () => {
    const compose = parse(readFileSync("docker-compose.example.yaml", "utf8")) as any;
    const data = compose.services.secretsauce;
    const serialized = JSON.stringify(data);

    expect(data.user).toBe("1000:1000");
    expect(data.group_add).toEqual(["1002"]);
    expect(data.volumes).toContain(
      "vault-generated:/var/lib/secretsauce/generated:ro",
    );
    expect(data.volumes).toContain(
      "vault-setup-state:/var/lib/secretsauce/setup:ro",
    );
    expect(data.volumes).toContain("./vault-runtime:/run/secretsauce-vault:ro");
    expect(data.environment.SECRETSAUCE_VAULT_DATA_KEY_FILE)
      .toBe("/var/lib/secretsauce/generated/shared/data-plane.key");
    expect(data.environment.SECRETSAUCE_VAULT_CREDENTIAL_SOCKET)
      .toBe("/run/secretsauce-vault/credential.sock");
    expect(data.environment.SECRETSAUCE_VAULT_MANIFEST_FILE)
      .toBe("/var/lib/secretsauce/setup/manifest.json");
    expect(data.environment.SECRETSAUCE_VAULT_KEY_OWNER_UID).toBe("0");
    expect(data.environment.SECRETSAUCE_VAULT_SHARED_GID).toBe("1002");
    expect(data.environment.SECRETSAUCE_VAULT_CONTROL_KEY_FILE)
      .toBe("/var/lib/secretsauce/generated/shared/control-plane.key");
    expect(data.environment.SECRETSAUCE_VAULT_RESOLVE_KEY_FILE)
      .toBe("/var/lib/secretsauce/generated/shared/resolve-capability.key");
    expect(data.environment.SECRETSAUCE_VAULT_BACKUP_KEY_FILE)
      .toBe("/var/lib/secretsauce/generated/shared/backup.key");
    expect(data.environment.SECRETSAUCE_VAULT_BACKUP_CAPABILITY_KEY_FILE)
      .toBe("/var/lib/secretsauce/generated/shared/backup-capability.key");
    expect(serialized).not.toContain("root-primary.key");
    expect(serialized).not.toContain("/var/lib/secretsauce/vault");
    expect(serialized).not.toContain("./vault-keys");
    expect(data.environment.SECRETSAUCE_MCP_TOKEN).not.toContain("change-me");
  });

  it("documents only path contracts and never embeds key material", () => {
    const source = readFileSync("examples/vault.yaml", "utf8");
    const config = parse(source) as any;
    expect(config.version).toBe(1);
    expect(config.status_socket.path)
      .toBe("/run/secretsauce-vault/status.sock");
    expect(config.credential_socket.path)
      .toBe("/run/secretsauce-vault/credential.sock");
    expect(config.status_socket.mode).toBe(0o660);
    expect(config.credential_socket.mode).toBe(0o660);
    expect(Object.keys(config.setup.key_paths)).toHaveLength(11);
    expect(config.setup.adopt_existing_keys).toBe(false);
    expect(source).not.toMatch(/[A-Za-z0-9_-]{43}/);
    expect(source).not.toContain("Authorization");
  });
});
