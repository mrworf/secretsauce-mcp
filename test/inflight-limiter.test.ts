import { describe, expect, it } from "vitest";
import { InflightLimiter } from "../src/inflightLimiter.js";
import { ServiceRequestLimiter } from "../src/serviceRequestLimiter.js";

describe("in-flight limiter", () => {
  it("admits work below both limits and releases slots idempotently", () => {
    const limiter = new InflightLimiter(2, 2);
    const first = limiter.acquire("source-a");
    const second = limiter.acquire("source-b");
    expect(first).toBeTypeOf("function");
    expect(second).toBeTypeOf("function");
    expect(limiter.acquire("source-c")).toBeUndefined();
    first?.();
    first?.();
    expect(limiter.acquire("source-c")).toBeTypeOf("function");
  });

  it("enforces source limits independently of the global limit", () => {
    const limiter = new InflightLimiter(3, 1);
    const release = limiter.acquire("source-a");
    expect(limiter.acquire("source-a")).toBeUndefined();
    expect(limiter.acquire("source-b")).toBeTypeOf("function");
    release?.();
    expect(limiter.acquire("source-a")).toBeTypeOf("function");
  });
});

describe("service request in-flight limiter", () => {
  it("isolates service capacity while retaining global and subject limits", () => {
    const limiter = new ServiceRequestLimiter(3, 2, 1);
    const first = limiter.acquire("actor-a", "service-a");
    expect(first).toBeTypeOf("function");
    expect(limiter.acquire("actor-b", "service-a")).toBeUndefined();
    expect(limiter.acquire("actor-a", "service-b")).toBeTypeOf("function");
  });

  it("releases service capacity idempotently", () => {
    const limiter = new ServiceRequestLimiter(2, 2, 1);
    const release = limiter.acquire("actor", "service-a");
    release?.();
    release?.();
    expect(limiter.acquire("other", "service-a")).toBeTypeOf("function");
  });
});
