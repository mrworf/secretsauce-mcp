import { loadConfig } from "./config.js";
import {
  startControlServer,
  type ControlServerApplication,
} from "./control/server.js";
import { createLogger } from "./logger.js";
import { RestoreRecoveryManager } from "./restoreRecovery.js";
import { GatewayRuntime } from "./runtime.js";
import {
  installShutdownSignalHandlers,
  startServer,
  startupErrorPayload,
  type GatewayApplication,
} from "./server.js";
import type { GatewayConfig } from "./types.js";
import type { PersistenceOwner } from "./persistence/worker.js";
import type { PublicSetupStatus } from "./setup/status.js";
import {
  createBackupVaultAccess,
  createControlVaultReadiness,
  type VaultBackupAccess,
  type VaultReadinessHandle,
} from "./vault/readiness.js";

export interface SecretSauceApplication {
  gateway: GatewayApplication;
  control?: ControlServerApplication;
  close(): Promise<void>;
}

export interface SecretSauceApplicationOptions {
  persistence?: PersistenceOwner;
  operational?: () => boolean;
  setupStatus?: () => PublicSetupStatus;
  startOrdinaryJobs?: boolean;
  onInitialEnrollmentComplete?: () => void;
}

export async function startSecretSauceApplication(
  config: GatewayConfig,
  environment: NodeJS.ProcessEnv = process.env,
  options: SecretSauceApplicationOptions = {},
): Promise<SecretSauceApplication> {
  const runtime = new GatewayRuntime(config, {
    environment,
    ...(options.persistence === undefined
      ? {}
      : { persistence: options.persistence }),
    ...(options.startOrdinaryJobs === false
      ? { startMaintenance: () => () => undefined }
      : {}),
  });
  let control: ControlServerApplication | undefined;
  let gateway: GatewayApplication | undefined;
  let controlVault: VaultReadinessHandle | undefined;
  let backupVault: VaultBackupAccess | undefined;
  try {
    if (config.control !== undefined) {
      if (runtime.persistence === undefined) {
        throw new Error("Control and persistence configuration are required.");
      }
      controlVault = createControlVaultReadiness(environment);
      backupVault = createBackupVaultAccess(environment);
      if (
        controlVault !== undefined
        && await controlVault.readiness() !== "ready"
      ) throw new Error("Vault readiness is unavailable.");
      if (
        runtime.runtimeVault !== undefined
        && await runtime.runtimeVault.readiness() !== "ready"
      ) throw new Error("Runtime vault readiness is unavailable.");
      const readiness = runtime.persistence.readiness;
      if (
        readiness.database !== "ready"
        || readiness.schema !== "ready"
        || readiness.administrativeAudit !== "ready"
        || runtime.auditSink.degraded
      ) throw new Error("Operational prerequisites are unavailable.");
      await resumeRestoreIfConfigured(
        config,
        environment,
        backupVault,
      );
      control = await startControlServer(config, {
        authenticationAbuse: runtime.builtinOAuth,
        persistence: runtime.persistence,
        restoreMaintenance: runtime.restoreMaintenance,
        referenceAggregates: runtime.capabilities.tokenBroker,
        ...(controlVault === undefined
          ? {}
          : { vaultReadiness: controlVault.readiness }),
        ...(controlVault?.controlClient === undefined
          ? {}
          : { credentialVaultClient: controlVault.controlClient }),
        ...(backupVault === undefined
          ? {}
          : {
              backupVaultClient: backupVault.client,
              backupCapabilityIssuer: backupVault.issuer,
            }),
        ...(options.operational === undefined
          ? {}
          : { operational: options.operational }),
        ...(options.setupStatus === undefined
          ? {}
          : { setupStatus: options.setupStatus }),
        ...(options.startOrdinaryJobs === undefined
          ? {}
          : { startOrdinaryJobs: options.startOrdinaryJobs }),
        ...(options.onInitialEnrollmentComplete === undefined
          ? {}
          : {
              onInitialEnrollmentComplete:
                options.onInitialEnrollmentComplete,
            }),
      });
    }
    gateway = await startServer(config, {
      runtime,
      closeRuntimeOnClose: false,
      ...(options.operational === undefined
        ? {}
        : { operational: options.operational }),
    });
  } catch (error) {
    await gateway?.close().catch(() => undefined);
    await control?.close().catch(() => undefined);
    controlVault?.close();
    backupVault?.close();
    await runtime.close().catch(() => undefined);
    throw error;
  }

  const startedGateway = gateway;
  const startedControl = control;
  let closePromise: Promise<void> | undefined;
  return {
    gateway: startedGateway,
    ...(startedControl === undefined ? {} : { control: startedControl }),
    close: () => {
      closePromise ??= (async () => {
        const errors: unknown[] = [];
        try { await startedGateway.close(); } catch (error) { errors.push(error); }
        try { await startedControl?.close(); } catch (error) { errors.push(error); }
        controlVault?.close();
        backupVault?.close();
        try { await runtime.close(); } catch (error) { errors.push(error); }
        if (errors.length > 0) {
          throw new AggregateError(errors, "SecretSauce application close failed.");
        }
      })();
      return closePromise;
    },
  };
}

async function resumeRestoreIfConfigured(
  config: GatewayConfig,
  environment: NodeJS.ProcessEnv,
  backupVault: VaultBackupAccess | undefined,
): Promise<void> {
  const restoreDirectory = environment.SECRETSAUCE_RESTORE_DIRECTORY;
  const recoveryKeyFile =
    environment.SECRETSAUCE_RESTORE_RECOVERY_KEY_FILE;
  if ((restoreDirectory === undefined) !== (recoveryKeyFile === undefined)) {
    throw new Error("Restore deployment configuration is incomplete.");
  }
  if (restoreDirectory === undefined || recoveryKeyFile === undefined) return;
  if (backupVault === undefined || config.persistence === undefined) {
    throw new Error("Restore recovery dependencies are unavailable.");
  }
  const recovery = new RestoreRecoveryManager(
    restoreDirectory,
    recoveryKeyFile,
    backupVault.client,
    backupVault.issuer,
  );
  try {
    await recovery.resume({
      databaseFile: config.persistence.databaseFile,
    });
  } finally {
    recovery.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
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
  try {
    const browserFirst =
      process.env.SECRETSAUCE_VAULT_STATUS_SOCKET !== undefined;
    const config = loadConfig(
      configPath,
      browserFirst
        ? { deferProvisionedKeyValidation: true }
        : {},
    );
    const application = !browserFirst
      ? await startSecretSauceApplication(config)
      : await (
          await import("./setup/lifecycle.js")
        ).startBrowserFirstApplication(config);
    installShutdownSignalHandlers(
      application,
      createLogger(config.logging),
    );
  } catch (error) {
    console.error(JSON.stringify(startupErrorPayload(error)));
    process.exit(1);
  }
}
