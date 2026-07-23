import { describe, expect, it } from "vitest";
import {
  requireIdentityStatusTransition,
  requireLastActiveSuperadmin,
} from "../src/identity/lifecycle.js";
import { IdentityError } from "../src/identity/errors.js";
import { parseProviderAssertion } from "../src/identity/provider.js";
import {
  normalizeEmail,
  parseIdentityProfile,
  parseProviderIdentity,
} from "../src/identity/validation.js";

describe("identity contracts", () => {
  it("normalizes Unicode profiles and IDNA domains without using mutable email as identity", () => {
    expect(parseIdentityProfile({
      email: "  Ａlice@BÜCHER.Example  ",
      givenName: "  Ａlice ",
      familyName: " Ångström ",
    })).toEqual({
      email: "Alice@BÜCHER.Example",
      normalizedEmail: "alice@xn--bcher-kva.example",
      givenName: "Alice",
      familyName: "Ångström",
    });
    expect(normalizeEmail("USER@EXAMPLE.ORG")).toBe("user@example.org");
    expect(parseIdentityProfile({
      email: `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(57)}.org`,
      givenName: "𐐀".repeat(128),
      familyName: "",
    }).normalizedEmail).toHaveLength(254);
  });

  it("rejects malformed and out-of-bound identity profiles without echoing input", () => {
    const invalid = [
      { email: "missing-at.example.org", givenName: "", familyName: "" },
      { email: ".a@example.org", givenName: "", familyName: "" },
      { email: "a..b@example.org", givenName: "", familyName: "" },
      { email: `a@${"b".repeat(64)}.org`, givenName: "", familyName: "" },
      { email: "a@example.org", givenName: "x".repeat(129), familyName: "" },
      { email: "a@example.org", givenName: "bad\u0000name", familyName: "" },
      { email: "a@example.org", givenName: "", familyName: "", role: "admin" },
    ];
    for (const value of invalid) {
      expect(() => parseIdentityProfile(value)).toThrowError(
        new IdentityError("invalid_identity_profile"),
      );
    }
  });

  it("accepts only exact canonical provider tuples and closed assertions", () => {
    expect(parseProviderIdentity({
      providerId: "workforce-oidc",
      issuer: "https://id.example.org",
      subject: "00u-immutable-subject",
    })).toEqual({
      providerId: "workforce-oidc",
      issuer: "https://id.example.org",
      subject: "00u-immutable-subject",
    });
    expect(parseProviderAssertion({
      providerId: "workforce-oidc",
      issuer: "https://id.example.org",
      subject: "subject-1",
      authenticationTime: 1_785_000_000_000,
      mfa: { verified: true, evidence: ["totp"] },
      profile: { email: "person@example.org", emailVerified: true },
    })).toMatchObject({
      providerId: "workforce-oidc",
      subject: "subject-1",
      mfa: { verified: true, evidence: ["totp"] },
    });

    for (const identity of [
      { providerId: "OIDC", issuer: "https://id.example.org", subject: "one" },
      { providerId: "oidc", issuer: "http://id.example.org", subject: "one" },
      { providerId: "oidc", issuer: "https://id.example.org/path", subject: "one" },
      { providerId: "oidc", issuer: "https://id.example.org/", subject: "one" },
      { providerId: "oidc", issuer: "https://id.example.org", subject: " one" },
      { providerId: "oidc", issuer: "https://id.example.org", subject: "bad\u0000subject" },
      { providerId: "oidc", issuer: "https://id.example.org", subject: "one", email: "one@example.org" },
    ]) {
      expect(() => parseProviderIdentity(identity)).toThrowError(
        new IdentityError("invalid_provider_identity"),
      );
    }
    expect(() => parseProviderAssertion({
      providerId: "oidc",
      issuer: "https://id.example.org",
      subject: "one",
      authenticationTime: 0,
      mfa: { verified: false, evidence: [], token: "prohibited" },
    })).toThrowError(new IdentityError("invalid_provider_assertion"));
  });

  it("permits exactly the approved account-state graph", () => {
    const valid = [
      ["invited", "enrollment_required"],
      ["enrollment_required", "active"],
      ["active", "suspended"],
      ["active", "deactivated"],
      ["suspended", "active"],
      ["suspended", "deactivated"],
      ["deactivated", "enrollment_required"],
    ] as const;
    for (const [current, next] of valid) {
      expect(() => requireIdentityStatusTransition(current, next)).not.toThrow();
    }
    for (const current of ["invited", "enrollment_required", "active", "suspended", "deactivated"] as const) {
      for (const next of ["invited", "enrollment_required", "active", "suspended", "deactivated"] as const) {
        if (!valid.some((entry) => entry[0] === current && entry[1] === next)) {
          expect(() => requireIdentityStatusTransition(current, next)).toThrowError(
            new IdentityError("invalid_identity_transition"),
          );
        }
      }
    }
  });

  it("protects the last active superadmin as a reusable predicate", () => {
    expect(() => requireLastActiveSuperadmin(
      2, "superadmin", "active", "admin", "active",
    )).not.toThrow();
    expect(() => requireLastActiveSuperadmin(
      1, "superadmin", "active", "superadmin", "suspended",
    )).toThrowError(new IdentityError("last_active_superadmin"));
    expect(() => requireLastActiveSuperadmin(
      1, "superadmin", "active", "admin", "active",
    )).toThrowError(new IdentityError("last_active_superadmin"));
    expect(() => requireLastActiveSuperadmin(
      1, "admin", "active", "user", "active",
    )).not.toThrow();
    expect(() => requireLastActiveSuperadmin(
      0, "superadmin", "active", "admin", "active",
    )).toThrowError(new IdentityError("last_active_superadmin"));
    expect(() => parseProviderIdentity({
      providerId: "oidc",
      issuer: "https://id.example.org",
      subject: "ü".repeat(128),
    })).toThrowError(new IdentityError("invalid_provider_identity"));
  });
});
