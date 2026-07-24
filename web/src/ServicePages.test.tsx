// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://control.example.org/control/services"}
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ControlServiceDetail,
  ServiceControlApi,
  ServiceDraftDocument,
} from "./controlApi";
import { ControlApiError } from "./controlApi";
import { ServicesPage } from "./ServicePages";

afterEach(cleanup);

describe("service management workspace", () => {
  it("shows superadmin lifecycle, ownership, safe transfer, and TLS state", async () => {
    const user = userEvent.setup();
    const api = fakeServiceApi();
    const storeTransferText = vi.fn();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: { setItem: storeTransferText },
    });
    const view = render(<ServicesPage role="superadmin" api={api} />);

    expect(await screen.findByRole("heading", { name: "Managed API" })).toBeInTheDocument();
    expect(screen.getByText("Unpublished changes")).toBeInTheDocument();
    expect(screen.getAllByText("TLS verification disabled").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Ownership" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lifecycle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New service" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create secret-free clone" }))
      .toBeInTheDocument();
    expect(screen.getByLabelText("Allowed schemes (comma-separated)"))
      .toHaveValue("https, http");
    expect(screen.getByLabelText("Allowed ports (comma-separated)"))
      .toHaveValue("443, 80");
    await user.click(screen.getByRole("button", { name: "Save primary destination" }));
    await waitFor(() => expect(api.updateDestination).toHaveBeenCalledWith(
      expect.objectContaining({ id: SERVICE.id }),
      DOCUMENT.destinations[0]!.id,
      expect.objectContaining({
        schemes: ["https", "http"],
        hosts: DOCUMENT.destinations[0]!.hosts,
        ports: [443, 80],
      }),
    ));

    await user.click(screen.getByRole("button", { name: "Validate draft" }));
    expect(await screen.findByText("Draft is publishable")).toBeInTheDocument();
    expect(screen.getByText(/publication preserves that choice/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Prepare safe copy" }));
    const copy = await screen.findByRole("textbox", { name: /canonical copy document/i });
    expect((copy as HTMLTextAreaElement).value).toContain("\"format_version\": 1");
    expect((copy as HTMLTextAreaElement).value).not.toMatch(
      /credential|principal|policy|oauth|runtime|admin/i,
    );
    expect(view.container.innerHTML).not.toMatch(/credential_value|authorization\s*:/i);
    expect(storeTransferText).not.toHaveBeenCalled();
    expect(window.location.href).not.toContain("format_version");
  });

  it("lets assigned admins configure and roll back without privileged controls", async () => {
    const user = userEvent.setup();
    const api = fakeServiceApi();
    render(<ServicesPage role="admin" api={api} />);
    expect(await screen.findByRole("heading", { name: "Managed API" })).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "New service" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ownership" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Lifecycle" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create secret-free clone" }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save service basics" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish draft" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Roll back to revision 1" }));
    const dialog = screen.getByRole("dialog", { name: "Publish revision 1 again?" });
    expect(within(dialog).getByRole("heading", { name: "Publish revision 1 again?" }))
      .toHaveFocus();
    expect(within(dialog).getAllByRole("button").map(({ textContent }) => textContent))
      .toEqual(["Cancel", "Confirm action"]);
    await user.type(within(dialog).getByLabelText("Justification"), "Restore known good state.");
    await user.click(within(dialog).getByRole("button", { name: "Confirm action" }));
    await waitFor(() => expect(api.rollbackService).toHaveBeenCalledWith(
      expect.objectContaining({ id: SERVICE.id }),
      REVISION.id,
      "Restore known good state.",
    ));
  });

  it("preserves non-secret form edits when optimistic concurrency is stale", async () => {
    const user = userEvent.setup();
    const api = fakeServiceApi();
    api.updateService.mockRejectedValueOnce(
      new ControlApiError("stale_version", "The resource changed. Refresh and retry."),
    );
    render(<ServicesPage role="admin" api={api} />);
    const name = await screen.findByLabelText("Service name");
    await user.clear(name);
    await user.type(name, "Unsaved local edit");
    await user.click(screen.getByRole("button", { name: "Save service basics" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your non-secret edits remain here",
    );
    expect(name).toHaveValue("Unsaved local edit");
    expect(screen.getByRole("button", { name: "Refresh current version" }))
      .toBeInTheDocument();
  });

  it("requires the exact archived slug and bound fresh credentials before deletion", async () => {
    const user = userEvent.setup();
    const archived = {
      ...SERVICE,
      lifecycle: "archived" as const,
      draft_matches_published: false,
      published_revision: undefined,
      admin_count: 0,
    };
    const api = fakeServiceApi(archived);
    render(<ServicesPage role="superadmin" api={api} />);
    expect(await screen.findByRole("heading", { name: "Managed API" })).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "Permanently delete managed-api" });
    expect(screen.getByRole("dialog", { name: "Permanently delete managed-api" }))
      .toContainElement(submit);
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText("Type managed-api to confirm"), "managed-api");
    await user.type(screen.getByLabelText("Deletion justification"), "Retired and unowned.");
    await user.type(screen.getByLabelText("Current password"), "current-password");
    await user.type(screen.getByLabelText("Current TOTP code"), "123456");
    expect(submit).toBeEnabled();
    await user.click(submit);
    await waitFor(() => expect(api.deleteService).toHaveBeenCalledWith(
      expect.objectContaining({ id: SERVICE.id, version: SERVICE.version }),
      "Retired and unowned.",
      "current-password",
      "123456",
    ));
  });
});

