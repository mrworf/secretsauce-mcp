import { afterEach, describe, expect, it } from "vitest";
import { validateConfig } from "../src/config.js";
import { GatewayError } from "../src/errors.js";
import { executeServiceRequest } from "../src/gateway.js";
import { createRequestDependencies, type RequestDependencies } from "../src/requestDependencies.js";
import type {
  PersistedRuntimeServiceView,
  RuntimeAuthority,
  RuntimeReferenceGrant,
} from "../src/runtimeAuthority.js";
import type { RuntimeServiceSnapshot } from "../src/runtimeSnapshots.js";
import type { RuntimeVault } from "../src/runtimeVault.js";
import type { AuthContext, GatewayConfig } from "../src/types.js";

const SUBJECT = "018f1f2e-7b3c-7a10-8000-000000000001";
const SERVICE_ID = "018f1f2e-7b3c-7a10-8000-000000000010";
const DESTINATION_ID = "018f1f2e-7b3c-7a10-8000-000000000011";
const CREDENTIAL_ID = "018f1f2e-7b3c-7a10-8000-000000000012";
const SNAPSHOT_ID = "018f1f2e-7b3c-7a10-8000-000000000013";
const POLICY_ID = "018f1f2e-7b3c-7a10-8000-000000000014";
const LOCATOR = "12345678-1234-4234-8234-123456789abc";
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
  const snapshot = runtimeSnapshot(policyMode, options.destination);
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
    accesses: [{
      id: CREDENTIAL_ID,
      kind: "credential",
      credentialId: CREDENTIAL_ID,
      credentialAuthorizationGeneration: 3,
      usageHint: "Set header X-API-Key to the reference",
    }],
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
  };
  const vault = options.vault ?? new FailingRuntimeVault();
  const dependencies = createRequestDependencies(config);
  dependencies.runtimeAuthority = authority;
  dependencies.runtimeVault = vault;
  resources.push(dependencies);
  const issued = dependencies.capabilities.tokenBroker.issueRuntimeTokens(
    auth,
    {
      service: "runtime-api",
      destination: "primary",
      access_ids: [CREDENTIAL_ID],
      reason: "Prepare persisted request.",
    },
    grant,
  );
  return {
    config,
    auth,
    dependencies,
    vault,
    reference: issued.tokens[0]!.token,
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

  constructor(private readonly secret: string) {}

  readiness(): Promise<"ready"> {
    return Promise.resolve("ready");
  }

  async resolve<T>(
    _input: unknown,
    callback: (secret: Buffer) => T | Promise<T>,
  ): Promise<T> {
    this.resolveCalls += 1;
    const secret = Buffer.from(this.secret, "utf8");
    this.lastBuffer = secret;
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
    }],
    policies: [
      {
        id: POLICY_ID,
        mode,
        evaluationGeneration: 1,
        rules: [],
      },
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
