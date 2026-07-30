// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./App";
import { createTestControlRouter } from "./router";
import { MemoryRouter } from "./routing";

afterEach(cleanup);

describe("control application shell", () => {
  it("renders landmarks, skip navigation, live status, and the active route", async () => {
    const user = userEvent.setup();
    render(createTestControlRouter("user"));

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

  it("moves focus to the page heading after client-side route changes", async () => {
    const user = userEvent.setup();
    render(createTestControlRouter("user"));
    await user.click(screen.getAllByRole("link", { name: "Services" })[0]!);
    expect(screen.getByRole("heading", { level: 1, name: "Services" })).toHaveFocus();
  });

  it("filters implemented workspaces through the central role matrix", () => {
    const userView = render(
      createTestControlRouter("user"),
    );
    expect(screen.queryByRole("link", { name: "API keys" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Backup and restore" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Profile" })).toHaveLength(2);
    userView.unmount();

    render(createTestControlRouter("superadmin"));
    expect(screen.getAllByRole("link", { name: "API keys" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Backup and restore" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Recovery tasks" })).toHaveLength(2);
  });

  it("renders a deep route semantically without credentials, references, or diagnostics", async () => {
    const view = render(
      createTestControlRouter("admin", "/services"),
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
      createTestControlRouter("superadmin", "/backup"),
    );
    expect(screen.getByRole("heading", { level: 2, name: "Create portable backup" }))
      .toBeInTheDocument();
    expect(screen.getByText("Permanent exclusions")).toBeInTheDocument();
  });

  it("keeps the page active and returns focus when logout cannot commit, then retries", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const authApi = {
      session: vi.fn().mockResolvedValue({
        user_id: "018f1f2e-7b3c-7a10-8000-000000000001",
        role: "user" as const,
        csrf_token: "c".repeat(43),
        expires_at: 1_785_000_900_000,
      }),
      logout: vi.fn()
        .mockRejectedValueOnce(new Error("audit unavailable"))
        .mockResolvedValueOnce({ logged_out: true as const }),
    };
    render(
      <MemoryRouter>
        <AppShell role="user" authApi={authApi} navigate={navigate}>
          <p>Still authenticated</p>
        </AppShell>
      </MemoryRouter>,
    );
    await user.click(screen.getByText("Account", { selector: "summary" }));
    const logout = screen.getByRole("button", { name: "Log out" });
    await user.click(logout);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Logout could not be completed. This session is still active. Try again.",
    );
    expect(screen.getByText("Still authenticated")).toBeInTheDocument();
    expect(logout).toHaveFocus();
    expect(navigate).not.toHaveBeenCalled();

    await user.click(logout);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/control/login"));
    expect(authApi.logout).toHaveBeenCalledTimes(2);
  });
});
