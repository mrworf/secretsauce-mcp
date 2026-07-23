import { describe, expect, it } from "vitest";
import {
  IdentityKeyRing,
  TotpError,
  beginTotpEnrollment,
  decryptTotpSeed,
  parseTotpEnrollmentUri,
  parseTotpEnvelope,
  rewrapTotpEnvelope,
  totpCode,
  verifyTotpCode,
} from "../src/identity/totp.js";

const USER_ID = "018f1f2e-7b3c-7a10-8000-000000000001";
const AUTHENTICATOR_ID = "018f1f2e-7b3c-7a10-8000-000000000002";

describe("local identity TOTP primitives", () => {
  it("matches the RFC 6238 SHA-1 vectors and accepts only the narrow skew window", () => {
    const seed = Buffer.from("12345678901234567890", "ascii");
    expect(totpCode(seed, 59_000, 8)).toBe("94287082");
    expect(totpCode(seed, 1_111_111_109_000, 8)).toBe("07081804");
    expect(totpCode(seed, 1_111_111_111_000, 8)).toBe("14050471");

    const timestamp = 100 * 30_000 + 1_000;
    for (const offset of [-1, 0, 1]) {
      const code = totpCode(seed, (100 + offset) * 30_000);
      expect(verifyTotpCode(seed, code, timestamp)).toBe(100 + offset);
    }
    expect(verifyTotpCode(seed, totpCode(seed, 98 * 30_000), timestamp)).toBeUndefined();
    expect(verifyTotpCode(seed, "12345x", timestamp)).toBeUndefined();
  });

  it("round-trips a strict enrollment URI and encrypted seed across key-ring restart", () => {
    const keys = { old: Buffer.alloc(32, 7), next: Buffer.alloc(32, 9) };
    const originalRing = new IdentityKeyRing("old", keys);
    const enrollment = beginTotpEnrollment({
      authenticatorId: AUTHENTICATOR_ID,
      userId: USER_ID,
      issuer: "SecretSauce",
      label: "ada@example.org",
      keyRing: originalRing,
    });
    const parsed = parseTotpEnrollmentUri(enrollment.uri);
    expect(parsed).toMatchObject({ issuer: "SecretSauce", label: "ada@example.org" });
    expect(enrollment.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(parsed.seed).toHaveLength(20);

    const restartedRing = new IdentityKeyRing("next", keys);
    const decrypted = decryptTotpSeed(enrollment.envelope, restartedRing);
    expect(decrypted).toEqual(parsed.seed);
    const rewrapped = rewrapTotpEnvelope(enrollment.envelope, restartedRing);
    expect(rewrapped).toMatchObject({ rootKeyId: "next", generation: 2 });
    expect(decryptTotpSeed(rewrapped, restartedRing)).toEqual(parsed.seed);

    parsed.seed.fill(0);
    decrypted.fill(0);
    originalRing.destroy();
    restartedRing.destroy();
    keys.old.fill(0);
    keys.next.fill(0);
  });

  it("rejects malformed metadata, URIs, envelopes, tampering, and unavailable keys uniformly", () => {
    const ring = new IdentityKeyRing("old", { old: Buffer.alloc(32, 3) });
    expect(() => beginTotpEnrollment({
      authenticatorId: "not-a-uuid",
      userId: USER_ID,
      issuer: "SecretSauce",
      label: "user@example.org",
      keyRing: ring,
    })).toThrowError(new TotpError("totp_invalid"));
    expect(() => parseTotpEnrollmentUri("otpauth://totp/label?secret=BAD")).toThrowError(
      new TotpError("totp_invalid"),
    );
    expect(() => parseTotpEnvelope({ version: 1, unknown: true })).toThrowError(
      new TotpError("totp_invalid"),
    );

    const enrollment = beginTotpEnrollment({
      authenticatorId: AUTHENTICATOR_ID,
      userId: USER_ID,
      issuer: "SecretSauce",
      label: "user@example.org",
      keyRing: ring,
    });
    const tampered = structuredClone(enrollment.envelope);
    tampered.encryptedSeed.ciphertext = `${tampered.encryptedSeed.ciphertext[0] === "A" ? "B" : "A"}${tampered.encryptedSeed.ciphertext.slice(1)}`;
    expect(() => decryptTotpSeed(tampered, ring)).toThrowError(new TotpError("totp_invalid"));
    const wrongRing = new IdentityKeyRing("different", { different: Buffer.alloc(32, 4) });
    expect(() => decryptTotpSeed(enrollment.envelope, wrongRing)).toThrowError(
      new TotpError("totp_key_unavailable"),
    );
    try {
      parseTotpEnrollmentUri("otpauth://totp/private-value");
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain("private-value");
    }
    ring.destroy();
    wrongRing.destroy();
  });
});
