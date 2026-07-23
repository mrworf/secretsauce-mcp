import { describe, expect, it } from "vitest";
import { validateConfig } from "../src/config.js";
import { GatewayError } from "../src/errors.js";
import {
  evaluatePolicy,
  evaluatePolicySnapshot,
  type PolicyBoundarySnapshot,
} from "../src/policy.js";
import {
  normalizeManagedPolicyMatchers,
  PolicyMatcherError,
} from "../src/policyMatchers.js";
import { getService, resolveDestination } from "../src/registry.js";
import type { AuthContext, GatewayConfig } from "../src/types.js";

describe("policy engine", () => {
  it("allows a GET request that matches an allow rule", () => {
    const context = policyContext(policyConfig("deny"));

    const decision = evaluatePolicy(context.service, context.target("/api/stacks"), "GET");

    expect(decision).toMatchObject({
      allowed: true,
      matchedRule: "allow-stack-read",
      policyMode: "deny",
    });
  });

  it("allows unmatched requests when mode is allow", () => {
    const context = policyContext(policyConfig("allow"));

    const decision = evaluatePolicy(context.service, context.target("/api/other"), "GET");

    expect(decision).toMatchObject({
      allowed: true,
      policyMode: "allow",
      reason: "Allowed by default policy mode.",
    });
  });

  it("matches host-specific rules against normalized hosts", () => {
    const context = policyContext(policyConfig("deny"));

    const decision = evaluatePolicy(context.service, context.targetUrl("https://PORTAINER.INTERNAL.:9443/api/hosted"), "GET");

    expect(decision).toMatchObject({
      allowed: true,
      matchedRule: "allow-host-read",
    });
  });

  it("denies DELETE requests with the matching deny rule", () => {
    const context = policyContext(policyConfig("deny"));

    const decision = evaluatePolicy(context.service, context.target("/api/stacks"), "DELETE");

    expect(decision).toMatchObject({
      allowed: false,
      matchedRule: "deny-delete",
      policyMode: "deny",
    });
    expect(decision.suggestion).not.toContain("bypass");
  });

  it("denies unmatched requests when mode is deny", () => {
    const context = policyContext(policyConfig("deny"));

    const decision = evaluatePolicy(context.service, context.target("/api/other"), "GET");

    expect(decision).toMatchObject({
      allowed: false,
      policyMode: "deny",
      reason: "Denied by default policy mode.",
    });
  });

  it("chooses deny when matching priorities tie", () => {
    const context = policyContext(policyConfig("allow"));

    const decision = evaluatePolicy(context.service, context.target("/api/tie"), "POST");

    expect(decision).toMatchObject({
      allowed: false,
      matchedRule: "deny-tie",
    });
  });

  it("rejects invalid policy regexes during config validation", () => {
    const raw = rawPolicyConfig("deny");
    raw.services["portainer-prod"].policy.rules[0].paths = ["["];

    expect(() => validateConfig(raw, policyEnv())).toThrow(GatewayError);
  });

  it("requires the service and every credential boundary to allow", () => {
    const service = boundary("service", "service", "allow", [
      rule("service-allow", "allow", 100, { kind: "all" }),
    ]);
    const firstCredential = boundary("credential-one", "credential", "deny", [
      rule("group-allow", "allow", 50, {
        kind: "groups",
        groupIds: ["group-one"],
      }),
    ]);
    const secondCredential = boundary("credential-two", "credential", "allow", [
      rule("direct-deny", "deny", 50, {
        kind: "users",
        userIds: ["user-one"],
      }),
    ]);

    const explanation = evaluatePolicySnapshot({
      subjectId: "user-one",
      groupIds: ["group-two", "group-one", "group-one"],
      method: "get",
      host: "API.EXAMPLE.ORG.",
      pathname: "/v1/items",
      service,
      credentials: [firstCredential, secondCredential],
    });

    expect(explanation).toMatchObject({
      allowed: false,
      groupIds: ["group-one", "group-two"],
      canonicalTarget: {
        method: "GET",
        host: "api.example.org",
        pathname: "/v1/items",
      },
      reasonCode: "boundary_denied",
    });
    expect(explanation.boundaries.map(({ allowed }) => allowed)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it("explains disabled, inapplicable, lower-priority, and deny-tie rules", () => {
    const policy = boundary("service", "service", "allow", [
      { ...rule("disabled", "deny", 1000, { kind: "all" }), enabled: false },
      rule("other-user", "deny", 900, {
        kind: "users",
        userIds: ["user-two"],
      }),
      rule("lower", "allow", 10, { kind: "all" }),
      rule("selected-allow", "allow", 20, { kind: "all" }),
      rule("selected-deny", "deny", 20, { kind: "all" }),
    ]);
    const explanation = evaluatePolicySnapshot({
      subjectId: "user-one",
      groupIds: [],
      method: "GET",
      host: "api.example.org",
      pathname: "/v1/items",
      service: policy,
      credentials: [],
    }).boundaries[0]!;

    expect(explanation).toMatchObject({
      allowed: false,
      selectedPriority: 20,
      selectedRuleIds: ["selected-allow", "selected-deny"],
      decisiveRuleId: "selected-deny",
      reasonCode: "deny_tie",
    });
    expect(Object.fromEntries(explanation.rules.map((entry) => [
      entry.ruleId,
      entry.reasonCode,
    ]))).toEqual({
      disabled: "disabled",
      "other-user": "principal_not_applicable",
      lower: "matched_lower_priority",
      "selected-allow": "selected_allow",
      "selected-deny": "selected_deny",
    });
  });

  it("normalizes managed matchers and rejects routing ambiguity or nonlinear regex", () => {
    expect(normalizeManagedPolicyMatchers({
      methods: ["post", "GET"],
      hosts: [
        { kind: "suffix", value: ".Example.ORG." },
        { kind: "regex", value: "^api[0-9]+\\.example\\.org$" },
      ],
      paths: [
        { kind: "prefix", value: "/v1/items" },
        { kind: "regex", value: "^/v1/items/[A-Za-z0-9-]+$" },
      ],
    })).toEqual({
      methods: ["GET", "POST"],
      hosts: [
        { kind: "regex", value: "^api[0-9]+\\.example\\.org$" },
        { kind: "suffix", value: "example.org" },
      ],
      paths: [
        { kind: "prefix", value: "/v1/items" },
        { kind: "regex", value: "^/v1/items/[A-Za-z0-9-]+$" },
      ],
    });

    for (const paths of [
      [{ kind: "exact", value: "/v1/%2Fadmin" }],
      [{ kind: "exact", value: "/v1/%61dmin" }],
      [{ kind: "regex", value: "^/(a+)+$" }],
    ]) {
      expect(() => normalizeManagedPolicyMatchers({
        methods: [],
        hosts: [],
        paths: paths as never,
      })).toThrow(PolicyMatcherError);
    }
  });
});

function boundary(
  id: string,
  kind: "service" | "credential",
  mode: "allow" | "deny",
  rules: PolicyBoundarySnapshot["rules"],
): PolicyBoundarySnapshot {
  return { id, kind, mode, assignmentAllowed: true, rules };
}

function rule(
  id: string,
  effect: "allow" | "deny",
  priority: number,
  selector: PolicyBoundarySnapshot["rules"][number]["selector"],
): PolicyBoundarySnapshot["rules"][number] {
  return {
    id,
    effect,
    priority,
    enabled: true,
    methods: ["GET"],
    hosts: [{ kind: "suffix", value: "example.org" }],
    paths: [{ kind: "prefix", value: "/v1" }],
    selector,
  };
}

function policyContext(config: GatewayConfig) {
  const actor = auth();
  const service = getService(config, "portainer-prod", actor);
  return {
    service,
    target: (path: string) => resolveDestination(config, actor, "portainer-prod", "primary", { path }),
    targetUrl: (url: string) => resolveDestination(config, actor, "portainer-prod", "primary", { url }),
  };
}

function policyConfig(mode: "allow" | "deny"): GatewayConfig {
  return validateConfig(rawPolicyConfig(mode), policyEnv());
}

function rawPolicyConfig(mode: "allow" | "deny"): any {
  return {
    server: { listen: "127.0.0.1:8080", mcp_path: "/mcp" },
    auth: { mode: "bearer", bearer: { token_env: "TEST_GATEWAY_TOKEN" } },
    services: {
      "portainer-prod": {
        type: "http",
        name: "Portainer Production",
        destinations: [{
          name: "primary",
          base_url: "https://portainer.internal:9443",
          hosts: [{ exact: "portainer.internal" }],
          ports: [9443],
        }],
        credentials: [{
          id: "api_key",
          usage: { kind: "header", name: "X-API-Key" },
          source: { kind: "env", name: "PORTAINER_API_KEY" },
        }],
        access: { users: ["henric@example.com"] },
        policy: {
          mode,
          rules: [
            {
              id: "allow-stack-read",
              effect: "allow",
              priority: 100,
              methods: ["GET"],
              paths: ["/api/stacks.*"],
            },
            {
              id: "allow-host-read",
              effect: "allow",
              priority: 200,
              methods: ["GET"],
              hosts: ["^portainer\\.internal$"],
              paths: ["/api/hosted"],
            },
            {
              id: "allow-tie",
              effect: "allow",
              priority: 500,
              methods: ["POST"],
              paths: ["/api/tie"],
            },
            {
              id: "deny-tie",
              effect: "deny",
              priority: 500,
              methods: ["POST"],
              paths: ["/api/tie"],
            },
            {
              id: "deny-delete",
              effect: "deny",
              priority: 1000,
              methods: ["DELETE"],
              paths: ["/.*"],
              reason: "DELETE blocked in MVP",
            },
          ],
        },
      },
    },
  };
}

function policyEnv() {
  return {
    TEST_GATEWAY_TOKEN: "dev-token",
    PORTAINER_API_KEY: "portainer-secret",
  };
}

function auth(): AuthContext {
  return { subject: "henric@example.com", scopes: ["gateway.request"], mode: "bearer" };
}
