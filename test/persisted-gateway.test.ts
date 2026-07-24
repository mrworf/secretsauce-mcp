import { afterEach, describe, expect, it } from "vitest";
import { validateConfig } from "../src/config.js";
import { GatewayError } from "../src/errors.js";
import {
  executeServiceRequest,
  isConfiguredSelfTarget,
} from "../src/gateway.js";
import {
  ApiKeyVerifierPool,
  type ApiKeyAuthenticationCandidate,
} from "../src/apiKeys.js";
import { createRequestDependencies, type RequestDependencies } from "../src/requestDependencies.js";
import type {
  PersistedRuntimeServiceView,
  RuntimeAuthority,
  RuntimeReferenceGrant,
} from "../src/runtimeAuthority.js";
import type { RuntimeServiceSnapshot } from "../src/runtimeSnapshots.js";
import type {
  RuntimeVault,
  RuntimeVaultResolveInput,
} from "../src/runtimeVault.js";
import type { AuthContext, GatewayConfig } from "../src/types.js";
import { ActiveSelfApiKeyDetector } from "../src/selfApiKeyProtection.js";

const SUBJECT = "018f1f2e-7b3c-7a10-8000-000000000001";
const SERVICE_ID = "018f1f2e-7b3c-7a10-8000-000000000010";
const DESTINATION_ID = "018f1f2e-7b3c-7a10-8000-000000000011";
const CREDENTIAL_ID = "018f1f2e-7b3c-7a10-8000-000000000012";
const SNAPSHOT_ID = "018f1f2e-7b3c-7a10-8000-000000000013";
const POLICY_ID = "018f1f2e-7b3c-7a10-8000-000000000014";
const SECOND_CREDENTIAL_ID = "018f1f2e-7b3c-7a10-8000-000000000017";
const LOCATOR = "12345678-1234-4234-8234-123456789abc";
const ACTIVE_SELF_KEY =
  "ssk_v1_AQEBAQEBAQEBAQEB_AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI";
const ACTIVE_SELF_KEY_ID = "018f1f2e-7b3c-7a10-8000-000000000099";
const SUPPORTED_HASH =
  "$argon2id$v=19$m=65536,p=1,t=3$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const resources: RequestDependencies[] = [];

afterEach(async () => {
  await Promise.all(resources.splice(0).map(async (dependencies) => {
    dependencies.auditSink.close();
    await dependencies.secretRuntime.pool.close();
  }));
});

