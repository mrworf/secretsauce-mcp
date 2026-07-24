// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuditPage } from "./AuditPages";
import type { AuditControlApi } from "./controlApi";

afterEach(cleanup);

describe("audit explorer", () => {
  it("shows assigned-service scope, safe event snapshots, and bounded filters", async () => {
    const api = fakeApi();
    const view = render(<AuditPage domain="runtime" role="admin" api={api} />);

    expect(await screen.findByText("service_request")).toBeInTheDocument();
    expect(screen.getByText(/limited to services currently assigned/)).toBeInTheDocument();
    expect(screen.getByText(/Payments Gateway/)).toBeInTheDocument();
    expect(view.container.innerHTML).not.toMatch(/bearer\s|cookie_value|gref_|sec_/i);

    fireEvent.change(screen.getByLabelText("Search allowed fields"), {
      target: { value: "policy denial" },
    });
    fireEvent.change(screen.getByLabelText("Outcome"), { target: { value: "deny" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(api.auditEvents).toHaveBeenLastCalledWith(
      "runtime",
      expect.objectContaining({
        q: "policy denial",
        outcome: "deny",
        preset: "24h",
      }),
    ));
  });

  it("rejects a nonexistent DST local time before sending another request", async () => {
    const api = fakeApi();
    render(<AuditPage domain="administrative" role="admin" api={api} />);
    await screen.findByText("service_request");

    fireEvent.change(screen.getByLabelText("Time range"), { target: { value: "custom" } });
    fireEvent.change(screen.getByLabelText("IANA display timezone"), {
      target: { value: "America/Los_Angeles" },
    });
    fireEvent.change(screen.getByLabelText("Start local time"), {
      target: { value: "2026-03-08T02:30:00" },
    });
    fireEvent.change(screen.getByLabelText("End local time"), {
      target: { value: "2026-03-08T03:30:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "does not exist in the selected timezone",
    );
    expect(api.auditEvents).toHaveBeenCalledTimes(1);
  });
});

function fakeApi(): AuditControlApi & {
  auditEvents: ReturnType<typeof vi.fn<AuditControlApi["auditEvents"]>>;
} {
  return {
    auditEvents: vi.fn<AuditControlApi["auditEvents"]>(async () => ({
      events: [{
        domain: "runtime",
        event_id: "018f1f2e-7b3c-7a10-8000-000000000001",
        occurred_at: 1_800_000_000_000,
        category: "policy",
        outcome: "allow",
        action: "service_request",
        actor_label: "Example user",
        service_label: "Payments Gateway",
        changes: [],
        source: { category: "mcp" },
        details: { policy_decision: "allow" },
      }],
    })),
    selfSecurity: async () => ({ events: [] }),
    exportAudit: async () => ({
      filename: "secretsauce-runtime-audit.ndjson",
      media_type: "application/x-ndjson",
      content: "",
      row_count: 0,
      byte_count: 0,
    }),
    auditRetention: async () => ({
      settings: {
        administrative_days: 400,
        runtime_days: 400,
        version: 1,
        created_at: 0,
        updated_at: 0,
      },
      administrative: capacity(),
      runtime: capacity(),
      maintenance: {
        next_run_at: 0,
        lease_expires_at: null,
        last_started_at: null,
        last_completed_at: null,
        last_outcome: null,
        last_code: null,
        retained_administrative_count: 0,
        retained_runtime_count: 0,
        repaired_index_count: 0,
        version: 1,
      },
    }),
    updateAuditRetention: async (input) => input.current,
    runAuditMaintenance: async () => {
      throw new Error("not used");
    },
  };
}

function capacity() {
  return {
    row_count: 0,
    oldest_occurred_at: null,
    newest_occurred_at: null,
    estimated_bytes: 0,
    warnings: [],
  };
}
