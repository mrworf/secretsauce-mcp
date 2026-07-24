import { describe, expect, it } from "vitest";
import { validateConfig } from "../src/config.js";
import { GatewayError } from "../src/errors.js";
import { TokenBroker } from "../src/tokens.js";
import type { AuthContext, GatewayConfig } from "../src/types.js";

describe("reference broker", () => {
  it("returns aggregate-only reference state and invalidates only the requested boundary", () => {
    const broker = new TokenBroker(tokenConfig());
    const issued = broker.issueTokens(auth("henric@example.com"), {
      service: "portainer-prod",
      destination: "primary",
      access_ids: ["api_key", "password"],
      reason: "Inspect aggregate state.",
    });
    const secret = broker.issueOrReuseResponseSecret(
      auth("henric@example.com"),
      "portainer-prod",
      "returned-secret",
    );
    const unrelatedSecret = broker.issueOrReuseResponseSecret(
      auth("ada@example.com"),
      "portainer-prod",
      "unrelated-secret",
    );

    expect(broker.referenceAggregates({
      subject: "henric@example.com",
    })).toEqual({
      gref: { active: 2, expired: 0, invalid: 0 },
      sec: { active: 1, expired: 0, invalid: 0 },
    });
    expect(broker.invalidate({
      subject: "henric@example.com",
      credentialId: "api_key",
    })).toBe(1);
    expect(broker.referenceAggregates({
      subject: "henric@example.com",
    })).toMatchObject({
      gref: { active: 1 },
      sec: { active: 1 },
    });
    expect(broker.invalidate({ subject: "henric@example.com" })).toBe(2);
    expect(broker.stats()).toMatchObject({
      configured: 0,
      responseSecrets: 1,
    });
    expect(() => broker.validateTokenUse(auth("henric@example.com"), {
      service: "portainer-prod",
      destination: "primary",
    }, issued.tokens[0]!.token)).toThrow(GatewayError);
    expect(() => broker.validateResponseSecretUse(
      auth("henric@example.com"),
      "portainer-prod",
      secret.token,
    )).toThrow(GatewayError);
    expect(broker.validateResponseSecretUse(
      auth("ada@example.com"),
      "portainer-prod",
      unrelatedSecret.token,
    ).secret).toBe("unrelated-secret");
  });

  it("issues opaque references for authorized access and omits protected values from audit", () => {
    let now = 1_000;
    const broker = new TokenBroker(tokenConfig(), () => now);

    const result = broker.issueTokens(auth("henric@example.com"), {
      service: "portainer-prod",
      destination: "primary",
      access_ids: ["api_key", "password"],
      reason: "Inspect configured stacks.",
    });

    expect(result.tokens).toHaveLength(2);
    expect(result.tokens[0]?.token).toMatch(/^gref_/);
    expect(result.tokens[0]?.token).not.toContain("portainer-secret");
    expect(result.tokens[1]?.token).not.toBe(result.tokens[0]?.token);
    const auditJson = JSON.stringify(result.audit);
    expect(auditJson).not.toContain(result.tokens[0]?.token ?? "");
    expect(auditJson).not.toContain("portainer-secret");
    expect(result.audit.internal_reference_ids).toHaveLength(2);

    const originalMax = broker.validateTokenUse(auth("henric@example.com"), {
      service: "portainer-prod",
      destination: "primary",
    }, result.tokens[0]?.token ?? "").maxExpiresAt;
    now += 20;
    const used = broker.validateTokenUse(auth("henric@example.com"), {
      service: "portainer-prod",
      destination: "primary",
    }, result.tokens[0]?.token ?? "");

    expect(used.lastUsedAt).toBe(now);
    expect(used.maxExpiresAt).toBe(originalMax);
    expect(used.idleExpiresAt).toBeLessThanOrEqual(originalMax);
  });

  it("rejects missing reasons and unknown access ids", () => {
    const broker = new TokenBroker(tokenConfig());

    expectGatewayError(() => broker.issueTokens(auth("henric@example.com"), {
      service: "portainer-prod",
      destination: "primary",
      access_ids: ["api_key"],
      reason: " ",
    }), "reference_invalid");
    expectGatewayError(() => broker.issueTokens(auth("henric@example.com"), {
      service: "portainer-prod",
      destination: "primary",
      access_ids: ["missing"],
      reason: "Need a reference.",
    }), "unknown_access");
  });

  it("issues a precise reference-placement hint for configured affixes", () => {
    const config = tokenConfig();
    const credential = config.services["portainer-prod"]!.credentials[0]!;
    credential.usage.prefix = "Bearer ";
    const broker = new TokenBroker(config);

    const issued = broker.issueTokens(auth("henric@example.com"), {
      service: "portainer-prod", destination: "primary", access_ids: ["api_key"], reason: "Use the API.",
    });

    expect(issued.tokens[0]?.usage_hint).toBe('Set the X-API-Key header value to "Bearer <reference>".');
    expect(issued.tokens[0]?.usage_hint).not.toContain("portainer-secret");
  });

  it("rejects expired references", () => {
    let now = 1_000;
    const broker = new TokenBroker(tokenConfig(), () => now);
    const result = broker.issueTokens(auth("henric@example.com"), {
      service: "portainer-prod",
      destination: "primary",
      access_ids: ["api_key"],
      reason: "Need a reference.",
    });

    now += 101;

    expectGatewayError(() => broker.validateTokenUse(auth("henric@example.com"), {
      service: "portainer-prod",
      destination: "primary",
    }, result.tokens[0]?.token ?? ""), "reference_expired");
  });

  it("does not accept the removed tok prefix", () => {
    const broker = new TokenBroker(tokenConfig());

    expectGatewayError(() => broker.validateTokenUse(auth("henric@example.com"), {
      service: "portainer-prod",
      destination: "primary",
    }, "tok_removed"), "reference_invalid");
  });

  it("allows same-subject reference use across independent stateless requests", () => {
    const broker = new TokenBroker(tokenConfig());
    const result = broker.issueTokens(auth("henric@example.com"), {
      service: "portainer-prod",
      destination: "primary",
      access_ids: ["api_key"],
      reason: "Need a reference.",
    });
    const token = result.tokens[0]?.token ?? "";

    expect(broker.validateTokenUse(auth("henric@example.com"), {
      service: "portainer-prod",
      destination: "primary",
    }, token).credentialId).toBe("api_key");
  });

  it("rejects cross-user, cross-service, and cross-destination reference use", () => {
    const broker = new TokenBroker(tokenConfig());
    const result = broker.issueTokens(auth("henric@example.com"), {
      service: "portainer-prod",
      destination: "primary",
      access_ids: ["api_key"],
      reason: "Need a reference.",
    });
    const token = result.tokens[0]?.token ?? "";

    expectGatewayError(() => broker.validateTokenUse(auth("ada@example.com"), {
      service: "portainer-prod",
      destination: "primary",
    }, token), "reference_invalid");
    expectGatewayError(() => broker.validateTokenUse(auth("henric@example.com"), {
      service: "opnsense-home",
      destination: "primary",
    }, token), "reference_invalid");
    expectGatewayError(() => broker.validateTokenUse(auth("henric@example.com"), {
      service: "portainer-prod",
      destination: "secondary",
    }, token), "reference_invalid");
  });

  it("issues bound gateway access references without protected values", () => {
    let now = 1_000;
    const broker = new TokenBroker(tokenConfig(), () => now);
    const issued = broker.issueTokens(auth("henric@example.com"), {
      service: "frigate-local", destination: "primary", access_ids: ["gateway_access"], reason: "Inspect cameras.",
    });
    const token = issued.tokens[0]?.token ?? "";

    expect(issued.tokens).toMatchObject([{
      credential_id: "gateway_access",
      usage_hint: "Pass reference as service_reference",
    }]);
    expect(token).toMatch(/^gref_/);
    expect(JSON.stringify(issued.audit)).not.toContain(token);
    expect(broker.validateServiceReferenceUse(auth("henric@example.com"), {
      service: "frigate-local", destination: "primary",
    }, token)).toMatchObject({ kind: "service", accessId: "gateway_access" });

    expectGatewayError(() => broker.validateServiceReferenceUse(auth("ada@example.com"), {
      service: "frigate-local", destination: "primary",
    }, token), "reference_invalid");
    expectGatewayError(() => broker.validateServiceReferenceUse(auth("henric@example.com"), {
      service: "opnsense-home", destination: "primary",
    }, token), "reference_invalid");
    expectGatewayError(() => broker.validateServiceReferenceUse(auth("henric@example.com"), {
      service: "frigate-local", destination: "secondary",
    }, token), "reference_invalid");

    const credentialToken = broker.issueTokens(auth("henric@example.com"), {
      service: "portainer-prod", destination: "primary", access_ids: ["api_key"], reason: "Inspect stacks.",
    }).tokens[0]?.token ?? "";
    expectGatewayError(() => broker.validateServiceReferenceUse(auth("henric@example.com"), {
      service: "portainer-prod", destination: "primary",
    }, credentialToken), "reference_invalid");

    now += 101;
    expectGatewayError(() => broker.validateServiceReferenceUse(auth("henric@example.com"), {
      service: "frigate-local", destination: "primary",
    }, token), "reference_expired");
  });

  it("rejects unknown access ids for credential-free services", () => {
    const broker = new TokenBroker(tokenConfig());
    expectGatewayError(() => broker.issueTokens(auth("henric@example.com"), {
      service: "frigate-local", destination: "primary", access_ids: ["api_key"], reason: "Inspect cameras.",
    }), "unknown_access");
  });

  it("counts gateway access references against token capacity", () => {
    const broker = new TokenBroker(tokenConfig({ maxTokenRecords: 1, maxTokenRecordsPerSubject: 1 }));
    broker.issueTokens(auth("henric@example.com"), {
      service: "frigate-local", destination: "primary", access_ids: ["gateway_access"], reason: "Inspect cameras.",
    });
    expectGatewayError(() => broker.issueTokens(auth("henric@example.com"), {
      service: "frigate-local", destination: "primary", access_ids: ["gateway_access"], reason: "Inspect cameras again.",
    }), "capacity_exceeded");
    expect(broker.stats()).toEqual({ configured: 1, responseSecrets: 0, tokenValues: 1 });
  });

  it("issues and reuses service-scoped response secret references", () => {
    let now = 1_000;
    const broker = new TokenBroker(tokenConfig(), () => now);
    const first = broker.issueOrReuseResponseSecret(auth("henric@example.com"), "portainer-prod", "returned-secret");
    expect(first.token).toMatch(/^sec_/);
    expect(first.token).not.toContain("returned-secret");
    expect(first.reused).toBe(false);

    now += 20;
    const reused = broker.issueOrReuseResponseSecret(auth("henric@example.com"), "portainer-prod", "returned-secret");
    expect(reused.token).toBe(first.token);
    expect(reused.reused).toBe(true);
    expect(reused.record.lastUsedAt).toBe(now);
    expect(broker.validateResponseSecretUse(auth("henric@example.com"), "portainer-prod", first.token).secret).toBe("returned-secret");
  });

  it("binds persisted response references to the exact runtime authority", () => {
    const broker = new TokenBroker(tokenConfig());
    const bindings = {
      serviceId: "018f1f2e-7b3c-7a10-8000-000000000010",
      destination: "primary",
      destinationId: "018f1f2e-7b3c-7a10-8000-000000000011",
      snapshotId: "018f1f2e-7b3c-7a10-8000-000000000012",
      publicationGeneration: 3,
      serviceAuthorizationGeneration: 4,
      subjectSecurityEpoch: 5,
      globalReferenceEpoch: 6,
    };
    const issued = broker.withRuntimeSecrets(
      auth("henric@example.com"),
      "portainer-prod",
      new Map(),
      () => broker.issueOrReuseResponseSecret(
        auth("henric@example.com"),
        "portainer-prod",
        "returned-secret",
      ),
      bindings,
    );

    expect(issued.record).toMatchObject(bindings);
    expect(broker.preflightResponseSecretUse(
      auth("henric@example.com"),
      "portainer-prod",
      issued.token,
    )).toBe(issued.record);

    const replacement = broker.withRuntimeSecrets(
      auth("henric@example.com"),
      "portainer-prod",
      new Map(),
      () => broker.issueOrReuseResponseSecret(
        auth("henric@example.com"),
        "portainer-prod",
        "returned-secret",
      ),
      { ...bindings, destination: "secondary" },
    );
    expect(replacement.token).not.toBe(issued.token);
  });

  it("isolates response secret references by subject and service and expires them", () => {
    let now = 1_000;
    const broker = new TokenBroker(tokenConfig(), () => now);
    const issued = broker.issueOrReuseResponseSecret(auth("henric@example.com"), "portainer-prod", "returned-secret");
    const otherSubject = broker.issueOrReuseResponseSecret(auth("ada@example.com"), "portainer-prod", "returned-secret");
    const otherService = broker.issueOrReuseResponseSecret(auth("henric@example.com"), "opnsense-home", "returned-secret");
    expect(otherSubject.token).not.toBe(issued.token);
    expect(otherService.token).not.toBe(issued.token);
    expectGatewayError(() => broker.validateResponseSecretUse(auth("ada@example.com"), "portainer-prod", issued.token), "reference_invalid");
    expectGatewayError(() => broker.validateResponseSecretUse(auth("henric@example.com"), "opnsense-home", issued.token), "reference_invalid");
    now += 101;
    expectGatewayError(() => broker.validateResponseSecretUse(auth("henric@example.com"), "portainer-prod", issued.token), "reference_expired");
    const replacement = broker.issueOrReuseResponseSecret(auth("henric@example.com"), "portainer-prod", "returned-secret");
    expect(replacement.token).not.toBe(issued.token);
  });

  it("reuses the most recently used configured token across destinations", () => {
    let now = 1_000;
    const broker = new TokenBroker(tokenConfig(), () => now);
    const first = broker.issueTokens(auth("henric@example.com"), {
      service: "portainer-prod", destination: "primary", access_ids: ["api_key"], reason: "First token.",
    }).tokens[0]?.token ?? "";
    now += 10;
    const second = broker.issueTokens(auth("henric@example.com"), {
      service: "portainer-prod", destination: "secondary", access_ids: ["api_key"], reason: "Second token.",
    }).tokens[0]?.token ?? "";
    now += 10;
    broker.validateTokenUse(auth("henric@example.com"), { service: "portainer-prod", destination: "primary" }, first);
    now += 10;

    const match = broker.findConfiguredTokenForSecret(auth("henric@example.com"), "portainer-prod", "portainer-secret");
    expect(match?.token).toBe(first);
    expect(match?.record.lastUsedAt).toBe(now);
    expect(match?.token).not.toBe(second);
  });

  it("does not reverse-match expired, cross-subject, cross-service, or unknown configured values", () => {
    let now = 1_000;
    const broker = new TokenBroker(tokenConfig(), () => now);
    broker.issueTokens(auth("henric@example.com"), {
      service: "portainer-prod", destination: "primary", access_ids: ["api_key"], reason: "Token.",
    });
    expect(broker.findConfiguredTokenForSecret(auth("ada@example.com"), "portainer-prod", "portainer-secret")).toBeUndefined();
    expect(broker.findConfiguredTokenForSecret(auth("henric@example.com"), "opnsense-home", "portainer-secret")).toBeUndefined();
    expect(broker.findConfiguredTokenForSecret(auth("henric@example.com"), "portainer-prod", "unknown")).toBeUndefined();
    now += 101;
    expect(broker.findConfiguredTokenForSecret(auth("henric@example.com"), "portainer-prod", "portainer-secret")).toBeUndefined();
  });

  it("sweeps expired configured and response-secret records from every index", () => {
    let now = 1_000;
    const broker = new TokenBroker(tokenConfig(), () => now);
    broker.issueTokens(auth("henric@example.com"), {
      service: "portainer-prod", destination: "primary", access_ids: ["api_key"], reason: "Token.",
    });
    broker.issueOrReuseResponseSecret(auth("henric@example.com"), "portainer-prod", "returned-secret");
    expect(broker.stats()).toEqual({ configured: 1, responseSecrets: 1, tokenValues: 2 });
    now += 101;
    broker.sweepExpired(now);
    expect(broker.stats()).toEqual({ configured: 0, responseSecrets: 0, tokenValues: 0 });
  });

  it("enforces global and per-subject capacity without partial multi-token issuance", () => {
    const atomicBroker = new TokenBroker(tokenConfig({ maxTokenRecords: 1, maxTokenRecordsPerSubject: 1 }));
    expectGatewayError(() => atomicBroker.issueTokens(auth("henric@example.com"), {
      service: "portainer-prod", destination: "primary", access_ids: ["api_key", "password"], reason: "Too many.",
    }), "capacity_exceeded");
    expect(atomicBroker.stats()).toEqual({ configured: 0, responseSecrets: 0, tokenValues: 0 });

    atomicBroker.issueOrReuseResponseSecret(auth("henric@example.com"), "portainer-prod", "one");
    expectGatewayError(() => atomicBroker.issueOrReuseResponseSecret(auth("henric@example.com"), "portainer-prod", "two"), "capacity_exceeded");
    expectGatewayError(() => atomicBroker.issueOrReuseResponseSecret(auth("ada@example.com"), "portainer-prod", "other"), "capacity_exceeded");

    const perSubject = new TokenBroker(tokenConfig({ maxTokenRecords: 2, maxTokenRecordsPerSubject: 1 }));
    perSubject.issueOrReuseResponseSecret(auth("henric@example.com"), "portainer-prod", "one");
    expectGatewayError(() => perSubject.issueOrReuseResponseSecret(auth("henric@example.com"), "portainer-prod", "two"), "capacity_exceeded");
    expect(perSubject.issueOrReuseResponseSecret(auth("ada@example.com"), "portainer-prod", "other").token).toMatch(/^sec_/);
  });
});

