// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { createTestControlRouter } from "./router";

afterEach(cleanup);

describe("control application shell", () => {
  it("renders landmarks, skip navigation, live status, and the active route", async () => {
    const user = userEvent.setup();
    render(<RouterProvider router={createTestControlRouter("user")} />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getAllByRole("navigation", { name: "Control plane" })).toHaveLength(2);
    expect(screen.getByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Overview" })[0])
      .toHaveAttribute("aria-current", "page");

    await user.tab();
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveFocus();
  });

  it("filters placeholders through the central role matrix", () => {
    const userView = render(
      <RouterProvider router={createTestControlRouter("user")} />,
    );
    expect(screen.queryByRole("link", { name: "API keys" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Backup and restore" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Profile" })).toHaveLength(2);
    userView.unmount();

    render(<RouterProvider router={createTestControlRouter("superadmin")} />);
    expect(screen.getAllByRole("link", { name: "API keys" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Backup and restore" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Migration status" })).toHaveLength(2);
  });

  it("renders a deep route semantically without credentials, references, or diagnostics", async () => {
    const view = render(
      <RouterProvider router={createTestControlRouter("admin", "/services")} />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Services" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 2, name: "Service drafts" }))
      .toBeInTheDocument();
    expect(view.container.innerHTML).not.toMatch(
      /(?:gref_|authorization\s*:|bearer\s+|cookie\s*:|request body)/i,
    );
  });

  it("renders the backup workspace only for a superadmin route", () => {
    render(
      <RouterProvider router={createTestControlRouter("superadmin", "/backup")} />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Create portable backup" }))
      .toBeInTheDocument();
    expect(screen.getByText("Permanent exclusions")).toBeInTheDocument();
  });
});
