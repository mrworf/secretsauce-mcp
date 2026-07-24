import { loadConfig } from "../config.js";
import { createLogger } from "../logger.js";
import { startupErrorPayload } from "../server.js";
import { startControlServer } from "./server.js";
import {
  createBackupVaultAccess,
  createControlVaultReadiness,
  type VaultBackupAccess,
  type VaultReadinessHandle,
} from "../vault/readiness.js";

const configPath = process.env.CONFIG_PATH;
if (!configPath) {
  console.error(JSON.stringify({
    level: "error",
    error: {
      code: "config_error",
      message: "CONFIG_PATH is required.",
    },
  }));
  process.exit(1);
}

let vaultReadiness: VaultReadinessHandle | undefined;
let backupVault: VaultBackupAccess | undefined;
try {
  const config = loadConfig(configPath);
  vaultReadiness = createControlVaultReadiness();
  backupVault = createBackupVaultAccess();
  const application = await startControlServer(config, {
    ...(vaultReadiness === undefined ? {} : { vaultReadiness: vaultReadiness.readiness }),
    ...(vaultReadiness?.controlClient === undefined
      ? {}
      : { credentialVaultClient: vaultReadiness.controlClient }),
    ...(backupVault === undefined
      ? {}
      : {
          backupVaultClient: backupVault.client,
          backupCapabilityIssuer: backupVault.issuer,
        }),
  });
  const logger = createLogger(config.logging);
  logger.info("control.server_started", {
    listen: config.control?.listen,
    api_prefix: "/api/v2",
    browser_prefix: "/control",
  });
  const close = async (signal: NodeJS.Signals) => {
    try {
      await application.close();
      logger.info("control.shutdown_completed", { signal });
      process.exitCode = 0;
    } catch {
      logger.error("control.shutdown_failed", { signal });
      process.exitCode = 1;
    } finally {
      vaultReadiness?.close();
      backupVault?.close();
    }
  };
  process.once("SIGTERM", () => void close("SIGTERM"));
  process.once("SIGINT", () => void close("SIGINT"));
} catch (error) {
  vaultReadiness?.close();
  backupVault?.close();
  console.error(JSON.stringify(startupErrorPayload(error)));
  process.exit(1);
}
