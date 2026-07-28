import { describe, expect, it } from "vitest";
import { GlobalLoginLimiter } from "../src/builtinOAuth.js";

describe("shared authentication admission", () => {
  it("enforces one fixed global window without extending a blocked window", () => {
    let now = 1_000;
    const limiter = new GlobalLoginLimiter(2, 60_000, () => now);
    expect(limiter.take()).toEqual({ allowed: true });
    expect(limiter.take()).toEqual({ allowed: true });
    expect(limiter.take()).toEqual({ allowed: false, retryAfterMs: 60_000 });
    now += 30_000;
    expect(limiter.take()).toEqual({ allowed: false, retryAfterMs: 30_000 });
    now += 30_000;
    expect(limiter.take()).toEqual({ allowed: true });
  });
});
