import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { createControlRouter } from "./router";
import {
  browserControlApi,
  type RestrictedOidcOptions,
  type UserRole,
} from "./controlApi";
import { OidcSignIn } from "./OidcSignIn";
import { SetupPage } from "./SetupPage";
import { EnrollmentPage } from "./EnrollmentPage";
import { LoginPage } from "./LoginPage";
import "./styles.css";

const root = document.getElementById("root");
if (root === null) throw new Error("Control application root is unavailable.");

createRoot(root).render(
  <StrictMode>
    {window.location.pathname === "/control/setup"
      || window.location.pathname === "/control/setup/"
      ? <SetupPage />
      : window.location.pathname === "/control/enroll"
        || window.location.pathname === "/control/enroll/"
        ? <EnrollmentPage />
      : window.location.pathname === "/control/login"
        || window.location.pathname === "/control/login/"
        ? <LoginPage />
      : <AuthenticatedControl />}
  </StrictMode>,
);

function AuthenticatedControl() {
  const [role, setRole] = useState<UserRole>();
  const [failed, setFailed] = useState(false);
  const [restricted, setRestricted] = useState<RestrictedOidcOptions>();

  useEffect(() => {
    browserControlApi.session()
      .then((session) => setRole(session.role))
      .catch(() => {
        browserControlApi.oidcEnrollmentOptions()
          .then(setRestricted)
          .catch(() => setFailed(true));
      });
  }, []);

  if (restricted !== undefined) {
    return <OidcSignIn restricted={restricted} />;
  }
  if (failed) {
    return <LoginPage />;
  }
  if (role === undefined) {
    return <main className="startup-message" role="status">Loading your control workspace…</main>;
  }
  return createControlRouter(role);
}
