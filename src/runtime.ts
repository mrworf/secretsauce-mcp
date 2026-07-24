import { AuditSink } from "./audit.js";
import { MaintenanceRegistry } from "./maintenance.js";
import { createSecretRuntime, type SecretRuntime } from "./secretRuntime.js";
import type { GatewayConfig } from "./types.js";
import { createCapabilityDependencies, type CapabilityDependencies } from "./capabilities.js";
import { BuiltinOAuthRuntime } from "./builtinOAuth.js";
import { PersistenceWorker, type PersistenceOwner } from "./persistence/worker.js";
import { PACKAGE_VERSION } from "./version.js";
import { sanitizeAuditText } from "./auditSanitizer.js";
import { PersistedRuntimeAuthority, type RuntimeAuthority } from "./runtimeAuthority.js";
import { RuntimeInvalidationConsumer } from "./runtimeInvalidation.js";
import { createDataVaultReadiness } from "./vault/readiness.js";
import { readVaultKeyFile } from "./vault/keyFile.js";
import { VaultCapabilityAuthority } from "./vault/capabilities.js";
import { CapabilityRuntimeVault, type RuntimeVault } from "./runtimeVault.js";

export interface GatewayRuntimeOptions {
  auditSink?: AuditSink;
  secretRuntime?: SecretRuntime;
  capabilities?: CapabilityDependencies;
  startMaintenance?: (config: GatewayConfig) => () => void;
  builtinOAuth?: BuiltinOAuthRuntime;
  maintenance?: MaintenanceRegistry;
  persistence?: PersistenceOwner;
  runtimeAuthority?: RuntimeAuthority;
  runtimeVault?: RuntimeVault;
  environment?: NodeJS.ProcessEnv;
}

export class GatewayRuntime {
  readonly auditSink: AuditSink;
  readonly secretRuntime: SecretRuntime;
  readonly capabilities: CapabilityDependencies;
  readonly builtinOAuth: BuiltinOAuthRuntime;
  readonly maintenance: MaintenanceRegistry;
  readonly persistence: PersistenceOwner | undefined;
  readonly runtimeAuthority: RuntimeAuthority | undefined;
  readonly runtimeVault: RuntimeVault | undefined;
  readonly #stopMaintenance: () => void;
  #closePromise: Promise<void> | undefined;

  constructor(readonly config: GatewayConfig, options: GatewayRuntimeOptions = {}) {
    const auditSink = options.auditSink ?? new AuditSink(config);
    let persistence: PersistenceOwner | undefined;
    let secretRuntime: SecretRuntime | undefined;
    let runtimeVault: RuntimeVault | undefined;
    let invalidations: RuntimeInvalidationConsumer | undefined;
    try {
      persistence = options.persistence ?? (
        config.persistence === undefined
          ? undefined
          : PersistenceWorker.open({
            databaseFile: config.persistence.databaseFile,
            productVersion: PACKAGE_VERSION,
            sanitizeAuditText: configuredAuditTextSanitizer(config),
          })
      );
      const capabilities = options.capabilities ?? createCapabilityDependencies(config, auditSink);
      secretRuntime = options.secretRuntime ?? createSecretRuntime(config, capabilities.tokenBroker);
      const builtinOAuth = options.builtinOAuth ?? new BuiltinOAuthRuntime(config);
      const maintenance = options.maintenance ?? new MaintenanceRegistry(config.limits.stateSweepIntervalMs);
      maintenance.register((now) => capabilities.tokenBroker.sweepExpired(now));
      maintenance.register((now) => capabilities.denialStore.sweep(now));
      maintenance.register((now) => builtinOAuth.sweep(now));
      if (config.runtime?.authority === "database" && persistence !== undefined) {
        const consumer = new RuntimeInvalidationConsumer(
          persistence,
          capabilities.tokenBroker,
        );
        invalidations = consumer;
        maintenance.register(() => {
          void consumer.poll();
        });
      }
      runtimeVault = options.runtimeVault ?? (
        config.runtime?.authority === "database"
          ? createDefaultRuntimeVault(options.environment)
          : undefined
      );
      const stopMaintenance = options.startMaintenance?.(config) ?? maintenance.start();
      this.auditSink = auditSink;
      this.secretRuntime = secretRuntime;
      this.capabilities = capabilities;
      this.builtinOAuth = builtinOAuth;
      this.maintenance = maintenance;
      this.persistence = persistence;
      this.runtimeAuthority = options.runtimeAuthority ?? (
        config.runtime?.authority === "database" && persistence !== undefined
          ? new PersistedRuntimeAuthority(
            persistence,
            invalidations === undefined ? undefined : () => invalidations!.poll(),
          )
          : undefined
      );
      this.runtimeVault = runtimeVault;
      this.#stopMaintenance = stopMaintenance;
    } catch (error) {
      auditSink.close();
      if (persistence !== undefined) void persistence.close();
      if (secretRuntime !== undefined) void secretRuntime.pool.close();
      runtimeVault?.close();
      throw error;
    }
  }

  close(): Promise<void> {
    this.#closePromise ??= this.closeOwnedResources();
    return this.#closePromise;
  }

  private async closeOwnedResources(): Promise<void> {
    const errors: unknown[] = [];
    try { this.#stopMaintenance(); } catch (error) { errors.push(error); }
    if (this.persistence !== undefined) {
      try { await this.persistence.close(); } catch (error) { errors.push(error); }
    }
    this.auditSink.close();
    try { this.runtimeVault?.close(); } catch (error) { errors.push(error); }
    try { await this.secretRuntime.pool.close(); } catch (error) { errors.push(error); }
    if (errors.length > 0) throw new AggregateError(errors, "Gateway runtime close failed.");
  }
}

function createDefaultRuntimeVault(
  environment: NodeJS.ProcessEnv = process.env,
): RuntimeVault {
  const readiness = createDataVaultReadiness(environment);
  const resolveKeyFile = environment.SECRETSAUCE_VAULT_RESOLVE_KEY_FILE;
  if (
    readiness?.dataClient === undefined
    || resolveKeyFile === undefined
    || resolveKeyFile.length === 0
  ) {
    readiness?.close();
    throw new Error("Persisted runtime vault configuration is required.");
  }
  let resolveKey: Buffer | undefined;
  try {
    resolveKey = readVaultKeyFile(resolveKeyFile);
    return new CapabilityRuntimeVault(
      readiness.dataClient,
      new VaultCapabilityAuthority({
        resolveKey,
        backupKey: resolveKey,
      }),
    );
  } catch {
    readiness.close();
    throw new Error("Persisted runtime vault configuration is invalid.");
  } finally {
    resolveKey?.fill(0);
  }
}

export function configuredAuditTextSanitizer(config: GatewayConfig): (value: string) => string {
  const secrets = [...new Set(Object.values(config.services).flatMap(
    (service) => service.credentials.map((credential) => credential.secret),
  ))].filter((secret) => secret.length > 0).sort((left, right) => right.length - left.length);
  return (value) => sanitizeAuditText(value, secrets);
}
