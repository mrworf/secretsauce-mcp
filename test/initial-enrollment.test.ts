import { describe, expect, it } from "vitest";
import type { IdentityConfig } from "../src/types.js";
import { InitialEnrollmentAuthority } from "../src/identity/initialEnrollment.js";

const NOW = 1_785_000_000_000;

describe("process-lifetime initial enrollment authority", () => {
  it("announces one 192-bit secret and issues only in-memory restricted authority", async () => {
    const authority = await InitialEnrollmentAuthority.create({
      config: identityConfig(),
      sessionHmacKey: Buffer.alloc(32, 3),
      now: () => NOW,
      random: (size) => Buffer.alloc(size, 7),
    });
    const lines: string[] = [];
    authority.announce((line) => lines.push(line));
    expect(lines).toEqual([
      "SECRETSAUCE INITIAL ENROLLMENT SECRET: BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcH "
        + "(invalid after successful enrollment or process restart)\n",
    ]);
    expect(() => authority.announce(() => undefined)).toThrow(
      "Initial enrollment secret was already displayed.",
    );
    expect(await authority.verify("BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcH")).toBe(true);
    expect(await authority.verify("not-the-secret")).toBe(false);

    const login = authority.issue("Admin@Example.org");
    expect(login).toMatchObject({
      role: "superadmin",
      purpose: "initial_enrollment",
      expiresAt: NOW + 15 * 60_000,
    });
    const session = authority.restrictedSession(
      authority.sessionHash(login.sessionToken),
    );
    expect(session).toMatchObject({
      userId: login.userId,
      provisional: true,
      purpose: "initial_enrollment",
    });
    expect(authority.csrfMatches(session!, login.csrfToken)).toBe(true);
    expect(authority.csrfMatches(session!, `${login.csrfToken.slice(0, -1)}A`)).toBe(false);
  });

  it("abandons the old secret and every provisional session on close", async () => {
    const authority = await InitialEnrollmentAuthority.create({
      config: identityConfig(),
      sessionHmacKey: Buffer.alloc(32, 4),
      now: () => NOW,
      random: (size) => Buffer.alloc(size, 8),
    });
    const code = Buffer.alloc(24, 8).toString("base64url");
    authority.announce(() => undefined);
    const login = authority.issue("admin@example.org");
    authority.close();

    expect(await authority.verify(code)).toBe(false);
    expect(authority.restrictedSession(authority.sessionHash(login.sessionToken)))
      .toBeUndefined();
    expect(() => authority.issue("other@example.org")).toThrow(
      "Initial enrollment is unavailable.",
    );
  });

  it.each([
    "",
    "not-an-email",
    "a@@example.org",
    "admin @example.org",
  ])("rejects invalid provisional email %j", async (email) => {
    const authority = await InitialEnrollmentAuthority.create({
      config: identityConfig(),
      sessionHmacKey: Buffer.alloc(32, 5),
      now: () => NOW,
      random: (size) => Buffer.alloc(size, 9),
    });
    authority.announce(() => undefined);
    expect(() => authority.issue(email)).toThrow();
    authority.close();
  });
});

function identityConfig(): IdentityConfig {
  return {
    activeRootKeyId: "root",
    rootKeyFiles: { root: "/unused" },
    sessionHmacKeyFile: "/unused",
    temporaryPasswordTtlMs: 72 * 3_600_000,
    restrictedSessionTtlMs: 15 * 60_000,
    password: { minimumLength: 12 },
    sessions: {
      adminAbsoluteMs: 12 * 3_600_000,
      adminInactivityMs: 15 * 60_000,
      userAbsoluteMs: 24 * 3_600_000,
      userInactivityMs: 60 * 60_000,
    },
    stepUpMode: "five_minutes",
    limits: {
      loginAttempts: 10,
      loginWindowMs: 15 * 60_000,
      passwordAttempts: 10,
      passwordWindowMs: 15 * 60_000,
      totpAttempts: 5,
      totpWindowMs: 5 * 60_000,
      maxPasswordVerifications: 2,
      maxPasswordVerificationsPerSource: 1,
      maxTotpVerifications: 8,
      maxTotpVerificationsPerSource: 2,
    },
  };
}
