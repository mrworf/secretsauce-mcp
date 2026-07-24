import { describe, expect, it } from "vitest";
import {
  ApiKeyVerifierPool,
  generateApiKey,
  type ApiKeyAuthenticationCandidate,
} from "../src/apiKeys.js";
import {
  ActiveSelfApiKeyDetector,
  SelfApiKeyProtectionError,
  SelfApiKeyVerificationLimiter,
  scanStructuralApiKeyCandidates,
  type SelfApiKeyCandidateRepository,
} from "../src/selfApiKeyProtection.js";

const KEY_ID = "018f1f2e-7b3c-7a10-8000-000000000001";
const SERVICE_ID = "018f1f2e-7b3c-7a10-8000-000000000002";
const SUPPORTED_HASH =
  "$argon2id$v=19$m=65536,p=1,t=3$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

describe("self API key structural scanner", () => {
  it("finds canonical candidates in supported string values without interpreting keys or binary data", () => {
    const first = generated(1);
    const second = generated(2);
    const candidates = scanStructuralApiKeyCandidates([
      {
        location: "header",
        value: {
          authorization: `Bearer ${first}`,
          [second]: "object keys are not inspected",
        },
      },
      {
        location: "query",
        value: { nested: ["safe", second, second] },
      },
      {
        location: "body",
        value: {
          raw: first,
          binary: Buffer.from(second, "utf8"),
          encoded: Buffer.from(second, "utf8").toString("base64"),
        },
      },
    ]);

    expect(candidates).toEqual([
      {
        value: first,
        identifier: first.split("_")[2],
        location: "header",
      },
      {
        value: second,
        identifier: second.split("_")[2],
        location: "query",
      },
      {
        value: first,
        identifier: first.split("_")[2],
        location: "body",
      },
    ]);
  });

  it("rejects candidate floods and ignores malformed, embedded, fragmented, and transformed values", () => {
    const key = generated(3);
    expect(scanStructuralApiKeyCandidates([
      { location: "header", value: `x${key}` },
      { location: "query", value: `${key}x` },
      { location: "body", value: [key.slice(0, 30), key.slice(30)] },
      {
        location: "body",
        value: Buffer.from(key, "utf8").toString("base64"),
      },
      { location: "credential", value: key.replace(/.$/, "+") },
    ])).toEqual([]);

    expect(() => scanStructuralApiKeyCandidates([{
      location: "body",
      value: Array.from({ length: 17 }, (_, index) => generated(index + 10)),
    }])).toThrowError(expect.objectContaining({
      code: "candidate_limit",
    }));
  });

  it("bounds recursive traversal and safely handles cycles", () => {
    const cyclic: { child?: unknown } = {};
    cyclic.child = cyclic;
    expect(scanStructuralApiKeyCandidates([
      { location: "body", value: cyclic },
    ])).toEqual([]);

    let nested: unknown = "leaf";
    for (let index = 0; index < 65; index += 1) nested = [nested];
    expect(() => scanStructuralApiKeyCandidates([
      { location: "body", value: nested },
    ])).toThrowError(expect.objectContaining({
      code: "candidate_limit",
    }));
  });
});

describe("active self API key detector", () => {
  it("returns safe metadata only after bounded verification and a live-state recheck", async () => {
    const active = generated(20);
    const unknown = generated(21);
    const identifier = active.split("_")[2]!;
    const candidate: ApiKeyAuthenticationCandidate = {
      id: KEY_ID,
      identifier,
      verifierHash: SUPPORTED_HASH,
    };
    const verifiedValues: string[] = [];
    let activeState = true;
    const repository: SelfApiKeyCandidateRepository = {
      authenticationCandidate: async (requested) =>
        requested === identifier ? candidate : undefined,
      activeVerifiedCandidate: async ({ candidate: current, verified }) =>
        activeState && verified
          ? {
              id: current.id,
              identifier: current.identifier,
              nickname: "Deploy key",
              lastFour: active.slice(-4),
              apiRole: "service",
              serviceId: SERVICE_ID,
            }
          : undefined,
    };
    const verifier = new ApiKeyVerifierPool(1, async (_encoded, raw) => {
      verifiedValues.push(raw.toString("utf8"));
      return raw.toString("utf8") === active;
    });
    const detector = await ActiveSelfApiKeyDetector.create(
      repository,
      verifier,
      new SelfApiKeyVerificationLimiter(10),
    );

    await expect(detector.inspect([
      { location: "credential", value: active },
      { location: "header", value: unknown },
    ], {
      principal: KEY_ID,
      source: "127.0.0.1",
    })).resolves.toEqual([{
      id: KEY_ID,
      identifier,
      nickname: "Deploy key",
      lastFour: active.slice(-4),
      apiRole: "service",
      serviceId: SERVICE_ID,
      location: "credential",
    }]);
    expect(verifiedValues).toEqual([active, unknown]);

    activeState = false;
    await expect(detector.inspect([
      { location: "credential", value: active },
    ], {
      principal: KEY_ID,
      source: "127.0.0.2",
    })).resolves.toEqual([]);
  });

  it("enforces both principal and source windows and bounded limiter state", () => {
    const clock = { value: 1_000 };
    const limiter = new SelfApiKeyVerificationLimiter(
      2,
      1_000,
      4,
      () => clock.value,
    );
    limiter.acquire("principal-a", "source-a");
    limiter.acquire("principal-a", "source-a");
    expect(() => limiter.acquire("principal-a", "source-b")).toThrowError(
      expect.objectContaining({ code: "rate_limited" }),
    );
    expect(() => limiter.acquire("principal-b", "source-a")).toThrowError(
      expect.objectContaining({ code: "rate_limited" }),
    );

    clock.value += 1_000;
    expect(() => limiter.acquire("principal-a", "source-a")).not.toThrow();
    expect(() => limiter.acquire("", "source-a")).toThrow(
      SelfApiKeyProtectionError,
    );
  });
});

function generated(byte: number): string {
  let call = 0;
  return generateApiKey((size) => {
    call += 1;
    return Buffer.alloc(size, byte + call);
  }).value;
}
