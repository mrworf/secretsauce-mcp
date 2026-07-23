import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { createControlRouter } from "./router";
import { browserControlApi, type UserRole } from "./controlApi";
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

  useEffect(() => {
    browserControlApi.session()
      .then((session) => setRole(session.role))
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <main className="startup-message" role="alert">
        <h1>Sign in required</h1>
        <p>Your control session is unavailable. Sign in again, then reload this page.</p>
      </main>
    );
  }
  if (role === undefined) {
    return <main className="startup-message" role="status">Loading your control workspace…</main>;
  }
  return <RouterProvider router={createControlRouter(role)} />;
}
