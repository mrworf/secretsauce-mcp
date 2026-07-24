import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { UuidV7Generator } from "../src/persistence/uuidV7.js";
import {
  VaultBackupCapabilityIssuer,
  VaultCapabilityAuthority,
  VaultResolveCapabilityIssuer,
} from "../src/vault/capabilities.js";

const now = 1_800_000_000_000;
const uuid = new UuidV7Generator({ now: () => now, random: () => Buffer.alloc(10, 7) });
const ids = {
  subjectId: uuid.next(),
  serviceId: uuid.next(),
  destinationId: uuid.next(),
  credentialId: uuid.next(),
};
const resolveInput = {
  ...ids,
  grantEpoch: 3,
  securityEpoch: 4,
  locator: "123e4567-e89b-42d3-a456-426614174000",
  generation: 2,
  method: "POST" as const,
  pathDigest: "a".repeat(64),
  requestId: "req_123e4567-e89b-42d3-a456-426614174000",
  operationDigest: "b".repeat(64),
};

describe("vault single-use capabilities", () => {
  it("issues and consumes a fully bound 15-second resolve capability once", () => {
    const authority = createAuthority();
    const token = authority.issueResolve(resolveInput);
    const capability = authority.consumeResolve(token);

    expect(capability).toMatchObject({
      kind: "resolve",
      caller: "data_plane",
      ...resolveInput,
      issuedAt: now,
      expiresAt: now + 15_000,
    });
    expect(() => authority.consumeResolve(token))
      .toThrowError(expect.objectContaining({ code: "vault_replay_detected" }));
  });

  it("keeps backup authority distinct and binds operation authorization", () => {
    const authority = createAuthority();
    const token = authority.issueBackup({
      operation: "export_encrypted",
      authorizationId: uuid.next(),
      subjectId: ids.subjectId,
      operationDigest: "c".repeat(64),
    });
    expect(authority.consumeBackup(token)).toMatchObject({
      kind: "backup",
      caller: "backup",
      operation: "export_encrypted",
      expiresAt: now + 300_000,
    });
    expect(() => createAuthority().consumeResolve(token))
      .toThrowError(expect.objectContaining({ code: "vault_capability_invalid" }));
  });

  it("requires exact restore bindings and forbids them on legacy backup operations", () => {
    const authority = createAuthority();
    const restore = {
      operation: "validate_restore" as const,
      authorizationId: uuid.next(),
      subjectId: ids.subjectId,
      operationDigest: "c".repeat(64),
      restorePlanId: uuid.next(),
      archiveSha256: "d".repeat(64),
      planDigest: "e".repeat(64),
    };
    expect(authority.consumeBackup(authority.issueBackup(restore))).toMatchObject(restore);

    expect(() => authority.issueBackup({
      operation: "replace_restore",
      authorizationId: uuid.next(),
      subjectId: ids.subjectId,
      operationDigest: "c".repeat(64),
    } as never)).toThrowError(expect.objectContaining({ code: "vault_capability_invalid" }));
    expect(() => authority.issueBackup({
      operation: "export_encrypted",
      authorizationId: uuid.next(),
      subjectId: ids.subjectId,
      operationDigest: "c".repeat(64),
      restorePlanId: uuid.next(),
      archiveSha256: "d".repeat(64),
      planDigest: "e".repeat(64),
    })).toThrowError(expect.objectContaining({ code: "vault_capability_invalid" }));
  });

  it("lets the gateway mount resolve authority without backup authority", () => {
    const issuer = new VaultResolveCapabilityIssuer(
      Buffer.alloc(32, 1),
      () => now,
    );
    const token = issuer.issueResolve(resolveInput);

    expect(createAuthority().consumeResolve(token)).toMatchObject({
      kind: "resolve",
      ...resolveInput,
    });
    expect("issueBackup" in issuer).toBe(false);
  });

  it("lets backup coordination mount backup authority without resolve authority", () => {
    const issuer = new VaultBackupCapabilityIssuer(
      Buffer.alloc(32, 2),
      () => now,
    );
    const input = {
      operation: "export_encrypted" as const,
      authorizationId: uuid.next(),
      subjectId: ids.subjectId,
      operationDigest: "c".repeat(64),
    };
    expect(createAuthority().consumeBackup(issuer.issueBackup(input)))
      .toMatchObject({ kind: "backup", ...input });
    expect("issueResolve" in issuer).toBe(false);
  });

  it("rejects wrong signatures, kind changes, non-canonical payloads, excessive TTLs, and expiry", () => {
    const authority = createAuthority();
    const token = authority.issueResolve(resolveInput);
    const wrongSignature = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
    expect(() => authority.consumeResolve(wrongSignature))
      .toThrowError(expect.objectContaining({ code: "vault_capability_invalid" }));
    expect(() => authority.consumeResolve(nonCanonicalSignature(token)))
      .toThrowError(expect.objectContaining({ code: "vault_capability_invalid" }));

    const [encoded] = token.split(".");
    const payload = JSON.parse(Buffer.from(encoded!, "base64url").toString("utf8"));
    payload.kind = "backup";
    const altered = signRaw(payload, Buffer.alloc(32, 1));
    expect(() => createAuthority().consumeResolve(altered))
      .toThrowError(expect.objectContaining({ code: "vault_capability_invalid" }));

    expect(() => authority.issueResolve(resolveInput, 15_001))
      .toThrowError(expect.objectContaining({ code: "vault_capability_invalid" }));
    const expiredIssuer = createAuthority(() => now - 15_001);
    const expired = expiredIssuer.issueResolve(resolveInput);
    expect(() => authority.consumeResolve(expired))
      .toThrowError(expect.objectContaining({ code: "vault_capability_invalid" }));

    const nonCanonicalSource = JSON.stringify(payload);
    const nonCanonicalEncoded = Buffer.from(nonCanonicalSource).toString("base64url");
    const signature = createHmac("sha256", Buffer.alloc(32, 1))
      .update("secretsauce:vault:backup:v1:")
      .update(nonCanonicalEncoded)
      .digest("base64url");
    expect(() => createAuthority().consumeBackup(`${nonCanonicalEncoded}.${signature}`))
      .toThrowError(expect.objectContaining({ code: "vault_capability_invalid" }));
  });

  it("rejects invalid bindings and never includes key material in errors", () => {
    const key = Buffer.alloc(32, 1);
    let serialized = "";
    try {
      new VaultCapabilityAuthority({ resolveKey: key.subarray(0, 31), backupKey: Buffer.alloc(32, 2) });
    } catch (error) {
      serialized = JSON.stringify(error, Object.getOwnPropertyNames(error));
    }
    expect(serialized).not.toContain(key.toString("base64url"));
    expect(() => createAuthority().issueResolve({ ...resolveInput, pathDigest: "invalid" }))
      .toThrowError(expect.objectContaining({ code: "vault_capability_invalid" }));
  });
});

function createAuthority(clock: () => number = () => now): VaultCapabilityAuthority {
  return new VaultCapabilityAuthority({
    resolveKey: Buffer.alloc(32, 1),
    backupKey: Buffer.alloc(32, 2),
    now: clock,
  });
}

function signRaw(payload: unknown, key: Buffer): string {
  const source = JSON.stringify(payload);
  const encoded = Buffer.from(source).toString("base64url");
  return `${encoded}.${createHmac("sha256", key).update("secretsauce:vault:backup:v1:").update(encoded).digest("base64url")}`;
}

function nonCanonicalSignature(token: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const last = token.at(-1)!;
  const index = alphabet.indexOf(last);
  return `${token.slice(0, -1)}${alphabet[(index & ~3) | ((index + 1) & 3)]}`;
}
