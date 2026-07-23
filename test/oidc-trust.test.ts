import { describe, expect, it } from "vitest";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  OidcTrustClient,
  OidcTrustError,
  type OidcNetwork,
  type OidcNetworkResponse,
} from "../src/identity/oidcTrust.js";
import type { IdentityConfig, OidcProviderConfig } from "../src/types.js";

describe("pinned generic OIDC discovery and JWKS trust", () => {
  it("accepts exact discovery, pins public DNS, caches it, and force-refreshes rotated keys", async () => {
    const fixture = network();
    const client = new OidcTrustClient(limits(), fixture.value, fixture.now);
    const discovered = await client.discover(provider());
    expect(discovered).toMatchObject({
      issuer: "https://id.example.org/tenant",
      authorizationEndpoint: "https://id.example.org/authorize",
      tokenEndpoint: "https://id.example.org/token",
      jwksUri: "https://keys.example.org/jwks",
      signingAlgorithms: ["RS256"],
    });
    expect(fixture.requests).toHaveLength(1);
    await client.discover(provider());
    expect(fixture.requests).toHaveLength(1);

    expect((await client.jwks(provider())).keys[0]?.kid).toBe("key-1");
    fixture.responses.set("https://keys.example.org/jwks", response({
      keys: [rsaKey("key-2")],
    }));
    expect((await client.jwks(provider())).keys[0]?.kid).toBe("key-1");
    expect((await client.jwks(provider(), true)).keys[0]?.kid).toBe("key-2");
    expect(fixture.resolutions.every((host) =>
      host === "id.example.org" || host === "keys.example.org")).toBe(true);
  });

  it("verifies exact token bindings and refreshes JWKS once for signing-key rotation", async () => {
    const first = await generateKeyPair("RS256");
    const second = await generateKeyPair("RS256");
    const firstJwk = {
      ...await exportJWK(first.publicKey),
      kid: "key-1",
      alg: "RS256",
      use: "sig",
      key_ops: ["verify"],
    };
    const secondJwk = {
      ...await exportJWK(second.publicKey),
      kid: "key-2",
      alg: "RS256",
      use: "sig",
      key_ops: ["verify"],
    };
    const fixture = network();
    fixture.responses.set("https://keys.example.org/jwks", response({ keys: [firstJwk] }));
    const client = new OidcTrustClient(limits(), fixture.value, fixture.now);
    await client.jwks(provider());
    fixture.responses.set("https://keys.example.org/jwks", response({ keys: [secondJwk] }));
    const nonce = "n".repeat(43);
    const issuedAt = Math.trunc(fixture.now() / 1_000);
    const token = await new SignJWT({
      nonce,
      auth_time: issuedAt - 30,
      amr: ["pwd", "otp"],
    })
      .setProtectedHeader({ alg: "RS256", kid: "key-2" })
      .setIssuer(provider().issuer)
      .setAudience(provider().clientId)
      .setSubject("rotated-subject")
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + 300)
      .sign(second.privateKey);

    await expect(client.verifyIdToken(provider(), token, nonce)).resolves.toMatchObject({
      subject: "rotated-subject",
      mfa: { verified: true, evidence: ["amr.pwd", "amr.otp"] },
    });
    expect(fixture.requests.filter((url) => url === "https://keys.example.org/jwks"))
      .toHaveLength(2);
    await expect(client.verifyIdToken(provider(), token, "wrong".repeat(9)))
      .rejects.toEqual(new OidcTrustError());

    const elliptic = await generateKeyPair("ES256");
    const ellipticJwk = {
      ...await exportJWK(elliptic.publicKey),
      kid: "key-ec",
      alg: "ES256",
      use: "sig",
      key_ops: ["verify"],
    };
    const ellipticFixture = network();
    ellipticFixture.responses.set(discoveryUrl(), response({
      ...discovery(),
      id_token_signing_alg_values_supported: ["RS256", "ES256"],
    }));
    ellipticFixture.responses.set(
      "https://keys.example.org/jwks",
      response({ keys: [ellipticJwk] }),
    );
    const ellipticToken = await new SignJWT({
      nonce,
      auth_time: issuedAt,
      acr: "urn:example:loa:2",
    })
      .setProtectedHeader({ alg: "ES256", kid: "key-ec" })
      .setIssuer(provider().issuer)
      .setAudience(provider().clientId)
      .setSubject("elliptic-subject")
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + 300)
      .sign(elliptic.privateKey);
    const ellipticClient = new OidcTrustClient(
      limits(),
      ellipticFixture.value,
      ellipticFixture.now,
    );
    await expect(ellipticClient.jwks(provider())).resolves.toMatchObject({
      keys: [expect.objectContaining({ kid: "key-ec", alg: "ES256" })],
    });
    await expect(ellipticClient.verifyIdToken(provider(), ellipticToken, nonce))
      .resolves.toMatchObject({
      subject: "elliptic-subject",
      mfa: { evidence: ["acr"] },
    });
  });

  it("rejects redirects, unsafe DNS, oversized/non-JSON responses, and invalid discovery", async () => {
    const cases: Array<(fixture: ReturnType<typeof network>) => void> = [
      (fixture) => {
        fixture.responses.set(discoveryUrl(), {
          ...response(discovery()),
          url: "https://redirect.example.org/discovery",
        });
      },
      (fixture) => {
        fixture.addresses.set("keys.example.org", "127.0.0.1");
      },
      (fixture) => {
        fixture.responses.set(discoveryUrl(), {
          ...response(discovery()),
          headers: new Headers({ "content-type": "text/html" }),
        });
      },
      (fixture) => {
        fixture.responses.set(discoveryUrl(), {
          ...response(discovery()),
          body: new Uint8Array(300_000),
        });
      },
      (fixture) => {
        fixture.responses.set(discoveryUrl(), response({
          ...discovery(),
          issuer: "https://other.example.org",
        }));
      },
      (fixture) => {
        fixture.responses.set(discoveryUrl(), response({
          ...discovery(),
          code_challenge_methods_supported: ["plain"],
        }));
      },
      (fixture) => {
        fixture.responses.set(discoveryUrl(), response({
          ...discovery(),
          token_endpoint_auth_methods_supported: ["client_secret_post"],
        }));
      },
    ];
    for (const alter of cases) {
      const fixture = network();
      alter(fixture);
      await expect(new OidcTrustClient(limits(), fixture.value).discover(provider()))
        .rejects.toEqual(new OidcTrustError());
    }
  });

  it("rejects private, duplicate, malformed, and algorithm-confused JWKS keys", async () => {
    for (const keys of [
      [{ ...rsaKey("one"), d: "private" }],
      [rsaKey("same"), rsaKey("same")],
      [{ ...rsaKey("one"), alg: "HS256" }],
      [{ ...rsaKey("one"), use: "enc" }],
      [{ kid: "ec", kty: "EC", crv: "P-384", x: "x", y: "y" }],
      [],
    ]) {
      const fixture = network();
      fixture.responses.set("https://keys.example.org/jwks", response({ keys }));
      const client = new OidcTrustClient(limits(), fixture.value);
      await expect(client.jwks(provider())).rejects.toEqual(new OidcTrustError());
    }
  });
});

