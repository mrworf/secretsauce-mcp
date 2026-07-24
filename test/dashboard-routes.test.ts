import { describe, expect, it } from "vitest";
import { registerDashboardRoutes } from "../src/control/dashboardRoutes.js";
import { generateControlOpenApi } from "../src/control/openapi.js";
import { ControlRouteRegistry } from "../src/control/routeRegistry.js";

describe("dashboard HTTP contracts", () => {
  it("publishes strict browser-only scoped reads and operation-bound mutations", () => {
    const registry = new ControlRouteRegistry();
    registerDashboardRoutes(registry, {
      activity: {} as never,
      status: {} as never,
      security: {} as never,
      aggregation: {} as never,
    });
    const routes = registry.definitions();
    expect(routes).toHaveLength(6);
    const activity = route(routes, "dashboard.activity.get");
    const status = route(routes, "dashboard.status.get");
    const security = route(routes, "dashboard.security.get");
    const update = route(routes, "dashboard.remediations.update");
    const rebuild = route(routes, "dashboard.activity.rebuild");

    expect(activity).toMatchObject({
      authentication: ["browser_session"],
      permission: "view_activity_dashboard",
      stepUp: "none",
      rateLimit: "search",
      cache: "no-store",
    });
    expect(status.permission).toBe("view_status_dashboard");
    expect(security.permission).toBe("view_security_dashboard");
    expect(update).toMatchObject({
      authentication: ["browser_session"],
      permission: "manage_dashboard_remediations",
      stepUp: "always",
      concurrency: "if-match",
      auditAction: "dashboard.remediation.update",
    });
    expect(rebuild).toMatchObject({
      permission: "rebuild_activity_dashboard",
      stepUp: "always",
      auditAction: "activity.projection.run",
    });

    expect(activity.schemas.query!.safeParse({
      window: "90d",
      service_id: "018f1f2e-7b3c-7a10-8000-000000000001",
      limit: "100",
    }).success).toBe(true);
    for (const query of [
      { window: "year" },
      { limit: "0" },
      { limit: "101" },
      { service_id: "not-a-uuid" },
      { unexpected: "field" },
    ]) {
      expect(activity.schemas.query!.safeParse(query).success).toBe(false);
    }
    expect(update.schemas.body!.safeParse({
      state: "acknowledged",
      justification: "Reviewed with the service owner.",
    }).success).toBe(true);
    expect(update.schemas.body!.safeParse({
      state: "resolved",
      justification: "Not an exposed transition.",
    }).success).toBe(false);
    expect(update.schemas.body!.safeParse({
      state: "dismissed",
      justification: "line\nbreak",
    }).success).toBe(false);
    expect(rebuild.schemas.body!.safeParse({
      acknowledgement: "REBUILD ACTIVITY AGGREGATES",
      justification: "Repair a delayed projection.",
    }).success).toBe(true);
    expect(rebuild.schemas.body!.safeParse({
      acknowledgement: "rebuild activity aggregates",
      justification: "Wrong acknowledgement.",
    }).success).toBe(false);
  });

  it("generates all dashboard operations without API-key authentication", () => {
    const registry = new ControlRouteRegistry();
    registerDashboardRoutes(registry, {
      activity: {} as never,
      status: {} as never,
      security: {} as never,
      aggregation: {} as never,
    });
    const document = generateControlOpenApi(
      registry,
      "https://control.example.org",
    );
    for (const path of [
      "/api/v2/dashboard/activity",
      "/api/v2/dashboard/status",
      "/api/v2/dashboard/security",
      "/api/v2/dashboard/remediations",
      "/api/v2/dashboard/remediations/{remediation_id}",
      "/api/v2/dashboard/activity/rebuild",
    ]) {
      expect(document.paths[path]).toBeDefined();
      for (const operation of Object.values(document.paths[path] ?? {})) {
        expect(operation).toMatchObject({
          "x-authentication-methods": ["browser_session"],
        });
      }
    }
  });
});

function route(
  routes: ReturnType<ControlRouteRegistry["definitions"]>,
  id: string,
) {
  const found = routes.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`Missing route ${id}`);
  return found;
}