describe("persisted gateway privileged ordering", () => {
  it("denies unsafe destinations and policy before vault resolution", async () => {
    for (const testCase of [
      { path: "/api/%2fadmin", policyMode: "allow" as const, code: "destination_not_allowed" },
      { path: "/api/echo", policyMode: "deny" as const, code: "policy_denied" },
    ]) {
      const fixture = runtimeRequestFixture(testCase.policyMode);
      await expect(executeServiceRequest(
        fixture.config,
        fixture.auth,
        {
          service: "runtime-api",
          destination: "primary",
          method: "GET",
          path: testCase.path,
          headers: { "X-API-Key": fixture.reference },
          reason: "Verify preflight ordering.",
        },
        fixture.dependencies,
      )).rejects.toMatchObject({ code: testCase.code });
      expect(fixture.vault.resolveCalls).toBe(0);
      if (testCase.code === "policy_denied") {
        const serialized = JSON.stringify(fixture.dependencies.auditSink.events);
        expect(fixture.dependencies.auditSink.events).toContainEqual(
          expect.objectContaining({
            type: "service_request",
            service: SERVICE_ID,
            destination: DESTINATION_ID,
            policy_decision: "deny",
            error_code: "policy_denied",
          }),
        );
        expect(serialized).not.toContain(fixture.reference);
      }
    }
  });

  it("rejects capacity before consuming a reference or resolving vault data", async () => {
    const fixture = runtimeRequestFixture("allow", {
      maxServiceRequestsInflight: 1,
      maxServiceRequestsInflightPerSubject: 1,
      maxServiceRequestsInflightPerService: 1,
    });
    const release = fixture.dependencies.capabilities.serviceRequestLimiter.acquire(
      fixture.auth.subject,
      SERVICE_ID,
    )!;
    try {
      await expect(executeServiceRequest(
        fixture.config,
        fixture.auth,
        request(fixture.reference),
        fixture.dependencies,
      )).rejects.toMatchObject({ code: "capacity_exceeded" });
      expect(fixture.vault.resolveCalls).toBe(0);
    } finally {
      release();
    }
    expect(() => fixture.dependencies.capabilities.tokenBroker.preflightTokenUse(
      fixture.auth,
      { service: "runtime-api", destination: "primary" },
      fixture.reference,
    )).not.toThrow();
    expect(fixture.dependencies.auditSink.events).toContainEqual(
      expect.objectContaining({
        type: "service_request",
        service: SERVICE_ID,
        destination: DESTINATION_ID,
        error_code: "capacity_exceeded",
      }),
    );
    expect(JSON.stringify(fixture.dependencies.auditSink.events))
      .not.toContain(fixture.reference);
  });

  it("rejects unsafe headers, cookies, and oversized raw bodies before vault", async () => {
    const cases = [
      {
        input: {
          ...request("REFERENCE"),
          headers: { "X-API-Key": "REFERENCE", host: "attacker.example.org" },
        },
        code: "destination_not_allowed",
      },
      {
        input: {
          ...request("REFERENCE"),
          headers: { "X-API-Key": "REFERENCE", cookie: "session=opaque" },
        },
        code: "cookie_not_allowed",
      },
      {
        input: {
          ...request("REFERENCE"),
          method: "POST",
          body: "x".repeat(1_048_577),
        },
        code: "request_too_large",
      },
      {
        input: {
          ...request("REFERENCE"),
          method: "POST",
          headers: {
            "X-API-Key": "REFERENCE",
            "content-type": "application/json",
          },
          body: "{\"REFERENCE\":\"not-a-valid-placement\"}",
        },
        code: "reference_invalid",
      },
      {
        input: {
          ...request("REFERENCE"),
          query: { REFERENCE: "not-a-valid-placement" },
        },
        code: "reference_invalid",
      },
    ];
    for (const testCase of cases) {
      const fixture = runtimeRequestFixture("allow");
      const input = JSON.parse(
        JSON.stringify(testCase.input).replaceAll("REFERENCE", fixture.reference),
      );
      await expect(executeServiceRequest(
        fixture.config,
        fixture.auth,
        input,
        fixture.dependencies,
      )).rejects.toMatchObject({ code: testCase.code });
      expect(fixture.vault.resolveCalls).toBe(0);
    }
  });

  it("maps vault failure only after authorization, policy, and admission", async () => {
    const fixture = runtimeRequestFixture("allow");
    await expect(executeServiceRequest(
      fixture.config,
      fixture.auth,
      request(fixture.reference),
      fixture.dependencies,
    )).rejects.toMatchObject({ code: "downstream_error" });
    expect(fixture.vault.resolveCalls).toBe(1);
  });

  it("resolves and zeroizes an authorized credential only inside downstream work", async () => {
    const received: string[] = [];
    const server = createServer((request, response) => {
      received.push(String(request.headers["x-api-key"] ?? ""));
      response.end("ok");
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("listener unavailable");
    }
    const vault = new SuccessfulRuntimeVault("runtime-secret");
    const fixture = runtimeRequestFixture("allow", undefined, {
      vault,
      destination: {
        baseUrl: `http://127.0.0.1:${address.port}/`,
        schemes: ["http"],
        hosts: [{ type: "exact", value: "127.0.0.1" }],
        ports: [address.port],
        tlsVerify: false,
      },
    });
    try {
      await expect(executeServiceRequest(
        fixture.config,
        fixture.auth,
        request(fixture.reference),
        fixture.dependencies,
      )).resolves.toMatchObject({
        status_code: 200,
        body: "ok",
        tls: { verify: false },
      });
      expect(received).toEqual(["runtime-secret"]);
      expect(vault.resolveCalls).toBe(1);
      expect(vault.lastBuffer?.every((value) => value === 0)).toBe(true);
    } finally {
      server.close();
      await once(server, "close");
    }
  });

  it("blocks raw active self keys in structural header, query, and body values before vault or downstream", async () => {
    for (const rawPlacement of [
      { headers: { "X-API-Key": "REFERENCE", "X-Raw": `Bearer ${ACTIVE_SELF_KEY}` } },
      { query: { nested: [ACTIVE_SELF_KEY] } },
      {
        method: "POST",
        headers: { "X-API-Key": "REFERENCE" },
        body: { nested: { value: ACTIVE_SELF_KEY } },
      },
    ]) {
      const fixture = runtimeRequestFixture("allow", undefined, {
        selfKey: { approved: false },
        destination: {
          baseUrl: "https://control.example.org/",
          schemes: ["https"],
          hosts: [{ type: "exact", value: "control.example.org" }],
          ports: [443],
          tlsVerify: true,
        },
      });
      fixture.config.server.resource = "https://control.example.org";
      const input = JSON.parse(JSON.stringify({
        ...request(fixture.reference),
        ...rawPlacement,
      }).replaceAll("REFERENCE", fixture.reference));
      await expect(executeServiceRequest(
        fixture.config,
        fixture.auth,
        input,
        fixture.dependencies,
      )).rejects.toMatchObject({ code: "self_api_key_denied" });
      expect(fixture.vault.resolveCalls).toBe(0);
      expect(fixture.dependencies.auditSink.events).toContainEqual(
        expect.objectContaining({
          type: "self_api_key_blocked",
          management_identity_id: ACTIVE_SELF_KEY_ID,
          last_four_snapshot: ACTIVE_SELF_KEY.slice(-4),
        }),
      );
      expect(JSON.stringify(fixture.dependencies.auditSink.events))
        .not.toContain(ACTIVE_SELF_KEY);
    }
  });

  it("blocks an unapproved vault key and permits an exact approved generation through the ordinary pipeline", async () => {
    const blocked = runtimeRequestFixture("allow", undefined, {
      vault: new SuccessfulRuntimeVault(ACTIVE_SELF_KEY),
      selfKey: { approved: false },
      destination: {
        baseUrl: "https://control.example.org/",
        schemes: ["https"],
        hosts: [{ type: "exact", value: "control.example.org" }],
        ports: [443],
        tlsVerify: true,
      },
    });
    blocked.config.server.resource = "https://control.example.org";
    await expect(executeServiceRequest(
      blocked.config,
      blocked.auth,
      request(blocked.reference),
      blocked.dependencies,
    )).rejects.toMatchObject({ code: "self_api_key_denied" });
    expect(blocked.vault.resolveCalls).toBe(1);
    expect(blocked.approvalChecks).toBe(1);
    expect(blocked.dependencies.auditSink.events).toContainEqual(
      expect.objectContaining({
        type: "self_api_key_blocked",
        credential_id: CREDENTIAL_ID,
      }),
    );

    const received: string[] = [];
    const server = createServer((request, response) => {
      received.push(String(request.headers["x-api-key"] ?? ""));
      response.end("ok");
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("listener unavailable");
    }
    const allowed = runtimeRequestFixture("allow", undefined, {
      vault: new SuccessfulRuntimeVault(ACTIVE_SELF_KEY),
      selfKey: { approved: true },
      destination: {
        baseUrl: `http://127.0.0.1:${address.port}/`,
        schemes: ["http"],
        hosts: [{ type: "exact", value: "127.0.0.1" }],
        ports: [address.port],
        tlsVerify: false,
      },
    });
    allowed.config.server.resource = `http://127.0.0.1:${address.port}`;
    try {
      await expect(executeServiceRequest(
        allowed.config,
        allowed.auth,
        request(allowed.reference),
        allowed.dependencies,
      )).resolves.toMatchObject({ status_code: 200 });
      expect(received).toEqual([ACTIVE_SELF_KEY]);
      expect(allowed.approvalChecks).toBe(1);
      expect(allowed.dependencies.auditSink.events).toContainEqual(
        expect.objectContaining({
          type: "self_api_key_approved_use",
          credential_id: CREDENTIAL_ID,
        }),
      );
    } finally {
      server.close();
      await once(server, "close");
    }
  });

  it("matches configured self origins canonically without broadening to near hosts", () => {
    const config = runtimeConfig({
      maxServiceRequestsInflight: 4,
      maxServiceRequestsInflightPerSubject: 2,
      maxServiceRequestsInflightPerService: 2,
    });
    config.server.resource = "https://CONTROL.example.org";
    expect(isConfiguredSelfTarget(
      config,
      new URL("https://control.example.org:443/path"),
    )).toBe(true);
    expect(isConfiguredSelfTarget(
      config,
      new URL("https://control.example.org.evil.test/path"),
    )).toBe(false);
    expect(isConfiguredSelfTarget(
      config,
      new URL("http://control.example.org/path"),
    )).toBe(false);
  });

  it("requires every requested credential policy and resolves multiple credentials", async () => {
    const received: Array<[string, string]> = [];
    const server = createServer((request, response) => {
      received.push([
        String(request.headers["x-api-key"] ?? ""),
        String(request.headers["x-second-key"] ?? ""),
      ]);
      response.end("ok");
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("listener unavailable");
    }
    const vault = new SuccessfulRuntimeVault(new Map([
      [CREDENTIAL_ID, "first-secret"],
      [SECOND_CREDENTIAL_ID, "second-secret"],
    ]));
    const fixture = runtimeRequestFixture("allow", undefined, {
      vault,
      multiCredential: true,
      destination: {
        baseUrl: `http://127.0.0.1:${address.port}/`,
        schemes: ["http"],
        hosts: [{ type: "exact", value: "127.0.0.1" }],
        ports: [address.port],
        tlsVerify: false,
      },
    });
    try {
      await expect(executeServiceRequest(
        fixture.config,
        fixture.auth,
        {
          ...request(fixture.references[0]!),
          headers: {
            "X-API-Key": fixture.references[0]!,
            "X-Second-Key": fixture.references[1]!,
          },
        },
        fixture.dependencies,
      )).resolves.toMatchObject({ status_code: 200 });
      expect(received).toEqual([["first-secret", "second-secret"]]);
      expect(vault.resolveCalls).toBe(2);
      expect(vault.buffers.every(
        (buffer) => buffer.every((value) => value === 0),
      )).toBe(true);
    } finally {
      server.close();
      await once(server, "close");
    }
  });

  it("applies the selected persisted response safeguards", async () => {
    const server = createServer((_request, response) => {
      response.setHeader("content-type", "application/octet-stream");
      response.end("vault-secret");
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("listener unavailable");
    }
    const fixture = runtimeRequestFixture("allow", undefined, {
      vault: new SuccessfulRuntimeVault("vault-secret"),
      destination: {
        baseUrl: `http://127.0.0.1:${address.port}/`,
        schemes: ["http"],
        hosts: [{ type: "exact", value: "127.0.0.1" }],
        ports: [address.port],
        tlsVerify: false,
      },
    });
    fixture.snapshot.policies[0]!.mode = "deny";
    fixture.snapshot.policies[0]!.rules = [{
      id: "018f1f2e-7b3c-7a10-8000-000000000019",
      effect: "allow",
      priority: 100,
      enabled: true,
      methods: ["GET"],
      hosts: [],
      paths: [],
      responseSafeguards: {
        secretlint: { enabled: true, disabledRuleIds: [] },
        binaryResponse: { scan: false, maxBytes: null },
      },
      selector: { kind: "all", groupIds: [], userIds: [] },
    }];
    try {
      await expect(executeServiceRequest(
        fixture.config,
        fixture.auth,
        request(fixture.reference),
        fixture.dependencies,
      )).resolves.toMatchObject({
        status_code: 200,
        body_encoding: "mcp_blob",
      });
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});

function runtimeRequestFixture(
  policyMode: "allow" | "deny",
  capacity: {
    maxServiceRequestsInflight: number;
    maxServiceRequestsInflightPerSubject: number;
    maxServiceRequestsInflightPerService: number;
  } | undefined = {
    maxServiceRequestsInflight: 4,
    maxServiceRequestsInflightPerSubject: 2,
    maxServiceRequestsInflightPerService: 2,
  },
  options: {
    vault?: FailingRuntimeVault | SuccessfulRuntimeVault;
    destination?: Partial<RuntimeServiceSnapshot["destinations"][number]>;
    multiCredential?: boolean;
    selfKey?: { approved: boolean };
  } = {},
) {
  capacity ??= {
    maxServiceRequestsInflight: 4,
    maxServiceRequestsInflightPerSubject: 2,
    maxServiceRequestsInflightPerService: 2,
  };
  const config = runtimeConfig(capacity);
  const auth: AuthContext = {
    subject: SUBJECT,
    scopes: ["gateway.request"],
    mode: "oauth",
  };
  const snapshot = runtimeSnapshot(
    policyMode,
    options.destination,
    options.multiCredential,
  );
  const view: PersistedRuntimeServiceView = {
    snapshot,
    subject: { id: SUBJECT, securityEpoch: 4, groupIds: [] },
  };
  const grant: RuntimeReferenceGrant = {
    service: "runtime-api",
    serviceId: SERVICE_ID,
    destination: "primary",
    destinationId: DESTINATION_ID,
    snapshotId: SNAPSHOT_ID,
    publicationGeneration: 1,
    serviceAuthorizationGeneration: 2,
    subjectSecurityEpoch: 4,
    globalReferenceEpoch: 1,
    accesses: snapshot.credentials.map((credential) => ({
      id: credential.id,
      kind: "credential" as const,
      credentialId: credential.id,
      credentialAuthorizationGeneration: credential.authorizationGeneration,
      usageHint: `Set header ${credential.usage.name} to the reference`,
    })),
  };
  const authority: RuntimeAuthority = {
    readiness: async () => ({ activation: "ready", serviceCount: 1 }),
    listServices: async () => [],
    describeServicePolicy: async () => {
      throw new Error("unused");
    },
    serviceView: async () => view,
    authorizeReferences: async () => grant,
    validateReferences: async () => view,
    validateSelfApiKeyApproval: async (input) => {
      approvalChecks += 1;
      return options.selfKey?.approved === true &&
          input.serviceId === SERVICE_ID &&
          input.credentialId === CREDENTIAL_ID &&
          input.vaultGeneration === 5 &&
          input.apiKeyId === ACTIVE_SELF_KEY_ID
        ? {
            apiKeyId: ACTIVE_SELF_KEY_ID,
            nickname: "Approved self key",
            lastFour: ACTIVE_SELF_KEY.slice(-4),
          }
        : undefined;
    },
  };
  let approvalChecks = 0;
  const vault = options.vault ?? new FailingRuntimeVault();
  const dependencies = createRequestDependencies(config);
  dependencies.runtimeAuthority = authority;
  dependencies.runtimeVault = vault;
  if (options.selfKey !== undefined) {
    const candidate: ApiKeyAuthenticationCandidate = {
      id: ACTIVE_SELF_KEY_ID,
      identifier: ACTIVE_SELF_KEY.split("_")[2]!,
      verifierHash: SUPPORTED_HASH,
    };
    dependencies.selfApiKeyDetector = ActiveSelfApiKeyDetector.create(
      {
        authenticationCandidate: async (identifier) =>
          identifier === candidate.identifier ? candidate : undefined,
        activeVerifiedCandidate: async ({ candidate: current, verified }) =>
          verified
            ? {
                id: current.id,
                identifier: current.identifier,
                nickname: "Active self key",
                lastFour: ACTIVE_SELF_KEY.slice(-4),
                apiRole: "system",
              }
            : undefined,
      },
      new ApiKeyVerifierPool(1, async (_encoded, raw) =>
        raw.toString("utf8") === ACTIVE_SELF_KEY),
    );
  }
  resources.push(dependencies);
  const issued = dependencies.capabilities.tokenBroker.issueRuntimeTokens(
    auth,
    {
      service: "runtime-api",
      destination: "primary",
      access_ids: snapshot.credentials.map(({ id }) => id),
      reason: "Prepare persisted request.",
    },
    grant,
  );
  return {
    config,
    auth,
    dependencies,
    vault,
    snapshot,
    reference: issued.tokens[0]!.token,
    references: issued.tokens.map(({ token }) => token),
    get approvalChecks() {
      return approvalChecks;
    },
  };
}

class FailingRuntimeVault implements RuntimeVault {
  resolveCalls = 0;

  readiness(): Promise<"ready"> {
    return Promise.resolve("ready");
  }

  resolve<T>(): Promise<T> {
    this.resolveCalls += 1;
    return Promise.reject(new Error("unavailable"));
  }

  close(): void {}
}

class SuccessfulRuntimeVault implements RuntimeVault {
  resolveCalls = 0;
  lastBuffer: Buffer | undefined;
  readonly buffers: Buffer[] = [];

  readonly #secrets: ReadonlyMap<string, string>;

  constructor(secret: string | ReadonlyMap<string, string>) {
    this.#secrets = typeof secret === "string"
      ? new Map([[CREDENTIAL_ID, secret]])
      : secret;
  }

  readiness(): Promise<"ready"> {
    return Promise.resolve("ready");
  }

  async resolve<T>(
    input: RuntimeVaultResolveInput,
    callback: (secret: Buffer) => T | Promise<T>,
  ): Promise<T> {
    this.resolveCalls += 1;
    const value = this.#secrets.get(input.credentialId);
    if (value === undefined) throw new Error("missing test secret");
    const secret = Buffer.from(value, "utf8");
    this.lastBuffer = secret;
    this.buffers.push(secret);
    try {
      return await callback(secret);
    } finally {
      secret.fill(0);
    }
  }

  close(): void {}
}

function runtimeSnapshot(
  mode: "allow" | "deny",
  destinationOverride: Partial<
    RuntimeServiceSnapshot["destinations"][number]
  > = {},
  multiCredential = false,
): RuntimeServiceSnapshot {
  return {
    formatVersion: 1,
    id: SNAPSHOT_ID,
    service: {
      id: SERVICE_ID,
      slug: "runtime-api",
      name: "Runtime API",
      revisionId: "018f1f2e-7b3c-7a10-8000-000000000015",
      publicationGeneration: 1,
    },
    destinations: [{
      id: DESTINATION_ID,
      slug: "primary",
      baseUrl: "https://api.example.org/",
      schemes: ["https"],
      hosts: [{ type: "exact", value: "api.example.org" }],
      ports: [443],
      tlsVerify: true,
      ...destinationOverride,
    }],
    serviceSelector: { kind: "all", groupIds: [], userIds: [] },
    serviceAuthorizationGeneration: 2,
    credentials: [{
      id: CREDENTIAL_ID,
      name: "API key",
      usage: {
        kind: "header",
        name: "X-API-Key",
        enforceHeaderOwnership: true,
      },
      status: "configured",
      vaultState: "ready",
      locator: LOCATOR,
      generation: 5,
      authorizationGeneration: 3,
      selector: { kind: "all", groupIds: [], userIds: [] },
    }, ...(multiCredential ? [{
      id: SECOND_CREDENTIAL_ID,
      name: "Second key",
      usage: {
        kind: "header" as const,
        name: "X-Second-Key",
        enforceHeaderOwnership: true,
      },
      status: "configured" as const,
      vaultState: "ready",
      locator: "22345678-1234-4234-8234-123456789abc",
      generation: 2,
      authorizationGeneration: 3,
      selector: { kind: "all" as const, groupIds: [], userIds: [] },
    }] : [])],
    policies: [
      {
        id: POLICY_ID,
        mode,
        evaluationGeneration: 1,
        rules: [],
      },
      ...(multiCredential ? [{
        id: "018f1f2e-7b3c-7a10-8000-000000000018",
        credentialId: SECOND_CREDENTIAL_ID,
        mode,
        evaluationGeneration: 1,
        rules: [],
      }] : []),
      {
        id: "018f1f2e-7b3c-7a10-8000-000000000016",
        credentialId: CREDENTIAL_ID,
        mode,
        evaluationGeneration: 1,
        rules: [],
      },
    ],
  };
}

function request(reference: string) {
  return {
    service: "runtime-api",
    destination: "primary",
    method: "GET",
    path: "/api/echo",
    headers: { "X-API-Key": reference },
    reason: "Verify privileged ordering.",
  };
}

function runtimeConfig(capacity: {
  maxServiceRequestsInflight: number;
  maxServiceRequestsInflightPerSubject: number;
  maxServiceRequestsInflightPerService: number;
}): GatewayConfig {
  const legacy = validateConfig({
    server: { listen: "127.0.0.1:8080", mcp_path: "/mcp" },
    auth: { mode: "bearer", bearer: { token_env: "TEST_GATEWAY_TOKEN" } },
    limits: {
      max_service_requests_inflight: capacity.maxServiceRequestsInflight,
      max_service_requests_inflight_per_subject:
        capacity.maxServiceRequestsInflightPerSubject,
      max_service_requests_inflight_per_service:
        capacity.maxServiceRequestsInflightPerService,
    },
    services: {
      placeholder: {
        type: "http",
        name: "Placeholder",
        destinations: [{
          name: "primary",
          base_url: "https://api.example.org/",
          schemes: ["https"],
          hosts: [{ exact: "api.example.org" }],
        }],
        no_auth: true,
        access: { users: ["unused@example.org"] },
        policy: { mode: "allow", rules: [] },
      },
    },
  }, { TEST_GATEWAY_TOKEN: "test-token" });
  return {
    ...legacy,
    runtime: { authority: "database" },
    services: {},
  };
}
import { createServer } from "node:http";
import { once } from "node:events";
