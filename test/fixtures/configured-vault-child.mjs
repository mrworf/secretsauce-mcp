import { startConfiguredVaultBroker } from "../../dist/vault/main.js";

const configFile = process.env.SECRETSAUCE_VAULT_CONFIG;
if (configFile === undefined) {
  process.stderr.write('{"error":"vault_config_invalid"}\n');
  process.exitCode = 1;
} else {
  try {
    // Legacy protocol fixtures predate the v2.1 provisioning manifest. Their
    // scope is broker behavior, not the production entrypoint lifecycle.
    const broker = await startConfiguredVaultBroker(configFile, false, false);
    const close = () => {
      void broker.close().finally(() => {
        process.exitCode = 0;
      });
    };
    process.once("SIGINT", close);
    process.once("SIGTERM", close);
  } catch {
    process.stderr.write('{"error":"vault_startup_failed"}\n');
    process.exitCode = 1;
  }
}
