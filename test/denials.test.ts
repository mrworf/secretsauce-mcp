import { describe, expect, it } from "vitest";
import { DenialStore, explainDenial } from "../src/denials.js";
import { GatewayError } from "../src/errors.js";
import { executeServiceRequest } from "../src/gateway.js";
import { TokenBroker, defaultTokenBrokers } from "../src/tokens.js";
import { auth, registryConfig } from "./helpers.js";

describe("denial explanations", () => {
  it("returns safe denial context for the same subject", async () => {
    const config = registryConfig();
    defaultTokenBrokers.set(config, new TokenBroker(config));
    let requestId = "";

    try {
      await executeServiceRequest(config, auth("henric@example.com"), {
        service: "portainer-prod",
        destination: "primary",
        method: "GET",
        path: "/api/not-allowed",
        reason: "Trigger policy denial.",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(GatewayError);
      requestId = (error as GatewayError).requestId ?? "";
    }

    const explanation = explainDenial(config, auth("henric@example.com"), requestId);
    expect(explanation).toMatchObject({
      request_id: requestId,
      reason: "Denied by default policy mode.",
      policy_mode: "deny",
    });
    expect(explanation?.suggestion).not.toContain("bypass");
  });

  it("does not expose denial context to another subject or session", async () => {
    const config = registryConfig();
    defaultTokenBrokers.set(config, new TokenBroker(config));
    const sameSession = auth("henric@example.com", "session-a");
    let requestId = "";

    try {
      await executeServiceRequest(config, sameSession, {
        service: "portainer-prod",
        destination: "primary",
        method: "GET",
        path: "/api/not-allowed",
        reason: "Trigger policy denial.",
      });
    } catch (error) {
      requestId = (error as GatewayError).requestId ?? "";
    }

    expect(explainDenial(config, auth("ada@example.com", "session-a"), requestId)).toBeUndefined();
    expect(explainDenial(config, auth("henric@example.com", "session-b"), requestId)).toBeUndefined();
  });

  it("expires denial records and evicts the least recently used record", () => {
    let now = 0;
    const store = new DenialStore(2, 10, () => now);
    const first = store.record({ subject: "actor", reason: "first", policy_mode: "deny" });
    const second = store.record({ subject: "actor", reason: "second", policy_mode: "deny" });
    expect(store.get(first.request_id)?.reason).toBe("first");
    const third = store.record({ subject: "actor", reason: "third", policy_mode: "deny" });
    expect(store.get(second.request_id)).toBeUndefined();
    expect(store.get(third.request_id)?.reason).toBe("third");
    now = 11;
    store.sweep(now);
    expect(store.get(first.request_id)).toBeUndefined();
  });
});