const REVISION = {
  id: "018f1f2e-7b3c-7a10-8000-000000000020",
  sequence: 1,
  digest: "a".repeat(64),
  publication_generation: 1,
  actor_role: "admin" as const,
  published_at: 1,
};

const DOCUMENT: ServiceDraftDocument = {
  format_version: 1,
  service: {
    slug: "managed-api",
    name: "Managed API",
    description: "Safe service profile",
  },
  destinations: [{
    id: "018f1f2e-7b3c-7a10-8000-000000000011",
    slug: "primary",
    base_url: "https://api.example.org/",
    schemes: ["https", "http"],
    hosts: [
      { type: "exact", value: "api.example.org" },
      { type: "suffix", value: ".example.org" },
    ],
    ports: [443, 80],
    tls_verify: false,
  }],
};

const SERVICE: ControlServiceDetail = {
  id: "018f1f2e-7b3c-7a10-8000-000000000010",
  slug: "managed-api",
  name: "Managed API",
  description: "Safe service profile",
  lifecycle: "published",
  draft_matches_published: false,
  publication_generation: 1,
  published_revision: {
    id: REVISION.id,
    sequence: 1,
    published_at: 1,
  },
  destination_count: 1,
  admin_count: 1,
  version: 4,
  created_at: 1,
  updated_at: 2,
  destinations: [{
    ...DOCUMENT.destinations[0]!,
    version: 1,
    created_at: 1,
    updated_at: 1,
  }],
};

function fakeServiceApi(initial: ControlServiceDetail = SERVICE) {
  let current = initial;
  const changed = () => ({ ...current, version: current.version + 1 });
  const api = {
    listServices: vi.fn(async () => ({ services: [current] })),
    service: vi.fn(async () => current),
    createService: vi.fn(async () => current),
    updateService: vi.fn(async (_service, input) => {
      current = { ...changed(), ...input };
      return current;
    }),
    createDestination: vi.fn(async () => changed()),
    updateDestination: vi.fn(async () => changed()),
    deleteDestination: vi.fn(async () => changed()),
    validateService: vi.fn(async () => ({
      valid: true,
      draft_digest: "b".repeat(64),
      issues: [],
      warnings: [{
        code: "tls_verification_disabled" as const,
        pointer: "/destinations/0/tls_verify",
      }],
    })),
    publishService: vi.fn(async () => {
      current = { ...changed(), draft_matches_published: true };
      return current;
    }),
    serviceRevisions: vi.fn(async () => ({ revisions: [REVISION] })),
    copyService: vi.fn(async () => DOCUMENT),
    importService: vi.fn(async () => changed()),
    cloneService: vi.fn(async () => ({ ...current, id: `${current.id.slice(0, -1)}9` })),
    serviceAdmins: vi.fn(async () => ({
      admins: initial.admin_count === 0 ? [] : [{
        id: "018f1f2e-7b3c-7a10-8000-000000000030",
        email: "admin@example.org",
        given_name: "Service",
        family_name: "Admin",
        status: "active",
        assigned_at: 1,
      }],
    })),
    assignServiceAdmin: vi.fn(async () => changed()),
    removeServiceAdmin: vi.fn(async () => changed()),
    rollbackService: vi.fn(async () => {
      current = { ...changed(), draft_matches_published: true };
      return current;
    }),
    archiveService: vi.fn(async () => {
      current = { ...changed(), lifecycle: "archived", published_revision: undefined };
      return current;
    }),
    deleteService: vi.fn(async () => ({ service_id: current.id, deleted: true as const })),
  } satisfies ServiceControlApi;
  return api as typeof api & {
    updateService: ReturnType<typeof vi.fn<ServiceControlApi["updateService"]>>;
    rollbackService: ReturnType<typeof vi.fn<ServiceControlApi["rollbackService"]>>;
    deleteService: ReturnType<typeof vi.fn<ServiceControlApi["deleteService"]>>;
  };
}
