// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ActivityPage,
  OverviewPage,
  SecurityDashboardPanel,
  StatusPage,
} from "./DashboardPages";
import type {
  ActivityDashboard,
  DashboardControlApi,
  SecurityDashboard,
  StatusDashboard,
} from "./controlApi";

afterEach(cleanup);

describe("operator dashboard workspaces", () => {
  it("renders overview totals and safe drill-down links", async () => {
    const api = fakeApi();
    render(<MemoryRouter><OverviewPage role="admin" api={api} /></MemoryRouter>);
    expect(await screen.findByText("Requests in window")).toBeInTheDocument();
    expect(screen.getByText("Authorization outcomes")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open activity" }))
      .toHaveAttribute("href", "/activity");
    expect(screen.queryByText("/private/customer")).not.toBeInTheDocument();
  });

  it("updates bounded activity filters and labels suppressed user counts", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    render(<ActivityPage api={api} />);
    expect(await screen.findByText("Fewer than 3")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Window"), "30d");
    await waitFor(() => expect(api.activityDashboard).toHaveBeenLastCalledWith({
      window: "30d",
    }));
    expect(screen.getByRole("img", { name: /requests; 1 denied/i }))
      .toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Policy endpoint categories" }))
      .toBeInTheDocument();
  });

  it("renders component and service status without internal details", async () => {
    const api = fakeApi();
    render(<StatusPage api={api} />);
    expect(await screen.findByRole("heading", { name: "Component health" }))
      .toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Alpha Service" }))
      .toBeInTheDocument();
    expect(screen.getAllByText("Unavailable")).not.toHaveLength(0);
    expect(screen.getByText("Audit capacity")).toBeInTheDocument();
    expect(screen.getByText("1 KiB")).toBeInTheDocument();
    expect(screen.getByText("Active gateway references")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("/private");
  });

  it("retains non-secret remediation input and clears credentials after failure", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    api.updateDashboardRemediation.mockRejectedValueOnce(new Error("private"));
    render(<SecurityDashboardPanel role="admin" api={api} />);
    await user.click(await screen.findByRole("button", { name: "Review" }));
    await user.type(screen.getByLabelText("Justification"), "Reviewed finding.");
    await user.type(screen.getByLabelText("Password"), "private-password");
    await user.type(screen.getByLabelText("Authenticator code"), "123456");
    await user.click(screen.getByRole("button", { name: "Confirm action" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The remediation could not be updated.",
    );
    expect(screen.getByLabelText("Justification")).toHaveValue("Reviewed finding.");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByLabelText("Authenticator code")).toHaveValue("");
    expect(document.body.textContent).not.toContain("private-password");
  });
});

type FakeApi = {
  [K in keyof DashboardControlApi]: ReturnType<typeof vi.fn<DashboardControlApi[K]>>;
};

function fakeApi(): FakeApi {
  return {
    activityDashboard: vi.fn(async () => ACTIVITY),
    statusDashboard: vi.fn(async () => STATUS),
    securityDashboard: vi.fn(async () => SECURITY),
    updateDashboardRemediation: vi.fn(async () => SECURITY.remediations[0]!),
    rebuildActivity: vi.fn(async () => ({})),
  };
}

const ACTIVITY: ActivityDashboard = {
  generated_at: 1,
  window: "24h",
  start_at: 0,
  end_at: 86_400_000,
  totals: {
    requests: 12,
    allow: 10,
    deny: 1,
    error: 1,
    credential_uses: 4,
    tokenizations: 2,
    api_key_activity: 3,
    active_users: { value: null, suppressed: true, threshold: 3 },
  },
  trend: [{
    bucket_start: 0,
    requests: 12,
    allow: 10,
    deny: 1,
    error: 1,
    status_1xx: 0,
    status_2xx: 10,
    status_3xx: 0,
    status_4xx: 1,
    status_5xx: 1,
  }],
  services: [{
    service_id: "018f1f2e-7b3c-7a10-8000-000000000010",
    service_name: "Alpha Service",
    requests: 12,
    credential_uses: 4,
    active_users: { value: null, suppressed: true, threshold: 3 },
  }],
  endpoints: [{
    service_id: "018f1f2e-7b3c-7a10-8000-000000000010",
    service_name: "Alpha Service",
    category: "widgets.read",
    requests: 12,
  }],
  freshness: {
    cursor_sequence: 1,
    source_sequence: 1,
    last_completed_at: 1,
    partial: false,
  },
};

const STATUS: StatusDashboard = {
  generated_at: 1,
  services: [{
    service_id: "018f1f2e-7b3c-7a10-8000-000000000010",
    name: "Alpha Service",
    lifecycle: "published",
    publication_generation: 1,
    credentials: { configured: 1, unconfigured: 0, disabled: 0, archived: 0 },
    references: {
      state: "unavailable",
      gref: { active: 0, expiring: 0, expired: 0 },
      sec: { active: 0, expiring: 0, expired: 0 },
    },
    active_grant_count: 2,
    api_keys: { active: 1, expiring: 0, expired: 0 },
    pending_remediation_count: 1,
  }],
  service_count: 1,
  services_truncated: false,
  system: {
    components: {
      database: "ready",
      schema: "ready",
      vault: "ready",
      audit: "ready",
      identity: "ready",
    },
    jobs: {
      audit: { state: "ready", next_run_at: 1, last_completed_at: 1, last_outcome: "completed", last_code: "ok" },
      activity: { state: "ready", next_run_at: 1, last_completed_at: 1, last_outcome: "completed", last_code: "ok" },
      inactivity: { state: "unavailable", next_run_at: null, last_completed_at: null, last_outcome: null, last_code: null },
    },
    audit_capacity: {
      administrative_rows: 1,
      runtime_rows: 1,
      estimated_bytes: 1024,
      warnings: [],
    },
    api_keys: { active: 1, expiring: 0, expired: 0, non_expiring: 1 },
    users: {
      suspended: 0,
      deactivated: 0,
      pending_enrollment: 0,
      active_without_services: 0,
    },
  },
};

const SECURITY: SecurityDashboard = {
  generated_at: 1,
  signals: [{
    code: "credential.missing",
    severity: "warning",
    count: 1,
    first_seen_at: 1,
    last_seen_at: 1,
    service_id: "018f1f2e-7b3c-7a10-8000-000000000010",
    remediation_id: "018f1f2e-7b3c-7a10-8000-000000000020",
    remediation_state: "open",
    remediation_version: 1,
  }],
  remediations: [{
    id: "018f1f2e-7b3c-7a10-8000-000000000020",
    code: "credential.missing",
    severity: "warning",
    service_id: "018f1f2e-7b3c-7a10-8000-000000000010",
    generation: 1,
    state: "open",
    first_seen_at: 1,
    last_seen_at: 1,
    version: 1,
  }],
};