function provider(): OidcProviderConfig {
  return {
    id: "workforce",
    displayName: "Workforce",
    issuer: "https://id.example.org/tenant",
    clientId: "secretsauce",
    clientSecretFile: "/unused/client.secret",
    redirectOrigin: "https://control.example.org",
    scopes: ["openid"],
    allowedSigningAlgorithms: ["RS256", "ES256"],
    clockSkewSeconds: 60,
    maxAuthenticationAgeMs: 43_200_000,
    assuranceAnyOf: [
      { acr: "urn:example:loa:2" },
      { amr: ["pwd", "otp"] },
    ],
    profileClaims: { providerOwnedFields: [] },
  };
}

function limits(): NonNullable<IdentityConfig["oidc"]> {
  return {
    providers: { workforce: provider() },
    flowTtlMs: 300_000,
    networkTimeoutMs: 5_000,
    maxResponseBodyBytes: 262_144,
    maxInflight: 4,
    maxInflightPerProvider: 2,
    maxFlowRecords: 10_000,
    maxCacheRecords: 2,
  };
}

function discovery() {
  return {
    issuer: "https://id.example.org/tenant",
    authorization_endpoint: "https://id.example.org/authorize",
    token_endpoint: "https://id.example.org/token",
    jwks_uri: "https://keys.example.org/jwks",
    response_types_supported: ["code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["client_secret_basic"],
    id_token_signing_alg_values_supported: ["RS256"],
  };
}

function discoveryUrl(): string {
  return "https://id.example.org/tenant/.well-known/openid-configuration";
}

function rsaKey(kid: string) {
  return {
    kid,
    kty: "RSA",
    alg: "RS256",
    use: "sig",
    key_ops: ["verify"],
    n: "sXchDaQebH_MnDfqRzL4n9bAm0HDiJAsA0hHYq1Z9Q",
    e: "AQAB",
  };
}

function response(value: unknown): OidcNetworkResponse {
  return {
    status: 200,
    headers: new Headers({
      "content-type": "application/json",
      "cache-control": "max-age=300",
    }),
    body: Buffer.from(JSON.stringify(value)),
    url: "",
  };
}

function network() {
  const now = { value: 1_785_000_000_000 };
  const responses = new Map<string, OidcNetworkResponse>([
    [discoveryUrl(), response(discovery())],
    ["https://keys.example.org/jwks", response({ keys: [rsaKey("key-1")] })],
  ]);
  const addresses = new Map<string, string>([
    ["id.example.org", "93.184.216.34"],
    ["keys.example.org", "93.184.216.35"],
  ]);
  const requests: string[] = [];
  const resolutions: string[] = [];
  const value: OidcNetwork = {
    resolve: async (hostname) => {
      resolutions.push(hostname);
      return [{ address: addresses.get(hostname) ?? "93.184.216.36", family: 4 }];
    },
    request: async (input) => {
      requests.push(input.url.toString());
      const selected = responses.get(input.url.toString());
      if (selected === undefined) throw new Error("missing fixture");
      return {
        ...selected,
        url: selected.url === "" ? input.url.toString() : selected.url,
      };
    },
  };
  return {
    value,
    responses,
    addresses,
    requests,
    resolutions,
    now: () => now.value,
  };
}
