import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { createControlRouter } from "./router";
import "./styles.css";

const root = document.getElementById("root");
if (root === null) throw new Error("Control application root is unavailable.");

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={createControlRouter()} />
  </StrictMode>,
);
