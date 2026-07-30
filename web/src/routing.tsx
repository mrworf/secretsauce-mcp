import {
  createContext,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

interface RouterState {
  basename: string;
  pathname: string;
  navigate: (pathname: string) => void;
}

const RouterContext = createContext<RouterState | undefined>(undefined);

interface RouterProps {
  children: ReactNode;
}

export function BrowserRouter({
  basename,
  children,
}: RouterProps & { basename: string }) {
  const normalizedBase = normalizeBasename(basename);
  const [pathname, setPathname] = useState(() =>
    routePath(window.location.pathname, normalizedBase));

  useEffect(() => {
    const onPopState = () =>
      setPathname(routePath(window.location.pathname, normalizedBase));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [normalizedBase]);

  const state = useMemo<RouterState>(() => ({
    basename: normalizedBase,
    pathname,
    navigate: (destination) => {
      const next = safeDestination(destination);
      window.history.pushState(null, "", browserHref(normalizedBase, next));
      setPathname(next);
    },
  }), [normalizedBase, pathname]);

  return <RouterContext.Provider value={state}>{children}</RouterContext.Provider>;
}

export function MemoryRouter({
  initialPath = "/",
  children,
}: RouterProps & { initialPath?: string }) {
  const [pathname, setPathname] = useState(() => safeDestination(initialPath));
  const state = useMemo<RouterState>(() => ({
    basename: "",
    pathname,
    navigate: setPathname,
  }), [pathname]);
  return <RouterContext.Provider value={state}>{children}</RouterContext.Provider>;
}

export function useLocation(): { pathname: string } {
  return { pathname: useRouter().pathname };
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string;
};

export function Link({ to, onClick, target, ...props }: LinkProps) {
  const router = useRouter();
  const destination = safeDestination(to);
  const href = browserHref(router.basename, destination);

  function follow(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
      || (target !== undefined && target !== "_self")) {
      return;
    }
    event.preventDefault();
    router.navigate(destination);
  }

  return <a {...props} href={href} target={target} onClick={follow} />;
}

export function NavLink({
  to,
  end = false,
  ...props
}: LinkProps & { end?: boolean }) {
  const { pathname } = useRouter();
  const destination = safeDestination(to);
  const active = pathname === destination
    || (!end && destination !== "/" && pathname.startsWith(`${destination}/`));
  return (
    <Link
      {...props}
      to={destination}
      aria-current={active ? "page" : props["aria-current"]}
    />
  );
}

function useRouter(): RouterState {
  const router = useContext(RouterContext);
  if (router === undefined) {
    throw new Error("Control navigation must be rendered inside a router.");
  }
  return router;
}

function normalizeBasename(basename: string): string {
  const normalized = basename.endsWith("/") ? basename.slice(0, -1) : basename;
  if (!normalized.startsWith("/") || normalized === "") {
    throw new Error("The router basename must be an absolute path.");
  }
  return normalized;
}

function routePath(pathname: string, basename: string): string {
  if (pathname === basename || pathname === `${basename}/`) return "/";
  if (pathname.startsWith(`${basename}/`)) return pathname.slice(basename.length);
  return pathname;
}

function safeDestination(destination: string): string {
  if (!destination.startsWith("/")
    || destination.startsWith("//")
    || destination.includes("\\")
    || destination.includes("?")
    || destination.includes("#")) {
    throw new Error("Control navigation destinations must be absolute application paths.");
  }
  return destination.length > 1 && destination.endsWith("/")
    ? destination.slice(0, -1)
    : destination;
}

function browserHref(basename: string, destination: string): string {
  if (basename === "") return destination;
  return destination === "/" ? `${basename}/` : `${basename}${destination}`;
}
