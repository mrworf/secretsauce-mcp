import { useEffect, useRef } from "react";
import {
  NavLink,
  Outlet,
  useLocation,
  useRouteError,
} from "react-router-dom";
import brandLockup from "../../assets/brand/secretsauce-lockup.png";
import {
  navigationForRole,
  navigationItem,
  type HumanControlRole,
  type NavigationItem,
} from "./navigation";

export interface AppShellProps {
  role?: HumanControlRole;
}

export function AppShell({ role = "user" }: AppShellProps) {
  const location = useLocation();
  const heading = useRef<HTMLHeadingElement>(null);
  const previousPath = useRef(location.pathname);
  const items = navigationForRole(role);

  useEffect(() => {
    if (previousPath.current === location.pathname) return;
    previousPath.current = location.pathname;
    heading.current?.focus();
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="topbar">
        <NavLink className="brand" to="/" aria-label="SecretSauce control overview">
          <img src={brandLockup} alt="SecretSauce" />
        </NavLink>
        <div className="topbar-context">
          <span className="environment-label">Control plane</span>
          <span className="role-label">Navigation preview: {role}</span>
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
        <Outlet />
      </main>

      <footer className="footer">
        <span>SecretSauce</span>
        <span>Give agents access, not secrets.</span>
      </footer>
      <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {navigationItem(location.pathname)?.label ?? "Page unavailable"} loaded.
      </div>
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

export function PlaceholderPage() {
  const location = useLocation();
  const item = navigationItem(location.pathname);
  return (
    <section className="content-panel" aria-labelledby="section-heading">
      <div className="content-copy">
        <h2 id="section-heading">{item?.description ?? "This route is unavailable"}</h2>
        <p>
          This foundation reserves a safe, role-filtered workspace. Domain data and
          administrative actions arrive in their dedicated milestones.
        </p>
      </div>
      <div className="foundation-grid" aria-label="Foundation capabilities">
        <article>
          <p className="card-kicker">Boundary</p>
          <h3>Separate control listener</h3>
          <p>Browser and management traffic stay distinct from stateless MCP traffic.</p>
        </article>
        <article>
          <p className="card-kicker">Access</p>
          <h3>Permission-aware navigation</h3>
          <p>Visibility follows the central role matrix; server authorization remains authoritative.</p>
        </article>
        <article>
          <p className="card-kicker">Safety</p>
          <h3>Protected by default</h3>
          <p>Strict origin, request, caching, and response controls form the browser baseline.</p>
        </article>
      </div>
    </section>
  );
}

export function RouteErrorPage() {
  useRouteError();
  return (
    <section className="content-panel error-panel" role="alert">
      <h2>We could not open this page</h2>
      <p>Return to the overview and try again. No submitted values were retained.</p>
      <NavLink className="button-link" to="/">Return to overview</NavLink>
    </section>
  );
}
