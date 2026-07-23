// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://control.example.org/"}
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ControlApi,
  ControlUser,
  UserAction,
  UserProfileInput,
  UserRole,
} from "./controlApi";
import { ProfilePage, UsersPage } from "./UserPages";

afterEach(cleanup);

describe("user and profile views", () => {
  it("keeps ordinary users on the self-profile path without querying the directory", () => {
    const api = fakeApi();
    render(<MemoryRouter><UsersPage role="user" api={api} /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "User administration is restricted" }))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/profile");
    expect(api.listUsers).not.toHaveBeenCalled();
  });

  it("exposes related ordinary-user workflows to admins without privileged role or deletion controls", async () => {
    const api = fakeApi();
    render(<MemoryRouter><UsersPage role="admin" api={api} /></MemoryRouter>);
    expect(await screen.findByRole("button", { name: "Update user profile" }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset password" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change role" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Permanently delete" })).not.toBeInTheDocument();
  });

  it("lists, filters, invites, and displays a temporary value in a live one-time panel", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    const storeTemporaryValue = vi.fn();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: { setItem: storeTemporaryValue },
    });
    render(<MemoryRouter><UsersPage role="superadmin" api={api} /></MemoryRouter>);
    expect((await screen.findAllByText("target@example.org")).length).toBeGreaterThan(0);
    await user.type(screen.getByLabelText("Search"), "target");
    await user.click(screen.getByRole("button", { name: "Apply filters" }));
    await waitFor(() => expect(api.listUsers).toHaveBeenLastCalledWith({
      q: "target",
    }));

    await user.click(screen.getByRole("button", { name: "New invitation" }));
    await user.type(screen.getAllByLabelText("Email")[1]!, "new@example.org");
    await user.type(screen.getAllByLabelText("Given name")[1]!, "New");
    await user.type(screen.getAllByLabelText("Family name")[1]!, "User");
    await user.click(screen.getByRole("button", { name: "Create invitation" }));
    expect(await screen.findByRole("heading", { name: "Temporary password" }))
      .toBeInTheDocument();
    expect(screen.getByText("temporary-display-value")).toBeInTheDocument();
    expect(screen.getByText(/cannot be shown again/i)).toBeInTheDocument();
    expect(storeTemporaryValue).not.toHaveBeenCalled();
    expect(window.location.href).not.toContain("temporary-display-value");
  });

  it("confirms lifecycle actions with justification and applies returned state", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    render(<MemoryRouter><UsersPage role="superadmin" api={api} /></MemoryRouter>);
    await screen.findAllByText("target@example.org");
    await user.click(screen.getByRole("button", { name: "Deactivate" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Justification"), "Approved deactivation.");
    await user.click(screen.getByRole("button", { name: "Confirm action" }));
    await waitFor(() => expect(api.userAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: TARGET.id }),
      "deactivate",
      "Approved deactivation.",
      undefined,
    ));
    expect((await screen.findAllByText("Deactivated")).length).toBeGreaterThan(1);
  });

  it("edits only the authenticated profile and links isolated security actions", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    render(<MemoryRouter><ProfilePage api={api} /></MemoryRouter>);
    const givenName = await screen.findByLabelText("Given name");
    await user.clear(givenName);
    await user.type(givenName, "Updated");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(api.updateSelf).toHaveBeenCalledWith(
      TARGET,
      expect.objectContaining({ given_name: "Updated" }),
    ));
    expect(await screen.findByRole("status")).toHaveTextContent("Profile saved");
    expect(screen.getByRole("link", { name: "Open security actions" }))
      .toHaveAttribute("href", "/security");
  });
});

const TARGET: ControlUser = {
  id: "018f1f2e-7b3c-7a10-8000-000000000010",
  email: "target@example.org",
  given_name: "Target",
  family_name: "User",
  role: "user",
  status: "active",
  password_state: "configured",
  totp_state: "configured",
  version: 1,
  created_at: 1,
  updated_at: 1,
};

function fakeApi(): ControlApi & {
  listUsers: ReturnType<typeof vi.fn<ControlApi["listUsers"]>>;
  updateSelf: ReturnType<typeof vi.fn<ControlApi["updateSelf"]>>;
  userAction: ReturnType<typeof vi.fn<ControlApi["userAction"]>>;
} {
  const listUsers = vi.fn<ControlApi["listUsers"]>(async () => ({ users: [TARGET] }));
  const updateSelf = vi.fn<ControlApi["updateSelf"]>(
    async (_user: ControlUser, profile: UserProfileInput) => ({
      ...TARGET,
      ...profile,
      version: TARGET.version + 1,
    }),
  );
  const userAction = vi.fn<ControlApi["userAction"]>(
    async (
      target: ControlUser,
      action: UserAction,
      _justification: string,
      _role?: UserRole,
    ) => ({
      ...target,
      status: action === "deactivate" ? "deactivated" as const : target.status,
      password_state: action === "deactivate" ? "disabled" as const : target.password_state,
      totp_state: action === "deactivate" ? "disabled" as const : target.totp_state,
      version: target.version + 1,
    }),
  );
  return {
    session: async () => ({
      user_id: TARGET.id,
      role: "superadmin",
      csrf_token: "x".repeat(43),
      expires_at: 10,
    }),
    self: async () => TARGET,
    listUsers,
    updateSelf,
    updateUser: async (target, profile) => ({
      ...target,
      ...profile,
      version: target.version + 1,
    }),
    invite: async (input) => ({
      user: {
        ...TARGET,
        id: "018f1f2e-7b3c-7a10-8000-000000000011",
        ...input,
        status: "invited",
        password_state: "temporary",
        totp_state: "not_configured",
      },
      one_time_value_displayed: true,
      temporary_password: "temporary-display-value",
      expires_at: 20,
    }),
    userAction,
  };
}
