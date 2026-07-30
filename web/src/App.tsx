import { type ReactNode, useEffect, useRef } from "react";
import { NavLink, useLocation } from "./routing";
import brandLockup from "../../assets/brand/secretsauce-lockup.png";
import {
  navigationForRole,
  navigationItem,
  type HumanControlRole,
  type NavigationItem,
} from "./navigation";
import { useState } from "react";
import {
  browserControlApi,
  type BrowserAuthenticationApi,
  type ControlApi,
} from "./controlApi";

export interface AppShellProps {
  role?: HumanControlRole;
  authApi?: Pick<ControlApi, "session"> & Pick<BrowserAuthenticationApi, "logout">;
  navigate?: (url: string) => void;
  children?: ReactNode;
}

export function AppShell({
  role = "user",
  authApi = browserControlApi,
  navigate = (url) => window.location.assign(url),
  children,
}: AppShellProps) {
  const location = useLocation();
  const heading = useRef<HTMLHeadingElement>(null);
  const previousPath = useRef(location.pathname);
  const items = navigationForRole(role);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState("");
  const logoutButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (previousPath.current === location.pathname) return;
    previousPath.current = location.pathname;
    heading.current?.focus();
  }, [location.pathname]);

  async function logout() {
    setLoggingOut(true);
    setLogoutMessage("");
    try {
      const session = await authApi.session();
      await authApi.logout(session.csrf_token);
      navigate("/control/login");
    } catch {
      setLogoutMessage(
        "Logout could not be completed. This session is still active. Try again.",
      );
      queueMicrotask(() => logoutButton.current?.focus());
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="topbar">
        <NavLink className="brand" to="/" aria-label="SecretSauce control overview">
          <img src={brandLockup} alt="SecretSauce" />
        </NavLink>
        <div className="topbar-context">
          <span className="environment-label">Control plane</span>
          <details className="account-menu">
            <summary>Account</summary>
            <div>
              <NavLink to="/profile">Settings</NavLink>
              <button
                ref={logoutButton}
                type="button"
                disabled={loggingOut}
                onClick={() => void logout()}
              >
                {loggingOut ? "Logging out…" : "Log out"}
              </button>
            </div>
          </details>
        </div>
      </header>

      <aside className="desktop-rail" aria-label="Primary navigation">
        <Navigation items={items} idPrefix="desktop" />
      </aside>

      <details className="compact-navigation">
        <summary>Menu</summary>
        <Navigation items={items} idPrefix="compact" />
      </details>

      <main id="main-content" className="main-workspace" tabIndex={-1}>
        <div className="page-heading">
          <div>
            <p className="eyebrow">SecretSauce control</p>
            <h1 ref={heading} tabIndex={-1}>
              {navigationItem(location.pathname)?.label ?? "Page unavailable"}
            </h1>
          </div>
          <StatusPill />
        </div>
        {children}
      </main>

      <footer className="footer">
        <span>SecretSauce</span>
        <span>Give agents access, not secrets.</span>
      </footer>
      <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {navigationItem(location.pathname)?.label ?? "Page unavailable"} loaded.
      </div>
      {logoutMessage !== "" && (
        <div className="logout-error" role="alert">
          {logoutMessage}
        </div>
      )}
    </div>
  );
}

function Navigation({
  items,
  idPrefix,
}: {
  items: readonly NavigationItem[];
  idPrefix: string;
}) {
  const groups = ["Workspace", "Operations", "Account"] as const;
  return (
    <nav aria-label="Control plane">
      {groups.map((group) => {
        const grouped = items.filter((item) => item.group === group);
        if (grouped.length === 0) return null;
        const headingId = `${idPrefix}-nav-${group.toLowerCase()}`;
        return (
          <section className="nav-group" aria-labelledby={headingId} key={group}>
            <h2 id={headingId}>{group}</h2>
            <ul>
              {grouped.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.path === "/"}
                    title={item.description}
                    onClick={(event) => {
                      const details = event.currentTarget.closest("details");
                      if (details instanceof HTMLDetailsElement) details.open = false;
                    }}
                  >
                    <span aria-hidden="true" className="nav-marker" />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </nav>
  );
}

function StatusPill() {
  return (
    <div className="status-pill" aria-label="Foundation status: ready">
      <span aria-hidden="true">✓</span>
      Foundation ready
    </div>
  );
}

export function RouteErrorPage() {
  return (
    <section className="content-panel error-panel" role="alert">
      <h2>We could not open this page</h2>
      <p>Return to the overview and try again. No submitted values were retained.</p>
      <NavLink className="button-link" to="/">Return to overview</NavLink>
    </section>
  );
}
