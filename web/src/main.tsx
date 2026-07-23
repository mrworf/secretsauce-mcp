import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { createControlRouter } from "./router";
import {
  browserControlApi,
  type RestrictedOidcOptions,
  type UserRole,
} from "./controlApi";
import { OidcSignIn } from "./OidcSignIn";
import "./styles.css";

const root = document.getElementById("root");
if (root === null) throw new Error("Control application root is unavailable.");

createRoot(root).render(
  <StrictMode>
    <AuthenticatedControl />
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
    return <OidcSignIn />;
  }
  if (role === undefined) {
    return <main className="startup-message" role="status">Loading your control workspace…</main>;
  }
  return <RouterProvider router={createControlRouter(role)} />;
}
