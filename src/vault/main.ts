import { dirname, join } from "node:path";
import { chmodSync, chownSync, existsSync } from "node:fs";
import { VaultCapabilityAuthority } from "./capabilities.js";
import { VaultBrokerServer } from "./broker.js";
import {
  loadVaultConfig,
  loadVaultStructuralConfig,
} from "./config.js";
import {
  createProvisioningKeyAdapters,
  pathInventoryAdapter,
} from "./provisioningAdapters.js";
import { VaultProvisioner } from "./provisioning.js";
import { VaultProvisioningRetryLoop } from "./provisioningRetry.js";
import { VaultRecordStore } from "./recordStore.js";
import {
  VaultSetupAuthority,
  dropProcessPrivileges,
  type VaultPrivilegeDrop,
} from "./setupAuthority.js";
import {
  VaultProvisioningStatusServer,
} from "./statusServer.js";
import { validateRuntimeProvisionedKeys } from "./runtimeProvisioning.js";
import { runRootRotationMaintenance } from "./rootRotationCoordinator.js";

export interface RunningVaultService {
  close(): Promise<void>;
}

export async function startConfiguredVaultBroker(
  configFile: string,
  credentialOnly = false,
  validateProvisioning = true,
  sharedOwnerUid = 0,
): Promise<VaultBrokerServer> {
  const structural = loadVaultStructuralConfig(configFile);
  if (validateProvisioning) {
    validateRuntimeProvisionedKeys({
      manifestFile: join(structural.setup.stateDirectory, "manifest.json"),
      registry: structural.setup.registry,
      requiredIds: structural.setup.registry
        .filter((entry) => entry.consumers.includes("vault"))
        .map((entry) => entry.id),
      ownership: (entry) => {
        if (entry.consumers.length === 2) {
          return {
            uid: sharedOwnerUid,
            gid: structural.setup.sharedGid,
            mode: 0o440,
          };
        }
        return {
          uid: structural.setup.runtimeUid,
          gid: structural.setup.runtimeGid,
          mode: 0o400,
        };
      },
    });
  }
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
    statusSocketPath: config.statusSocket.path,
    credentialSocketPath: config.credentialSocket.path,
    socketMode: config.credentialSocket.mode,
    statusSocketMode: config.statusSocket.mode,
    credentialSocketMode: config.credentialSocket.mode,
    credentialSocketGid: structural.setup.sharedGid,
    callerKeys: {
      data_plane: config.callerKeys.dataPlane,
      control_plane: config.callerKeys.controlPlane,
      backup: config.callerKeys.backup,
    },
    capabilityAuthority: capabilities,
    store,
  });
  try {
    if (credentialOnly) await broker.listenCredentialOnly();
    else await broker.listen();
    return broker;
  } finally {
    for (const key of config.rootKeys.values()) key.fill(0);
    for (const key of Object.values(config.callerKeys)) key.fill(0);
    for (const key of Object.values(config.capabilityKeys)) key.fill(0);
  }
}

