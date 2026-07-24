import {
  createBrowserRouter,
  createMemoryRouter,
  type RouteObject,
} from "react-router-dom";
import type { ReactElement } from "react";
import { AppShell, RouteErrorPage } from "./App";
import { navigationForRole, type HumanControlRole } from "./navigation";
import { ProfilePage, UsersPage } from "./UserPages";
import { ServicesPage } from "./ServicePages";
import { GroupsPage } from "./GroupPages";
import { CredentialsPage } from "./CredentialPages";
import { PoliciesPage } from "./PolicyPages";
import { AccessPage } from "./AccessPages";
import { ApiKeysPage } from "./ApiKeyPages";
import { SecurityPage } from "./SecurityPage";
import { AuditPage } from "./AuditPages";
import {
  ActivityPage,
  OverviewPage,
  SecurityDashboardPanel,
  StatusPage,
} from "./DashboardPages";
import { BackupPage } from "./BackupPage";
import { OpenApiHelpPage, RecoveryPage } from "./RecoveryPages";

const ROUTE_COMPONENTS: Readonly<Record<string, (role: HumanControlRole) => ReactElement>> = {
  "/": (role) => <OverviewPage role={role} />,
  "/services": (role) => <ServicesPage role={role} />,
  "/credentials": (role) => <CredentialsPage role={role} />,
  "/policies": () => <PoliciesPage />,
  "/users": (role) => <UsersPage role={role} />,
  "/groups": () => <GroupsPage />,
  "/access": (role) => <AccessPage role={role} />,
  "/api-keys": (role) => <ApiKeysPage role={role} />,
  "/activity": () => <ActivityPage />,
  "/status": () => <StatusPage />,
  "/mcp-audit": (role) => <AuditPage domain="runtime" role={role} />,
  "/administrative-audit": (role) => <AuditPage domain="administrative" role={role} />,
  "/security": (role) => (
    <div className="dashboard-stack">
      <SecurityDashboardPanel role={role} />
      <SecurityPage role={role} />
    </div>
  ),
  "/backup": (role) => <BackupPage role={role} />,
  "/migration": () => <RecoveryPage />,
  "/profile": () => <ProfilePage />,
  "/openapi": () => <OpenApiHelpPage />,
};

export function implementedControlPaths(): readonly string[] {
  return Object.keys(ROUTE_COMPONENTS);
}

function routes(role: HumanControlRole): RouteObject[] {
  return [{
    path: "/",
    element: <AppShell role={role} />,
    errorElement: <RouteErrorPage />,
    children: [
      ...navigationForRole(role).map((item) => ({
        index: item.path === "/" ? true as const : undefined,
        path: item.path === "/" ? undefined : item.path.slice(1),
        element: ROUTE_COMPONENTS[item.path]?.(role) ?? <RouteErrorPage />,
      })),
      { path: "*", element: <RouteErrorPage /> },
    ],
  }];
}

export function createControlRouter(role: HumanControlRole = "user") {
  return createBrowserRouter(routes(role), { basename: "/control" });
}

export function createTestControlRouter(
  role: HumanControlRole,
  initialPath = "/",
) {
  return createMemoryRouter(routes(role), { initialEntries: [initialPath] });
}
