import {
  createBrowserRouter,
  createMemoryRouter,
  type RouteObject,
} from "react-router-dom";
import { AppShell, PlaceholderPage, RouteErrorPage } from "./App";
import { navigationForRole, type HumanControlRole } from "./navigation";
import { ProfilePage, UsersPage } from "./UserPages";
import { ServicesPage } from "./ServicePages";

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
          : item.path === "/profile"
            ? <ProfilePage />
            : <PlaceholderPage />,
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
