import { fileURLToPath } from "node:url";
import { loadSecretlintConfig, resolveSecretlintRules } from "./secretlintConfig.js";
import { ResponseTokenizer } from "./responseTokenizer.js";
import { SecretScannerPool } from "./secretScannerPool.js";
import type { TokenBroker } from "./tokens.js";
import type { GatewayConfig } from "./types.js";
import { loadSensitiveNameConfig, resolveSensitiveNameConfig, SensitiveNameMatcher } from "./sensitiveNames.js";

export interface SecretRuntime {
  pool: SecretScannerPool;
  tokenizer: ResponseTokenizer;
  rules: ReturnType<typeof resolveSecretlintRules>;
}

export function createSecretRuntime(config: GatewayConfig, tokenBroker: TokenBroker): SecretRuntime {
  const bundledPath = fileURLToPath(new URL("../config/secretlint.yaml", import.meta.url));
  const bundled = loadSecretlintConfig(bundledPath);
  const configured = !config.responseProtection && process.env.SECRETLINT_CONFIG_PATH ? loadSecretlintConfig(process.env.SECRETLINT_CONFIG_PATH) : bundled;
  const bundledSensitivePath = fileURLToPath(new URL("../config/sensitive-names.yaml", import.meta.url));
  const bundledSensitive = loadSensitiveNameConfig(bundledSensitivePath);
  const configuredSensitive = !config.responseProtection && process.env.SENSITIVE_NAMES_CONFIG_PATH
    ? loadSensitiveNameConfig(process.env.SENSITIVE_NAMES_CONFIG_PATH)
    : bundledSensitive;
  const sensitiveNames = new SensitiveNameMatcher(resolveSensitiveNameConfig(configuredSensitive, bundledSensitive));
  const rules = resolveSecretlintRules(configured, bundled.rules);
  const pool = new SecretScannerPool();
  const initial={secretlint:{...configured,rules},sensitiveNames:resolveSensitiveNameConfig(configuredSensitive,bundledSensitive)};
  config.responseProtection??=initial;
  let selected=config.responseProtection;
  let tokenizer=new ResponseTokenizer(tokenBroker,pool,selected.secretlint.rules,selected.secretlint.limits.maxUniqueSecrets,selected.secretlint.limits.timeoutMs,new SensitiveNameMatcher(selected.sensitiveNames));
  function current(){const next=config.responseProtection??initial;if(next!==selected){selected=next;tokenizer=new ResponseTokenizer(tokenBroker,pool,next.secretlint.rules,next.secretlint.limits.maxUniqueSecrets,next.secretlint.limits.timeoutMs,new SensitiveNameMatcher(next.sensitiveNames));}return tokenizer;}
  return {pool,get rules(){current();return selected.secretlint.rules;},get tokenizer(){return current();}};
}
