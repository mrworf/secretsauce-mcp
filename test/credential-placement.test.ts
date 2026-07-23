import { describe, expect, it } from "vitest";
import {
  CredentialPlacementError,
  normalizeCredentialPlacement,
} from "../src/credentialPlacement.js";

describe("credential placement normalization", () => {
  it("normalizes explicit header, query, and body placement", () => {
    expect(normalizeCredentialPlacement({
      kind: "header",
      name: "X-API-Key",
      prefix: "Bearer ",
      suffix: ":signed",
      enforce_header_ownership: true,
    })).toEqual({
      kind: "header",
      name: "X-API-Key",
      prefix: "Bearer ",
      suffix: ":signed",
      enforceHeaderOwnership: true,
    });
    expect(normalizeCredentialPlacement({ kind: "query", name: "api_key" }))
      .toMatchObject({ kind: "query", name: "api_key", enforceHeaderOwnership: false });
    expect(normalizeCredentialPlacement({ kind: "body", name: "password" }))
      .toMatchObject({ kind: "body", name: "password", enforceHeaderOwnership: false });
  });

  it.each([
    undefined,
    {},
    { kind: "path", name: "key" },
    { kind: "header", name: "Host" },
    { kind: "header", name: "X-Forwarded-For" },
    { kind: "header", name: "Cookie" },
    { kind: "header", name: "bad header" },
    { kind: "query", name: "key", enforce_header_ownership: true },
    { kind: "header", name: "Authorization", suffix: "ambiguous" },
    { kind: "header", name: "Authorization", prefix: "bad\r\n" },
    { kind: "header", name: "Authorization", extra: true },
  ])("rejects unsafe, ambiguous, or open placement: %j", (input) => {
    expect(() => normalizeCredentialPlacement(input)).toThrow(CredentialPlacementError);
  });
});
