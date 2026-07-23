import { VaultCapabilityAuthority } from "./capabilities.js";
import { VaultBrokerServer } from "./broker.js";
import { loadVaultConfig } from "./config.js";
import { VaultRecordStore } from "./recordStore.js";

export async function startVaultBroker(configFile: string): Promise<VaultBrokerServer> {
  const config = loadVaultConfig(configFile);
  const store = new VaultRecordStore({
    directory: config.storeDirectory,
    activeRootKey: config.activeRootKey,
    rootKeys: config.rootKeys,
  });
  const capabilities = new VaultCapabilityAuthority({
    resolveKey: config.capabilityKeys.resolve,
    backupKey: config.capabilityKeys.backup,
  });
  const broker = new VaultBrokerServer({
    socketPath: config.socket.path,
    socketMode: config.socket.mode,
    callerKeys: {
      data_plane: config.callerKeys.dataPlane,
      control_plane: config.callerKeys.controlPlane,
      backup: config.callerKeys.backup,
    },
    capabilityAuthority: capabilities,
    store,
  });
  try {
    await broker.listen();
    return broker;
  } finally {
    for (const key of config.rootKeys.values()) key.fill(0);
    for (const key of Object.values(config.callerKeys)) key.fill(0);
    for (const key of Object.values(config.capabilityKeys)) key.fill(0);
  }
}

async function main(): Promise<void> {
  const configFile = process.env.SECRETSAUCE_VAULT_CONFIG;
  if (configFile === undefined) {
    process.stderr.write('{"level":"error","error":{"code":"vault_config_invalid"}}\n');
    process.exitCode = 1;
    return;
  }
  try {
    const broker = await startVaultBroker(configFile);
    const shutdown = (): void => {
      void broker.close().finally(() => {
        process.exitCode = 0;
      });
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } catch {
    process.stderr.write('{"level":"error","error":{"code":"vault_startup_failed"}}\n');
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith("/vault/main.js")) {
  void main();
}
