export const VAULT_CALLERS = {
  data_plane: 1,
  control_plane: 2,
  backup: 3,
} as const;
export type VaultCaller = keyof typeof VAULT_CALLERS;

export const VAULT_OPERATIONS = {
  readiness: 1,
  resolve_for_request: 2,
  create: 3,
  replace: 4,
  delete: 5,
  metadata: 6,
  export_encrypted: 7,
  import_encrypted: 8,
  replace_empty: 9,
} as const;
export type VaultOperation = keyof typeof VAULT_OPERATIONS;

const allowedOperations: Record<VaultCaller, ReadonlySet<VaultOperation>> = {
  data_plane: new Set(["readiness", "resolve_for_request"]),
  control_plane: new Set([
    "readiness",
    "create",
    "replace",
    "delete",
    "metadata",
  ]),
  backup: new Set([
    "readiness",
    "export_encrypted",
    "import_encrypted",
    "replace_empty",
  ]),
};

export function isOperationAllowed(
  caller: VaultCaller,
  operation: VaultOperation,
): boolean {
  return allowedOperations[caller].has(operation);
}
