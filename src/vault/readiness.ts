import { isAbsolute } from "node:path";
import { ControlVaultClient, DataVaultClient } from "./client.js";
import { vaultError } from "./errors.js";
import { readVaultKeyFile } from "./keyFile.js";

export interface VaultReadinessHandle {
  readiness(): Promise<"ready" | "unavailable">;
  close(): void;
}

export function createControlVaultReadiness(
  environment: NodeJS.ProcessEnv = process.env,
): VaultReadinessHandle | undefined {
  return createReadiness(
    "control",
    environment.SECRETSAUCE_VAULT_SOCKET,
    environment.SECRETSAUCE_VAULT_CONTROL_KEY_FILE,
  );
}

export function createDataVaultReadiness(
  environment: NodeJS.ProcessEnv = process.env,
): VaultReadinessHandle | undefined {
  return createReadiness(
    "data",
    environment.SECRETSAUCE_VAULT_SOCKET,
    environment.SECRETSAUCE_VAULT_DATA_KEY_FILE,
  );
}

function createReadiness(
  caller: "control" | "data",
  socketPath: string | undefined,
  keyFile: string | undefined,
): VaultReadinessHandle | undefined {
  if (socketPath === undefined && keyFile === undefined) return undefined;
  if (
    socketPath === undefined
    || keyFile === undefined
    || !isAbsolute(socketPath)
    || socketPath.includes("\0")
  ) {
    throw vaultError("vault_config_invalid");
  }
  const key = readVaultKeyFile(keyFile);
  const client = caller === "control"
    ? new ControlVaultClient({ socketPath, key })
    : new DataVaultClient({ socketPath, key });
  key.fill(0);
  return {
    readiness: async () => {
      try {
        const result = await client.readiness();
        return result.status === "ready" ? "ready" : "unavailable";
      } catch {
        return "unavailable";
      }
    },
    close: () => client.close(),
  };
}
