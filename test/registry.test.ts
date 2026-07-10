import { describe, expect, it } from "vitest";
import { validateConfig } from "../src/config.js";
import { GatewayError } from "../src/errors.js";
import { getCredential, getService, listVisibleServices } from "../src/registry.js";
import type { AuthContext, GatewayConfig } from "../src/types.js";

describe("service registry", () => {
  it("lists only services allowed for the authenticated subject without raw credentials", () => {
    const config = registryConfig();
    const services = listVisibleServices(config, auth("henric@example.com"));

    expect(services.map((service) => service.id)).toEqual(["portainer-prod"]);
    expect(services[0]?.destinations[0]).toMatchObject({
      id: "primary",
      base_url_hint: "https://portainer.internal:9443",
      tls_verify: false,
    });
    expect(services[0]?.credentials).toEqual([{ id: "api_key", usage_hint: "Use token as X-API-Key header" }]);
    expect(JSON.stringify(services)).not.toContain("portainer-secret");
  });

  it("denies unknown and unauthorized services", () => {
    const config = registryConfig();

    expectGatewayError(() => getService(config, "missing", auth("henric@example.com")), "unknown_service");
    expectGatewayError(() => getService(config, "portainer-prod", auth("ada@example.com")), "unauthorized_service");
  });

  it("returns credentials by id without leaking them in summaries", () => {
    const config = registryConfig();
    const service = getService(config, "portainer-prod", auth("henric@example.com"));

    expect(getCredential(service, "api_key").secret).toBe("portainer-secret");
    expectGatewayError(() => getCredential(service, "missing"), "unknown_credential");
  });
});

export function registryConfig(): GatewayConfig {
  return validateConfig({
    server: { listen: "127.0.0.1:8080", mcp_path: "/mcp" },
    auth: { mode: "bearer", bearer: { token_env: "TEST_GATEWAY_TOKEN" } },
    services: {
      "portainer-prod": {
        type: "http",
        name: "Portainer Production",
        description: "Main Portainer instance",
        destinations: [{
          name: "primary",
          base_url: "https://portainer.internal:9443",
          schemes: ["https"],
          hosts: [
            { exact: "portainer.internal" },
            { suffix: ".home.arpa" },
            { regex: "^portainer-[a-z0-9-]+\\.internal$" },
          ],
          ports: [9443],
        }],
        tls: { verify: false },
        credentials: [{
          id: "api_key",
          usage: { kind: "header", name: "X-API-Key" },
          source: { kind: "env", name: "PORTAINER_API_KEY" },
        }],
        access: { users: ["henric@example.com"] },
        policy: { mode: "deny", rules: [] },
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
        access: { users: ["ada@example.com"] },
      },
    },
  }, {
    TEST_GATEWAY_TOKEN: "dev-token",
    PORTAINER_API_KEY: "portainer-secret",
    OPNSENSE_API_KEY: "opnsense-secret",
  });
}

export function auth(subject: string): AuthContext {
  return { subject, scopes: ["gateway.read"], mode: "bearer" };
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
