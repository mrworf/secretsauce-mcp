import type { ReactElement } from "react";
import { AppShell, RouteErrorPage } from "./App";
import { navigationForRole, type HumanControlRole } from "./navigation";
import { BrowserRouter, MemoryRouter, useLocation } from "./routing";
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

function ControlRoute({ role }: { role: HumanControlRole }) {
  const { pathname } = useLocation();
  const allowed = navigationForRole(role).some((item) => item.path === pathname);
  const content = allowed ? ROUTE_COMPONENTS[pathname]?.(role) : undefined;
  return (
    <AppShell role={role}>
      {content ?? <RouteErrorPage />}
    </AppShell>
  );
}

export function createControlRouter(role: HumanControlRole = "user") {
  return (
    <BrowserRouter basename="/control">
      <ControlRoute role={role} />
    </BrowserRouter>
  );
}

export function createTestControlRouter(
  role: HumanControlRole,
  initialPath = "/",
) {
  return (
    <MemoryRouter initialPath={initialPath}>
      <ControlRoute role={role} />
    </MemoryRouter>
  );
}
