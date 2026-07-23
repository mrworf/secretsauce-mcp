import { describe, expect, it } from "vitest";
import {
  normalizeVerifiedOidcClaims,
  OidcAssuranceError,
} from "../src/identity/oidcAssurance.js";
import type { OidcProviderConfig } from "../src/types.js";

const NOW = 1_785_000_000_000;

describe("vendor-neutral OIDC assurance normalization", () => {
  it("accepts an exact acr clause or a complete amr clause and allowlists profile claims", () => {
    expect(normalizeVerifiedOidcClaims(provider(), {
      sub: "immutable-subject",
      auth_time: NOW / 1_000 - 60,
      acr: "urn:example:loa:2",
      email: "person@example.org",
      email_verified: true,
      given_name: "Person",
      family_name: "Example",
      role: "superadmin",
      groups: ["owners"],
    }, NOW)).toEqual({
      providerId: "workforce",
      issuer: "https://id.example.org/tenant",
      subject: "immutable-subject",
      authenticationTime: NOW - 60_000,
      mfa: { verified: true, evidence: ["acr"] },
      profile: {
        email: "person@example.org",
        emailVerified: true,
        givenName: "Person",
        familyName: "Example",
      },
    });

    expect(normalizeVerifiedOidcClaims(provider(), {
      sub: "second-subject",
      auth_time: NOW / 1_000,
      amr: ["pwd", "otp", "hwk"],
    }, NOW).mfa).toEqual({
      verified: true,
      evidence: ["amr.pwd", "amr.otp"],
    });
  });

  it("requires one complete configured clause and rejects ambiguous assurance evidence", () => {
    for (const claims of [
      { sub: "one", auth_time: NOW / 1_000 },
      { sub: "one", auth_time: NOW / 1_000, acr: "urn:example:loa:1" },
      { sub: "one", auth_time: NOW / 1_000, amr: ["pwd"] },
      { sub: "one", auth_time: NOW / 1_000, amr: ["pwd", "otp", "otp"] },
      { sub: "one", auth_time: NOW / 1_000, amr: "pwd otp" },
      { sub: "one", auth_time: NOW / 1_000, acr: ["urn:example:loa:2"] },
    ]) {
      expect(() => normalizeVerifiedOidcClaims(provider(), claims, NOW))
        .toThrowError(new OidcAssuranceError());
    }
  });

  it("bounds authentication time, claim cardinality, text, and mapped claim types", () => {
    const tooMany = Object.fromEntries(
      Array.from({ length: 101 }, (_, index) => [`claim_${index}`, index]),
    );
    for (const claims of [
      { sub: "one", auth_time: NOW / 1_000 + 61, acr: "urn:example:loa:2" },
      { sub: "one", auth_time: NOW / 1_000 - 12 * 3_600 - 61, acr: "urn:example:loa:2" },
      { sub: "bad\u0000subject", auth_time: NOW / 1_000, acr: "urn:example:loa:2" },
      { sub: "one", auth_time: 1.5, acr: "urn:example:loa:2" },
      {
        sub: "one",
        auth_time: NOW / 1_000,
        acr: "urn:example:loa:2",
        email_verified: "true",
      },
      {
        sub: "one",
        auth_time: NOW / 1_000,
        acr: "urn:example:loa:2",
        given_name: "x".repeat(513),
      },
      {
        ...tooMany,
        sub: "one",
        auth_time: NOW / 1_000,
        acr: "urn:example:loa:2",
      },
    ]) {
      expect(() => normalizeVerifiedOidcClaims(provider(), claims, NOW))
        .toThrowError(new OidcAssuranceError());
    }
  });
});

function provider(): OidcProviderConfig {
  return {
    id: "workforce",
    displayName: "Workforce",
    issuer: "https://id.example.org/tenant",
    clientId: "secretsauce",
    redirectOrigin: "https://control.example.org",
    scopes: ["openid", "profile", "email"],
    allowedSigningAlgorithms: ["RS256", "ES256"],
    clockSkewSeconds: 60,
    maxAuthenticationAgeMs: 12 * 3_600_000,
    assuranceAnyOf: [
      { acr: "urn:example:loa:2" },
      { amr: ["pwd", "otp"] },
    ],
    profileClaims: {
      email: "email",
      emailVerified: "email_verified",
      givenName: "given_name",
      familyName: "family_name",
      providerOwnedFields: ["given_name", "family_name"],
    },
  };
}