function tokenConfig(options: { maxTokenRecords?: number; maxTokenRecordsPerSubject?: number } = {}): GatewayConfig {
  return validateConfig({
    server: { listen: "127.0.0.1:8080", mcp_path: "/mcp" },
    auth: { mode: "bearer", bearer: { token_env: "TEST_GATEWAY_TOKEN" } },
    tokens: { idle_ttl: "50ms", max_ttl: "100ms" },
    limits: {
      max_token_records: options.maxTokenRecords ?? 10_000,
      max_token_records_per_subject: options.maxTokenRecordsPerSubject ?? 1_000,
    },
    services: {
      "portainer-prod": {
        type: "http",
        name: "Portainer Production",
        destinations: [
          { name: "primary", base_url: "https://portainer.internal:9443", ports: [9443] },
          { name: "secondary", base_url: "https://portainer-lab.internal:9443", ports: [9443] },
        ],
        credentials: [
          {
            id: "api_key",
            usage: { kind: "header", name: "X-API-Key" },
            source: { kind: "env", name: "PORTAINER_API_KEY" },
          },
          {
            id: "password",
            usage: { kind: "body", name: "password" },
            source: { kind: "env", name: "PORTAINER_PASSWORD" },
          },
        ],
        access: { users: ["henric@example.com"] },
      },
      "opnsense-home": {
        type: "http",
        name: "OPNsense Home",
        destinations: [{ name: "primary", base_url: "https://opnsense.internal" }],
        credentials: [{
          id: "api_key",
          usage: { kind: "header", name: "X-API-Key" },
          source: { kind: "env", name: "OPNSENSE_API_KEY" },
        }],
        access: { users: ["henric@example.com"] },
      },
      "frigate-local": {
        type: "http",
        name: "Frigate Local",
        no_auth: true,
        destinations: [
          { name: "primary", base_url: "https://frigate.internal" },
          { name: "secondary", base_url: "https://frigate-secondary.internal" },
        ],
        access: { users: ["henric@example.com"] },
      },
    },
  }, {
    TEST_GATEWAY_TOKEN: "dev-token",
    PORTAINER_API_KEY: "portainer-secret",
    PORTAINER_PASSWORD: "password-secret",
    OPNSENSE_API_KEY: "opnsense-secret",
  });
}

function auth(subject: string): AuthContext {
  return {
    subject,
    scopes: ["gateway.references"],
    mode: "bearer",
  };
}

function expectGatewayError(fn: () => unknown, code: GatewayError["code"]) {
  try {
    fn();
    throw new Error("Expected gateway error");
  } catch (error) {
    expect(error).toBeInstanceOf(GatewayError);
    expect((error as GatewayError).code).toBe(code);
  }
}
