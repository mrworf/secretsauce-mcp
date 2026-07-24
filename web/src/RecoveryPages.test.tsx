// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OpenApiHelpPage,
  RecoveryPage,
} from "./RecoveryPages";
import type {
  RecoveryControlApi,
  RecoverySnapshot,
} from "./controlApi";

afterEach(cleanup);

describe("recovery and OpenAPI workspaces", () => {
  it("renders safe durable work, links to owning workspaces, and pages explicitly", async () => {
    const user = userEvent.setup();
    const api: RecoveryControlApi = {
      recoveryRemediations: vi.fn(async (cursor) =>
        cursor === undefined ? FIRST : SECOND),
    };
    const view = render(
      <MemoryRouter><RecoveryPage api={api} /></MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Migration and restore status" }))
      .toBeInTheDocument();
    expect(screen.getByText(/2 services imported; 4 V1 ACL entries discarded/))
      .toBeInTheDocument();
    expect(screen.getByText("Supply an unavailable credential"))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open workspace" }))
      .toHaveAttribute("href", "/credentials");

    await user.click(screen.getByRole("button", { name: "Load more tasks" }));
    await waitFor(() =>
      expect(api.recoveryRemediations).toHaveBeenLastCalledWith(FIRST.next_cursor));
    expect(screen.getByText("Validate and publish the service")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more tasks" }))
      .not.toBeInTheDocument();
    expect(view.container.textContent).not.toMatch(
      /private-user|credential-value|vault-locator|\/private\//i,
    );
  });

  it("renders bounded loading and safe error states without exception details", async () => {
    const user = userEvent.setup();
    let reject!: (error: Error) => void;
    const pending = new Promise<RecoverySnapshot>((_resolve, rejected) => {
      reject = rejected;
    });
    const api: RecoveryControlApi = {
      recoveryRemediations: vi.fn(() => pending),
    };
    const view = render(<MemoryRouter><RecoveryPage api={api} /></MemoryRouter>);
    expect(screen.getByRole("status")).toHaveTextContent("Loading recovery tasks");
    reject(new Error("credential-value /private/source.yaml"));
    expect(await screen.findByRole("alert"))
      .toHaveTextContent("Recovery tasks could not be loaded");
    expect(view.container.textContent).not.toContain("credential-value");
    expect(view.container.textContent).not.toContain("/private/source.yaml");

    vi.mocked(api.recoveryRemediations).mockResolvedValueOnce(FIRST);
    await user.click(screen.getByRole("button", { name: "Retry recovery tasks" }));
    expect(await screen.findByRole("heading", { name: "Migration and restore status" }))
      .toBeInTheDocument();
  });

  it("preserves rendered tasks when pagination fails and offers the same retry action", async () => {
    const user = userEvent.setup();
    const api: RecoveryControlApi = {
      recoveryRemediations: vi.fn()
        .mockResolvedValueOnce(FIRST)
        .mockRejectedValueOnce(new Error("private diagnostic")),
    };
    render(<MemoryRouter><RecoveryPage api={api} /></MemoryRouter>);
    expect(await screen.findByText("Supply an unavailable credential")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Load more tasks" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Existing tasks remain available");
    expect(screen.getByText("Supply an unavailable credential")).toBeInTheDocument();
    expect(screen.queryByText("private diagnostic")).not.toBeInTheDocument();
  });

  it("provides real OpenAPI authentication and mutation guidance", () => {
    render(<OpenApiHelpPage />);
    expect(screen.getByRole("heading", { name: "OpenAPI 3.1 reference" }))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open generated OpenAPI JSON" }))
      .toHaveAttribute("href", "/api/v2/openapi.json");
    expect(screen.getByText(/API keys never satisfy browser step-up/))
      .toBeInTheDocument();
    expect(screen.getByText(/strong ETags through If-Match/)).toBeInTheDocument();
    expect(screen.getByText(/Pagination is bounded and cursor-based/))
      .toBeInTheDocument();
  });
});

const FIRST: RecoverySnapshot = {
  migration: {
    state: "completed",
    migration_id: "018f1f2e-7b3c-7a10-8000-000000000001",
    resolution_mode: "definitions_only",
    services: 2,
    credentials: 1,
    configured_credentials: 0,
    discarded_acl_entries: 4,
    completed_at: 1,
  },
  latest_restore: {
    restore_id: "018f1f2e-7b3c-7a10-8000-000000000002",
    state: "completed",
    outcome_code: "completed",
    services: 2,
    credentials: 1,
    available_secrets: 0,
    unavailable_secrets: 1,
    completed_at: 2,
  },
  counts: { total: 2, open: 2, completed: 0, dismissed: 0 },
  tasks: [{
    kind: "migration",
    operation_id: "018f1f2e-7b3c-7a10-8000-000000000001",
    id: "018f1f2e-7b3c-7a10-8000-000000000003",
    service_id: "018f1f2e-7b3c-7a10-8000-000000000004",
    service_slug: "example-service",
    target_id: "018f1f2e-7b3c-7a10-8000-000000000005",
    task_kind: "supply_credential",
    state: "open",
    derived_from_current_state: false,
    created_at: 1,
    updated_at: 1,
  }],
  next_cursor: "migration:018f1f2e-7b3c-7a10-8000-000000000003",
};

const SECOND: RecoverySnapshot = {
  ...FIRST,
  tasks: [{
    kind: "restore",
    operation_id: "018f1f2e-7b3c-7a10-8000-000000000002",
    id: "018f1f2e-7b3c-7a10-8000-000000000006",
    service_id: "018f1f2e-7b3c-7a10-8000-000000000004",
    service_slug: "example-service",
    task_kind: "validate_publish_service",
    state: "open",
    derived_from_current_state: false,
    created_at: 2,
    updated_at: 2,
  }],
  next_cursor: undefined,
};