export async function startVaultService(
  configFile: string,
  dropPrivileges: VaultPrivilegeDrop = dropProcessPrivileges,
  rotationArguments: readonly string[] = [],
  publishRotation?: (phase: string) => void,
): Promise<RunningVaultService> {
  const config = loadVaultStructuralConfig(configFile);
  const setupOwnerUid = process.getuid?.() ?? config.setup.runtimeUid;
  for (const path of new Set([
    dirname(config.statusSocket.path),
    dirname(config.credentialSocket.path),
  ])) {
    chownSync(path, config.setup.runtimeUid, config.setup.sharedGid);
    chmodSync(path, 0o750);
  }
  const status = new VaultProvisioningStatusServer({
    path: config.statusSocket.path,
    mode: config.statusSocket.mode,
    uid: config.setup.runtimeUid,
    gid: config.setup.sharedGid,
  });
  await status.listen();
  let broker: VaultBrokerServer | undefined;
  let retry: VaultProvisioningRetryLoop | undefined;
  let closed = false;
  const manifestFile = join(config.setup.stateDirectory, "manifest.json");
  const provisioner = new VaultProvisioner({
    manifestFile,
    registry: config.setup.registry,
    keyAdapters: createProvisioningKeyAdapters((entry) => {
      if (entry.consumers.length === 2) {
        return {
          uid: process.getuid?.() === 0 ? 0 : config.setup.runtimeUid,
          gid: config.setup.sharedGid,
          mode: 0o440,
        };
      }
      return entry.consumers[0] === "application"
        ? {
          uid: config.setup.applicationUid,
          gid: config.setup.applicationGid,
          mode: 0o400,
        }
        : {
          uid: config.setup.runtimeUid,
          gid: config.setup.runtimeGid,
          mode: 0o400,
        };
    }),
    inventories: Object.entries(config.setup.retainedState).map(
      ([id, path]) => pathInventoryAdapter(id, path),
    ),
    adoptExistingKeys: config.setup.adoptExistingKeys,
  });
  const authority = new VaultSetupAuthority(
    provisioner,
    manifestFile,
    config.setup.registry.map((entry) => ({
      path: dirname(entry.path),
      gid: entry.consumers.length === 2
        ? config.setup.sharedGid
        : entry.consumers[0] === "application"
          ? config.setup.applicationGid
          : config.setup.runtimeGid,
    })),
    config.setup.runtimeUid,
    config.setup.runtimeGid,
    config.setup.sharedGid,
  );

  const rotationJournalFile = join(
    config.setup.stateDirectory,
    "rotation-journal.json",
  );
  if (rotationArguments.length > 0 || existsSync(rotationJournalFile)) {
    try {
      await runRootRotationMaintenance({
        config,
        arguments: rotationArguments,
        ...(publishRotation === undefined
          ? {}
          : { publish: publishRotation }),
      });
    } catch {
      try {
        authority.relinquish(dropPrivileges);
      } catch {
        await status.close();
        throw new Error("Vault setup authority could not be relinquished.");
      }
      status.setStatus({
        state: "configuration_error",
        retryPending: false,
        errorCategory: "invalid_configuration",
      });
      return {
        close: async () => {
          if (closed) return;
          closed = true;
          await status.close();
        },
      };
    }
  }

  const transition = async (
    result: ReturnType<VaultProvisioner["runOnce"]>,
  ): Promise<void> => {
    if (closed) return;
    if (result.state === "preparing") {
      status.setStatus({
        state: "preparing",
        retryPending: true,
        errorCategory: result.errorCategory,
      });
      return;
    }
    retry?.stop();
    try {
      authority.relinquish(dropPrivileges);
    } catch {
      await status.close();
      throw new Error("Vault setup authority could not be relinquished.");
    }
    if (result.state === "configuration_error") {
      status.setStatus({
        state: "configuration_error",
        retryPending: false,
        errorCategory: result.errorCategory,
      });
      return;
    }
    try {
      broker = await startConfiguredVaultBroker(
        configFile,
        true,
        true,
        setupOwnerUid,
      );
    } catch {
      status.setStatus({
        state: "configuration_error",
        retryPending: false,
        errorCategory: "invalid_configuration",
      });
      return;
    }
    status.setStatus({ state: "ready", retryPending: false });
  };

  const initial = authority.runOnce();
  if (initial.state === "preparing") {
    await transition(initial);
    retry = new VaultProvisioningRetryLoop({
      provisioner: authority,
      manifestFile,
      publish: (result) => {
        void transition(result).catch(() => {
          process.exitCode = 1;
        });
      },
    });
    retry.start();
  } else {
    await transition(initial);
  }

  return {
    close: async () => {
      if (closed) return;
      closed = true;
      retry?.stop();
      await broker?.close();
      await status.close();
    },
  };
}

async function main(): Promise<void> {
  const configFile = process.env.SECRETSAUCE_VAULT_CONFIG;
  if (configFile === undefined) {
    process.stderr.write('{"level":"error","error":{"code":"vault_config_invalid"}}\n');
    process.exitCode = 1;
    return;
  }
  try {
    const service = await startVaultService(
      configFile,
      dropProcessPrivileges,
      process.argv.slice(2),
      (phase) => {
        process.stdout.write(JSON.stringify({
          level: "info",
          event: "root_rotation",
          phase,
        }) + "\n");
      },
    );
    const shutdown = (): void => {
      void service.close().finally(() => {
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
