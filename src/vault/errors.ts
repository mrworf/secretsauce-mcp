export type VaultErrorCode =
  | "vault_config_invalid"
  | "vault_key_invalid"
  | "vault_frame_invalid"
  | "vault_authentication_failed"
  | "vault_request_stale"
  | "vault_replay_detected"
  | "vault_capacity_exceeded"
  | "vault_capability_invalid";

export class VaultError extends Error {
  readonly code: VaultErrorCode;

  constructor(code: VaultErrorCode, message: string) {
    super(message);
    this.name = "VaultError";
    this.code = code;
  }
}

export function vaultError(code: VaultErrorCode): VaultError {
  const messages: Record<VaultErrorCode, string> = {
    vault_config_invalid: "Vault configuration is invalid.",
    vault_key_invalid: "Vault key material is invalid.",
    vault_frame_invalid: "Vault protocol frame is invalid.",
    vault_authentication_failed: "Vault request authentication failed.",
    vault_request_stale: "Vault request is outside the allowed time window.",
    vault_replay_detected: "Vault request was already consumed.",
    vault_capacity_exceeded: "Vault request capacity is exhausted.",
    vault_capability_invalid: "Vault capability is invalid.",
  };
  return new VaultError(code, messages[code]);
}
