import { createHash } from "node:crypto";
import { isUuidV7 } from "../persistence/uuidV7.js";
import { canonicalJson } from "./canonicalJson.js";
import { vaultError } from "./errors.js";
import type { VaultCredentialBinding } from "./recordStore.js";

const MAX_SELECTION = 10_000;
const LOCATOR_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DIGEST_DOMAIN = "secretsauce:vault-backup-selection:v1:";

export interface VaultBackupSelection extends VaultCredentialBinding {
  locator: string;
  generation: number;
}

export function canonicalizeVaultBackupSelection(
  value: readonly VaultBackupSelection[],
): VaultBackupSelection[] {
  if (!Array.isArray(value) || value.length > MAX_SELECTION) {
    throw vaultError("vault_archive_invalid");
  }
  const canonical = value.map((item) => {
    if (
      typeof item !== "object"
      || item === null
      || Array.isArray(item)
      || !isUuidV7(item.serviceId)
      || !isUuidV7(item.destinationId)
      || !isUuidV7(item.credentialId)
      || !LOCATOR_PATTERN.test(item.locator)
      || !Number.isSafeInteger(item.generation)
      || item.generation < 1
    ) throw vaultError("vault_archive_invalid");
    return {
      serviceId: item.serviceId,
      destinationId: item.destinationId,
      credentialId: item.credentialId,
      locator: item.locator,
      generation: item.generation,
    };
  }).sort(compareSelection);
  for (let index = 1; index < canonical.length; index += 1) {
    if (compareSelection(canonical[index - 1]!, canonical[index]!) === 0) {
      throw vaultError("vault_archive_invalid");
    }
  }
  return canonical;
}

export function digestVaultBackupSelection(
  selection: readonly VaultBackupSelection[],
): string {
  const canonical = canonicalizeVaultBackupSelection(selection);
  return createHash("sha256")
    .update(DIGEST_DOMAIN)
    .update(canonicalJson(canonical))
    .digest("hex");
}

function compareSelection(
  left: VaultBackupSelection,
  right: VaultBackupSelection,
): number {
  const leftKey = [
    left.serviceId,
    left.destinationId,
    left.credentialId,
    left.locator,
    left.generation.toString().padStart(16, "0"),
  ].join("\0");
  const rightKey = [
    right.serviceId,
    right.destinationId,
    right.credentialId,
    right.locator,
    right.generation.toString().padStart(16, "0"),
  ].join("\0");
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
}
