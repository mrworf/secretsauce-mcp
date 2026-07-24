import { describe, expect, it } from "vitest";
import { UuidV7Generator } from "../src/persistence/uuidV7.js";
import {
  canonicalizeVaultBackupSelection,
  digestVaultBackupSelection,
  type VaultBackupSelection,
} from "../src/vault/backupSelection.js";

describe("vault backup selection binding", () => {
  it("canonicalizes order and binds every exact record field", () => {
    const generator = new UuidV7Generator();
    const first = selection(generator, 1);
    const second = selection(generator, 2);
    expect(digestVaultBackupSelection([second, first]))
      .toBe(digestVaultBackupSelection([first, second]));
    for (const changed of [
      { ...first, serviceId: generator.next() },
      { ...first, destinationId: generator.next() },
      { ...first, credentialId: generator.next() },
      { ...first, locator: "12345678-1234-4234-8234-123456789abc" },
      { ...first, generation: 2 },
    ]) {
      expect(digestVaultBackupSelection([changed]))
        .not.toBe(digestVaultBackupSelection([first]));
    }
  });

  it("accepts the exact count bound and rejects empty, duplicate, malformed, and limit plus one", () => {
    const generator = new UuidV7Generator();
    const base = selection(generator, 1);
    const maximum = Array.from({ length: 10_000 }, (_, index) => ({
      ...base,
      credentialId: generator.next(),
      generation: index + 1,
    }));
    expect(canonicalizeVaultBackupSelection(maximum)).toHaveLength(10_000);
    for (const invalid of [
      [],
      [base, base],
      [{ ...base, locator: "../record" }],
      [{ ...base, generation: 0 }],
      [...maximum, base],
    ]) {
      expect(() => canonicalizeVaultBackupSelection(invalid))
        .toThrowError(expect.objectContaining({ code: "vault_archive_invalid" }));
    }
  });
});

function selection(
  generator: UuidV7Generator,
  generation: number,
): VaultBackupSelection {
  return {
    serviceId: generator.next(),
    destinationId: generator.next(),
    credentialId: generator.next(),
    locator: generation === 1
      ? "11111111-1111-4111-8111-111111111111"
      : "22222222-2222-4222-8222-222222222222",
    generation,
  };
}
