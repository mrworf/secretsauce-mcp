import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PasswordPolicy,
  PasswordPolicyError,
  hashPassword,
  isSupportedPasswordHash,
  verifyPasswordHash,
} from "../src/identity/password.js";

const context = {
  email: "ada.lovelace@example.org",
  givenName: "Ada",
  familyName: "Lovelace",
  productName: "SecretSauce",
};

describe("local identity password primitives", () => {
  it("normalizes once, accepts exact boundaries, and emits the fixed Argon2id encoding", async () => {
    const policy = new PasswordPolicy({ minimumLength: 8 });
    const normalized = policy.validate("Ａbcdefg!", context);
    expect(normalized.toString("utf8")).toBe("Abcdefg!");

    const encoded = await hashPassword(normalized);
    expect(isSupportedPasswordHash(encoded)).toBe(true);
    expect(encoded).toMatch(/^\$argon2id\$v=19\$m=65536,p=1,t=3\$/);
    expect(await verifyPasswordHash(Buffer.from("Abcdefg!"), encoded)).toBe(true);
    expect(await verifyPasswordHash(Buffer.from("Abcdefg?"), encoded)).toBe(false);

    const maximum = policy.validate("🧭".repeat(1_024), context);
    expect(maximum.byteLength).toBe(4_096);
    maximum.fill(0);
  });

  it("rejects short, overlong, bundled, contextual, and operator-blocked values", () => {
    const operatorValue = "OperatorOnly-2026";
    const operatorDigest = createHash("sha256").update(operatorValue).digest("hex");
    const directory = mkdtempSync(join(tmpdir(), "secretsauce-password-blocklist-"));
    const file = join(directory, "blocked.sha256");
    writeFileSync(file, `${operatorDigest}\n`);
    const policy = new PasswordPolicy({ minimumLength: 8, operatorBlocklistFile: file });

    for (const [candidate, code] of [
      ["short", "password_too_short"],
      ["x".repeat(1_025), "password_too_long"],
      ["password123", "password_blocked"],
      ["ada.lovelace", "password_blocked"],
      [operatorValue, "password_blocked"],
    ] as const) {
      expect(() => policy.validate(candidate, context)).toThrowError(new PasswordPolicyError(code));
    }
  });

  it("rejects malformed blocklists and parameter-expanded hashes without echoing inputs", async () => {
    const directory = mkdtempSync(join(tmpdir(), "secretsauce-password-invalid-"));
    const file = join(directory, "unsafe-name-do-not-echo.sha256");
    writeFileSync(file, "NOT-A-DIGEST\n");
    expect(() => new PasswordPolicy({ operatorBlocklistFile: file })).toThrowError(
      new PasswordPolicyError("password_blocklist_invalid"),
    );
    try {
      new PasswordPolicy({ operatorBlocklistFile: file });
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain(file);
    }

    chmodSync(file, 0o600);
    const expanded = "$argon2id$v=19$m=1048576,t=99,p=16$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    expect(isSupportedPasswordHash(expanded)).toBe(false);
    expect(await verifyPasswordHash(Buffer.from("does-not-matter"), expanded)).toBe(false);
    expect(await verifyPasswordHash(Buffer.from("does-not-matter"), "malformed")).toBe(false);
  });
});
