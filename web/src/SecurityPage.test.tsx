// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SecurityPage } from "./SecurityPage";
import {
  ControlApiError,
  type SecurityControlApi,
  type SecuritySettings,
} from "./controlApi";

afterEach(cleanup);

describe("security workspace", () => {
  it("keeps personal security visible without exposing system controls", () => {
    const api = fakeApi();
    render(
      <MemoryRouter>
        <SecurityPage role="user" api={api} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Personal security" }))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open personal security" }))
      .toHaveAttribute("href", "/profile");
    expect(screen.queryByText("System-wide authenticator events"))
      .not.toBeInTheDocument();
    expect(api.securitySettings).not.toHaveBeenCalled();
  });

  it("preserves non-secret edits after failure and clears password and TOTP", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    api.updateSecuritySettings.mockRejectedValueOnce(
      new ControlApiError("stale_version", "Security settings changed."),
    );
    render(
      <MemoryRouter>
        <SecurityPage role="superadmin" api={api} />
      </MemoryRouter>,
    );
    const panel = (await screen.findByRole("heading", {
      name: "Security settings",
    })).closest("section")!;
    const scoped = within(panel);
    const minimum = scoped.getByLabelText(/^Minimum Unicode characters/);
    await user.clear(minimum);
    await user.type(minimum, "16");
    await user.type(
      scoped.getByLabelText("Acknowledgement"),
      "I ACCEPT SYSTEM-WIDE SECURITY POLICY CHANGES",
    );
    await user.type(scoped.getByLabelText("Justification"), "Raise minimum.");
    await user.type(scoped.getByLabelText("Current password"), "not-retained");
    await user.type(scoped.getByLabelText("Current 6-digit TOTP"), "123456");
    await user.click(scoped.getByRole("button", { name: "Save security settings" }));

    await waitFor(() => expect(api.updateSecuritySettings).toHaveBeenCalled());
    expect(await screen.findByRole("alert")).toHaveTextContent("Security settings changed.");
    expect(minimum).toHaveValue(16);
    expect(scoped.getByLabelText("Current password")).toHaveValue("");
    expect(scoped.getByLabelText("Current 6-digit TOTP")).toHaveValue("");
    expect(document.body.textContent).not.toContain("not-retained");
    expect(api.updateSecuritySettings).toHaveBeenCalledWith(
      expect.objectContaining({ version: 4 }),
      expect.objectContaining({ password_minimum_length: 16 }),
      expect.objectContaining({
        acknowledgement: "I ACCEPT SYSTEM-WIDE SECURITY POLICY CHANGES",
      }),
    );
  });

  it("requires the distinct TOTP acknowledgement and transitions to signed out", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    render(
      <MemoryRouter>
        <SecurityPage role="superadmin" api={api} />
      </MemoryRouter>,
    );
    const panel = (await screen.findByRole("heading", {
      name: "Erase all local TOTP authenticators",
    })).closest("article")!;
    const scoped = within(panel);
    const submit = scoped.getByRole("button", {
      name: "Erase all local TOTP authenticators",
    });
    await user.type(scoped.getByLabelText("Acknowledgement"), "wrong");
    await user.type(scoped.getByLabelText("Justification"), "Replace authenticators.");
    await user.type(scoped.getByLabelText("Current password"), "not-retained");
    await user.type(scoped.getByLabelText("Current 6-digit TOTP"), "123456");
    expect(submit).toBeDisabled();
    await user.clear(scoped.getByLabelText("Acknowledgement"));
    await user.type(
      scoped.getByLabelText("Acknowledgement"),
      "ERASE ALL LOCAL TOTP AUTHENTICATORS",
    );
    await user.click(submit);

    await waitFor(() => expect(api.executeGlobalSecurityEvent).toHaveBeenCalledWith(
      "totp_reset",
      9,
      expect.objectContaining({
        acknowledgement: "ERASE ALL LOCAL TOTP AUTHENTICATORS",
      }),
    ));
    expect(await screen.findByRole("heading", { name: "You are signed out" }))
      .toBeInTheDocument();
    expect(document.body.textContent).not.toContain("not-retained");
  });
});

type FakeSecurityApi = {
  [K in keyof SecurityControlApi]: ReturnType<typeof vi.fn<SecurityControlApi[K]>>;
};

function fakeApi(): FakeSecurityApi {
  return {
    securitySettings: vi.fn(async () => SETTINGS),
    updateSecuritySettings: vi.fn(async () => ({ ...SETTINGS, version: 5 })),
    inactivityJob: vi.fn(async () => ({
      next_run_at: 2,
      lease_expires_at: null,
      last_started_at: 1,
      last_completed_at: 1,
      last_outcome: "completed",
      last_code: "ok",
      suspended_count: 2,
      deactivated_count: 1,
      protected_count: 0,
      version: 2,
    })),
    runInactivityJob: vi.fn(async () => ({
      next_run_at: 3,
      lease_expires_at: null,
      last_started_at: 2,
      last_completed_at: 2,
      last_outcome: "completed",
      last_code: "ok",
      suspended_count: 0,
      deactivated_count: 0,
      protected_count: 0,
      version: 3,
    })),
    securityEvents: vi.fn(async () => ({ items: [], state_version: 9 })),
    executeGlobalSecurityEvent: vi.fn(async (kind) => ({
      id: "018f1f2e-7b3c-7a10-8000-000000000060",
      kind,
      actor_user_id: "018f1f2e-7b3c-7a10-8000-000000000001",
      actor_role: "superadmin",
      justification: "Replace authenticators.",
      affected_users: 2,
      resulting_global_epoch: 10,
      resulting_password_policy_version: 2,
      created_at: 2,
      replayed: false,
    })),
  };
}

const SETTINGS: SecuritySettings = {
  password_minimum_length: 12,
  password_blocklist_version: 1,
  password_policy_version: 2,
  admin_session_absolute_ms: 43_200_000,
  admin_session_inactivity_ms: 900_000,
  user_session_absolute_ms: 86_400_000,
  user_session_inactivity_ms: 3_600_000,
  oauth_access_token_ms: 300_000,
  oauth_refresh_inactivity_ms: 2_592_000_000,
  oauth_refresh_absolute_ms: 7_776_000_000,
  step_up_mode: "five_minutes",
  login_attempts: 10,
  login_window_ms: 900_000,
  password_attempts: 10,
  password_window_ms: 900_000,
  totp_attempts: 5,
  totp_window_ms: 300_000,
  management_api_attempts: 120,
  management_api_window_ms: 60_000,
  search_attempts: 30,
  search_window_ms: 60_000,
  backup_attempts: 2,
  backup_window_ms: 3_600_000,
  inactivity_suspension_days: null,
  suspended_deactivation_days: null,
  security_job_interval_ms: 300_000,
  security_job_batch_size: 500,
  security_job_wall_time_ms: 30_000,
  version: 4,
  created_at: 1,
  updated_at: 1,
};
