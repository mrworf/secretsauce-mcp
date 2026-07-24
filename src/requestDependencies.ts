import { AuditSink } from "./audit.js";
import { createCapabilityDependencies, type CapabilityDependencies } from "./capabilities.js";
import { createSecretRuntime, type SecretRuntime } from "./secretRuntime.js";
import type { GatewayConfig } from "./types.js";
import type { RuntimeAuthority } from "./runtimeAuthority.js";
import type { RuntimeVault } from "./runtimeVault.js";
import type { ActiveSelfApiKeyDetector } from "./selfApiKeyProtection.js";

export interface RequestDependencies {
  auditSink: AuditSink;
  capabilities: CapabilityDependencies;
  secretRuntime: SecretRuntime;
  runtimeAuthority?: RuntimeAuthority;
  runtimeVault?: RuntimeVault;
  selfApiKeyDetector?: Promise<ActiveSelfApiKeyDetector>;
  selfApiKeyProtectionPrechecked?: boolean;
}

export function createRequestDependencies(config: GatewayConfig): RequestDependencies {
  const auditSink = new AuditSink(config);
  const capabilities = createCapabilityDependencies(config, auditSink);
  try {
    return { auditSink, capabilities, secretRuntime: createSecretRuntime(config, capabilities.tokenBroker) };
  } catch (error) {
    auditSink.close();
    throw error;
  }
}
