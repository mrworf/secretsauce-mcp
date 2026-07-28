import { isAbsolute } from "node:path";
import {
  BackupVaultClient,
  ControlVaultClient,
  DataVaultClient,
} from "./client.js";
import { VaultBackupCapabilityIssuer } from "./capabilities.js";
import { vaultError } from "./errors.js";
import { readVaultKeyFile } from "./keyFile.js";
import {
  validateAssignedRuntimeProvisionedKeys,
} from "./runtimeProvisioning.js";

export interface VaultReadinessHandle {
  readiness(): Promise<"ready" | "unavailable">;
  controlClient?: ControlVaultClient;
  dataClient?: DataVaultClient;
  close(): void;
}

export interface VaultBackupAccess {
  client: BackupVaultClient;
  issuer: VaultBackupCapabilityIssuer;
  close(): void;
}

export function createControlVaultReadiness(
  environment: NodeJS.ProcessEnv = process.env,
): VaultReadinessHandle | undefined {
  return createReadiness(
    "control",
    environment.SECRETSAUCE_VAULT_CREDENTIAL_SOCKET,
    environment.SECRETSAUCE_VAULT_CONTROL_KEY_FILE,
    environment,
  );
}

export function createDataVaultReadiness(
  environment: NodeJS.ProcessEnv = process.env,
): VaultReadinessHandle | undefined {
  return createReadiness(
    "data",
    environment.SECRETSAUCE_VAULT_CREDENTIAL_SOCKET,
    environment.SECRETSAUCE_VAULT_DATA_KEY_FILE,
    environment,
  );
}

export function createBackupVaultAccess(
  environment: NodeJS.ProcessEnv = process.env,
): VaultBackupAccess | undefined {
  const socketPath = environment.SECRETSAUCE_VAULT_CREDENTIAL_SOCKET;
  const callerKeyFile = environment.SECRETSAUCE_VAULT_BACKUP_KEY_FILE;
  const capabilityKeyFile =
    environment.SECRETSAUCE_VAULT_BACKUP_CAPABILITY_KEY_FILE;
  if (
    socketPath === undefined
    && callerKeyFile === undefined
    && capabilityKeyFile === undefined
  ) return undefined;
  if (
    socketPath === undefined
    || callerKeyFile === undefined
    || capabilityKeyFile === undefined
    || !isAbsolute(socketPath)
    || socketPath.includes("\0")
  ) throw vaultError("vault_config_invalid");
  validateAssignedRuntimeProvisionedKeys(environment, [
    { id: "vault.caller.backup", path: callerKeyFile },
    { id: "vault.capability.backup", path: capabilityKeyFile },
  ]);
  const callerKey = readVaultKeyFile(callerKeyFile);
  const capabilityKey = readVaultKeyFile(capabilityKeyFile);
  try {
    const client = new BackupVaultClient({
      socketPath,
      key: callerKey,
      ...ownerUidOption(environment),
    });
    const issuer = new VaultBackupCapabilityIssuer(
      capabilityKey,
      Date.now,
      () => client.bootId,
    );
    return {
      client,
      issuer,
      close: () => client.close(),
    };
  } finally {
    callerKey.fill(0);
    capabilityKey.fill(0);
  }
}

function createReadiness(
  caller: "control" | "data",
  socketPath: string | undefined,
  keyFile: string | undefined,
  environment: NodeJS.ProcessEnv,
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
  validateAssignedRuntimeProvisionedKeys(environment, [{
    id: caller === "control"
      ? "vault.caller.control-plane"
      : "vault.caller.data-plane",
    path: keyFile,
  }]);
  const key = readVaultKeyFile(keyFile);
  const client = caller === "control"
    ? new ControlVaultClient({ socketPath, key, ...ownerUidOption(environment) })
    : new DataVaultClient({ socketPath, key, ...ownerUidOption(environment) });
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
    ...(caller === "control" && client instanceof ControlVaultClient
      ? { controlClient: client }
      : {}),
    ...(caller === "data" && client instanceof DataVaultClient
      ? { dataClient: client }
      : {}),
    close: () => client.close(),
  };
}

function ownerUidOption(
  environment: NodeJS.ProcessEnv,
): { ownerUid?: number } {
  const value = environment.SECRETSAUCE_VAULT_OWNER_UID;
  if (value === undefined) return {};
  if (!/^(0|[1-9][0-9]{0,9})$/.test(value)) {
    throw vaultError("vault_config_invalid");
  }
  const ownerUid = Number(value);
  if (
    !Number.isSafeInteger(ownerUid)
    || ownerUid < 0
    || ownerUid > 0x7fffffff
  ) {
    throw vaultError("vault_config_invalid");
  }
  return { ownerUid };
}
