import { describe, expect, it, vi } from "vitest";
import { z } from "../src/control/zod.js";
import {
  CONTROL_CAPABILITIES,
  CONTROL_ROLES,
  permissionNeedsHumanStepUp,
  permissionNeedsScope,
  permissionOutcome,
} from "../src/control/permissions.js";
import {
  ControlRouteRegistry,
  controlCapabilityAllowsApiKey,
  defineControlRoute,
} from "../src/control/routeRegistry.js";
import { createDefaultControlRouteRegistry } from "../src/control/defaultRoutes.js";
import { registerAccessManagementRoutes } from "../src/control/accessRoutes.js";
import { registerApiKeyRoutes } from "../src/control/apiKeyRoutes.js";
import { registerAuditRoutes } from "../src/control/auditRoutes.js";
import { registerCredentialRoutes } from "../src/control/credentialRoutes.js";
import { registerDashboardRoutes } from "../src/control/dashboardRoutes.js";
import { registerGroupAssignmentRoutes } from "../src/control/groupRoutes.js";
import { registerPolicyRoutes } from "../src/control/policyRoutes.js";
import { registerRecoveryRoutes } from "../src/control/recoveryRoutes.js";
import { registerSecurityRoutes } from "../src/control/securityRoutes.js";
import { registerServiceManagementRoutes } from "../src/control/serviceRoutes.js";
import { registerUserAdministrationRoutes } from "../src/control/userRoutes.js";

const API_ROLES = ["service", "all_services", "system"] as const;

describe("release authorization invariants", () => {
  it("derives every route's API-key eligibility from every API-role matrix cell", () => {
    const registry = new ControlRouteRegistry();
    for (const [index, capability] of CONTROL_CAPABILITIES.entries()) {
      registry.register(defineControlRoute({
        id: `release.audit_${index}`,
        method: "GET",
        path: `/api/v2/release-audit/${index}`,
        summary: `Audit ${capability}`,
        tags: ["Release audit"],
        authentication: ["browser_session"],
        permission: capability,
        stepUp: "none",
        schemas: { response: z.object({ ok: z.literal(true) }).strict() },
        rateLimit: "management",
        secretFields: [],
        cache: "no-store",
        concurrency: "none",
        idempotency: "none",
        handler: vi.fn(() => ({ data: { ok: true as const } })),
      }));
    }
    for (const [index, route] of registry.definitions().entries()) {
      const capability = CONTROL_CAPABILITIES[index]!;
      const expected = API_ROLES.some((role) => {
        const outcome = permissionOutcome(role, capability);
        return outcome !== "deny" && outcome !== "no_account";
      });
      expect(controlCapabilityAllowsApiKey(capability), capability).toBe(expected);
      expect(route.authentication, capability).toEqual(
        expected ? ["browser_session", "api_key"] : ["browser_session"],
      );
    }
  });

  it("keeps explicit browser-only routes closed even for an API-eligible capability", () => {
    const registry = new ControlRouteRegistry();
    registry.register(defineControlRoute({
      id: "release.browser_only",
      method: "GET",
      path: "/api/v2/release-audit/browser-only",
      summary: "Browser-only audit route",
      tags: ["Release audit"],
      authentication: ["browser_session"],
      expandApiKeyAuthentication: false,
      permission: "manage_global_settings",
      stepUp: "none",
      schemas: { response: z.object({ ok: z.literal(true) }).strict() },
      rateLimit: "management",
      secretFields: [],
      cache: "no-store",
      concurrency: "none",
      idempotency: "none",
      handler: vi.fn(() => ({ data: { ok: true as const } })),
    }));
    expect(controlCapabilityAllowsApiKey("manage_global_settings")).toBe(true);
    expect(registry.definitions()[0]?.authentication).toEqual(["browser_session"]);
  });

  it("audits all 246 role cells for scope, step-up, and hard-denial consistency", () => {
    let cells = 0;
    for (const capability of CONTROL_CAPABILITIES) {
      for (const role of CONTROL_ROLES) {
        cells += 1;
        const outcome = permissionOutcome(role, capability);
        expect(permissionNeedsHumanStepUp(outcome), `${role}:${capability}`)
          .toBe(outcome === "step_up" || outcome.endsWith("_step_up"));
        if (outcome === "deny" || outcome === "no_account") {
          expect(permissionNeedsScope(outcome), `${role}:${capability}`).toBe(false);
        }
        if (role === "service" && outcome === "scoped_service") {
          expect([
            "view_service_configuration",
            "configure_service",
            "manage_credentials_policies",
            "manage_service_groups",
            "manage_service_membership",
            "invite_ordinary_user",
          ]).toContain(capability);
        }
      }
    }
    expect(cells).toBe(CONTROL_CAPABILITIES.length * CONTROL_ROLES.length);
    expect(permissionOutcome("superadmin", "affect_superadmin"))
      .toBe("last_superadmin_rules");
    expect(permissionOutcome("service", "affect_superadmin")).toBe("deny");
    expect(permissionOutcome("all_services", "permanently_delete_service")).toBe("deny");
    expect(permissionOutcome("system", "restore")).toBe("deny");
  });

  it("keeps every registered service-child route under its parent service", () => {
    const registry = createDefaultControlRouteRegistry(
      undefined,
      "https://control.example.org",
    );
    registerUserAdministrationRoutes(registry, dependency(), dependency());
    registerServiceManagementRoutes(registry, dependency());
    registerGroupAssignmentRoutes(registry, dependency());
    registerCredentialRoutes(registry, dependency(), dependency());
    registerPolicyRoutes(registry, dependency());
    registerAccessManagementRoutes(registry, dependency());
    registerApiKeyRoutes(registry, dependency());
    registerSecurityRoutes(registry, dependency());
    registerAuditRoutes(registry, dependency(), dependency());
    registerDashboardRoutes(registry, {
      aggregation: dependency(),
      activity: dependency(),
      status: dependency(),
      security: dependency(),
    });
    registerRecoveryRoutes(registry, dependency());

    const routes = registry.definitions();
    expect(routes.length).toBeGreaterThan(80);
    const childParameters = [
      "{destination_id}",
      "{revision_id}",
      "{group_id}",
      "{credential_id}",
      "{policy_id}",
      "{rule_id}",
    ];
    for (const route of routes) {
      if (childParameters.some((parameter) => route.path.includes(parameter))) {
        expect(route.path, route.id).toContain("/services/{service_id}/");
      }
      if (
        route.authentication !== "public"
        && route.permission !== null
        && route.permission !== "authenticated"
      ) {
        if (route.authentication.includes("browser_session")) {
          const expectedApiKey = route.expandApiKeyAuthentication !== false
            && controlCapabilityAllowsApiKey(route.permission);
          expect(route.authentication.includes("api_key"), route.id).toBe(expectedApiKey);
        } else if (route.authentication.includes("api_key")) {
          expect(controlCapabilityAllowsApiKey(route.permission), route.id).toBe(true);
        }
      }
    }
  });
});

function dependency<T>(): T {
  return new Proxy({}, {
    get: () => vi.fn(),
  }) as T;
}
