import {
  createBrowserRouter,
  createMemoryRouter,
  type RouteObject,
} from "react-router-dom";
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

function routes(role: HumanControlRole): RouteObject[] {
  return [{
    path: "/",
    element: <AppShell role={role} />,
    errorElement: <RouteErrorPage />,
    children: [
      ...navigationForRole(role).map((item) => ({
        index: item.path === "/" ? true as const : undefined,
        path: item.path === "/" ? undefined : item.path.slice(1),
        element: item.path === "/users"
          ? <UsersPage role={role} />
          : item.path === "/services"
            ? <ServicesPage role={role} />
          : item.path === "/groups"
            ? <GroupsPage />
          : item.path === "/credentials"
            ? <CredentialsPage role={role} />
          : item.path === "/policies"
            ? <PoliciesPage />
          : item.path === "/access"
            ? <AccessPage role={role} />
          : item.path === "/api-keys"
            ? <ApiKeysPage role={role} />
          : item.path === "/security"
            ? <div className="dashboard-stack">
                <SecurityDashboardPanel role={role} />
                <SecurityPage role={role} />
              </div>
          : item.path === "/activity"
            ? <ActivityPage />
          : item.path === "/status"
            ? <StatusPage />
          : item.path === "/"
            ? <OverviewPage role={role} />
          : item.path === "/mcp-audit"
            ? <AuditPage domain="runtime" role={role} />
          : item.path === "/administrative-audit"
            ? <AuditPage domain="administrative" role={role} />
          : item.path === "/backup"
            ? <BackupPage role={role} />
          : item.path === "/profile"
            ? <ProfilePage />
          : item.path === "/migration"
            ? <RecoveryPage />
          : item.path === "/openapi"
            ? <OpenApiHelpPage />
            : <RouteErrorPage />,
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
