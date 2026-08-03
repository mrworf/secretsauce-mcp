// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://control.example.org/control/services"}
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ControlServiceDetail,
  ControlUser,
  ServiceControlApi,
  ServiceDraftDocument,
} from "./controlApi";
import { ControlApiError } from "./controlApi";
import { ServicesPage } from "./ServicePages";

afterEach(cleanup);

describe("service management workspace", () => {
  it("creates and clones from names while preserving hidden identifiers across retries", async () => {
    const user = userEvent.setup();
    const api = fakeServiceApi();
    api.createService
      .mockRejectedValueOnce(new ControlApiError("maintenance", "Try again."))
      .mockResolvedValueOnce(SERVICE);
    const view = render(<ServicesPage role="superadmin" api={api} />);
    expect(await screen.findByRole("heading", { name: "Managed API" })).toBeInTheDocument();
    expect(view.container.textContent).not.toMatch(/\bslug\b/i);

    await user.click(screen.getByRole("button", { name: "New service" }));
    expect(screen.queryByLabelText(/slug/i)).not.toBeInTheDocument();
    const createForm = screen.getByRole("heading", { name: "Create a non-routable draft" })
      .closest("form");
    if (!(createForm instanceof HTMLFormElement)) throw new Error("Service form is missing.");
    const create = within(createForm);
    await user.type(create.getByLabelText("Service name"), "Portainer");
    await user.click(create.getByRole("button", { name: "Create service draft" }));
    expect(await screen.findByText("Try again.")).toBeInTheDocument();
    const firstIdentifier = api.createService.mock.calls[0]![0].slug;
    expect(firstIdentifier).toMatch(/^portainer-[a-f0-9]{8}$/);
    await user.click(create.getByRole("button", { name: "Create service draft" }));
    await waitFor(() => expect(api.createService).toHaveBeenCalledTimes(2));
    expect(api.createService.mock.calls[1]![0].slug).toBe(firstIdentifier);

    await user.type(screen.getByLabelText("New service name"), "Portainer Copy");
    await user.click(screen.getByRole("button", { name: "Create secret-free clone" }));
    await waitFor(() => expect(api.cloneService).toHaveBeenCalledWith(
      SERVICE.id,
      expect.objectContaining({
        name: "Portainer Copy",
        slug: expect.stringMatching(/^portainer-copy-[a-f0-9]{8}$/),
      }),
    ));
  });

  it("derives safe routing limits from the Base URL and validates advanced overrides", async () => {
    const user = userEvent.setup();
    const api = fakeServiceApi();
    render(<ServicesPage role="superadmin" api={api} />);
    expect(await screen.findByRole("heading", { name: "Managed API" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add destination" }));
    const form = screen.getByRole("heading", { name: "New destination" }).closest("form");
    if (!(form instanceof HTMLFormElement)) throw new Error("Destination form is missing.");
    const destination = within(form);
    const baseUrl = destination.getByLabelText("Base URL");

    await user.clear(baseUrl);
    await user.type(baseUrl, "https://api.example.org/?debug=true");
    await user.click(destination.getByRole("button", { name: "Create destination" }));
    expect(await destination.findByText(/without credentials, a query, or a fragment/i))
      .toBeInTheDocument();
    expect(api.createDestination).not.toHaveBeenCalled();

    await user.clear(baseUrl);
    await user.type(baseUrl, "https://api.example.org/v1/");
    expect(destination.getByText("Requests are limited to HTTPS on api.example.org:443."))
      .toBeInTheDocument();
    await user.click(destination.getByText("Advanced routing limits"));
    expect(destination.getByLabelText("Rule 1 value")).toHaveValue("api.example.org");
    expect(destination.getByLabelText("Port 1")).toHaveValue(443);

    await user.clear(destination.getByLabelText("Rule 1 value"));
    await user.type(destination.getByLabelText("Rule 1 value"), "blocked.example.org");
    await user.click(destination.getByRole("button", { name: "Create destination" }));
    expect(await destination.findByText(/must allow the Base URL hostname/i)).toBeInTheDocument();
    expect(api.createDestination).not.toHaveBeenCalled();

    await user.click(destination.getByRole("button", { name: "Reset limits from Base URL" }));
    await user.clear(destination.getByLabelText("Port 1"));
    await user.type(destination.getByLabelText("Port 1"), "444");
    await user.click(destination.getByRole("button", { name: "Create destination" }));
    expect(await destination.findByText(/must be unique, valid, and include the Base URL port/i))
      .toBeInTheDocument();
    expect(api.createDestination).not.toHaveBeenCalled();

    await user.click(destination.getByRole("button", { name: "Reset limits from Base URL" }));
    await user.click(destination.getByRole("button", { name: "Create destination" }));
    await waitFor(() => expect(api.createDestination).toHaveBeenCalledWith(
      expect.objectContaining({ id: SERVICE.id }),
      expect.objectContaining({
        slug: expect.stringMatching(/^api-example-org-[a-f0-9]{8}$/),
        base_url: "https://api.example.org/v1/",
        schemes: ["https"],
        hosts: [{ type: "exact", value: "api.example.org" }],
        ports: [443],
        tls_verify: true,
      }),
    ));
  });

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
    expect(screen.getByText("Requests are limited to HTTPS or HTTP on 2 hostname rules:443, 80."))
      .toBeInTheDocument();
    expect(screen.getByText("Advanced routing limits").closest("details")).toHaveAttribute("open");
    expect(screen.getByLabelText("HTTPS")).toBeChecked();
    expect(screen.getByLabelText("HTTP")).toBeChecked();
    const tls = screen.getByRole("checkbox", { name: /Verify TLS certificates/i });
    expect(tls).not.toBeChecked();
    expect(tls.closest("label")).toHaveClass("tls-control");
    await user.click(screen.getByRole("button", { name: "Save destination" }));
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

  it("assigns the current superadmin through an eligible-account picker", async () => {
    const user = userEvent.setup();
    const api = fakeServiceApi({ ...SERVICE, admin_count: 0 });
    api.serviceAdmins.mockResolvedValue({ admins: [] });
    render(<ServicesPage role="superadmin" api={api} />);
    expect(await screen.findByRole("heading", { name: "Managed API" })).toBeInTheDocument();
    const picker = await screen.findByLabelText("Eligible administrator");
    expect(picker).toHaveValue(CURRENT_SUPERADMIN.id);
    expect(screen.getByRole("option", { name: /You — Super Admin.*Superadmin/i }))
      .toBeInTheDocument();
    expect(screen.queryByLabelText(/user ID/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Assign administrator" }));
    await waitFor(() => expect(api.assignServiceAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ id: SERVICE.id }),
      CURRENT_SUPERADMIN.id,
    ));
  });

  it("filters assigned candidates and reports a bounded eligibility race", async () => {
    const user = userEvent.setup();
    const api = fakeServiceApi();
    api.assignServiceAdmin.mockRejectedValueOnce(
      new ControlApiError("not_found", "The resource was not found."),
    );
    render(<ServicesPage role="superadmin" api={api} />);
    expect(await screen.findByLabelText("Eligible administrator")).toHaveValue(
      CURRENT_SUPERADMIN.id,
    );
    expect(screen.queryByRole("option", { name: /Service Admin/ })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Find an administrator"), "super@example.org");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(api.listUsers).toHaveBeenCalledWith({
      role: "superadmin",
      status: "active",
      q: "super@example.org",
    }));
    await user.click(screen.getByRole("button", { name: "Assign administrator" }));
    expect(await screen.findByText(
      "That account is no longer eligible. Refresh the list and try again.",
    )).toBeInTheDocument();
    expect(screen.queryByText("The resource was not found.")).not.toBeInTheDocument();
  });

  it("explains when every eligible administrator is already assigned", async () => {
    const api = fakeServiceApi();
    api.serviceAdmins.mockResolvedValue({
      admins: [{
        id: CURRENT_SUPERADMIN.id,
        email: CURRENT_SUPERADMIN.email,
        given_name: CURRENT_SUPERADMIN.given_name,
        family_name: CURRENT_SUPERADMIN.family_name,
        status: "active",
        assigned_at: 1,
      }],
    });
    api.listUsers.mockImplementation(async ({ role } = {}) => ({
      users: role === "superadmin" ? [CURRENT_SUPERADMIN] : [],
    }));
    render(<ServicesPage role="superadmin" api={api} />);
    expect(await screen.findByText(
      "No eligible active administrators are available. Invite or reactivate one in Users.",
    )).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assign administrator" })).toBeDisabled();
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

    expect(await screen.findByText(/Your non-secret edits remain here/)).toBeInTheDocument();
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent(
      "Your non-secret edits remain here",
    );
    expect(name).toHaveValue("Unsaved local edit");
    expect(screen.getByRole("button", { name: "Refresh current version" }))
      .toBeInTheDocument();
  });

  it("requires the exact archived identifier and bound fresh credentials before deletion", async () => {
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
    const submit = screen.getByRole("button", { name: "Permanently delete Managed API" });
    expect(screen.getByRole("dialog", { name: "Permanently delete Managed API" }))
      .toContainElement(submit);
    expect(submit).toBeDisabled();
    await user.type(
      screen.getByLabelText("Type service identifier managed-api to confirm"),
      "managed-api",
    );
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

const CURRENT_SUPERADMIN: ControlUser = {
  id: "018f1f2e-7b3c-7a10-8000-000000000001",
  email: "super@example.org",
  given_name: "Super",
  family_name: "Admin",
  role: "superadmin",
  status: "active",
  password_state: "configured",
  totp_state: "configured",
  version: 1,
  created_at: 1,
  updated_at: 1,
};

const ASSIGNED_ADMIN: ControlUser = {
  ...CURRENT_SUPERADMIN,
  id: "018f1f2e-7b3c-7a10-8000-000000000030",
  email: "admin@example.org",
  given_name: "Service",
  role: "admin",
};

function fakeServiceApi(initial: ControlServiceDetail = SERVICE) {
  let current = initial;
  const changed = () => ({ ...current, version: current.version + 1 });
  const api = {
    self: vi.fn(async () => CURRENT_SUPERADMIN),
    listUsers: vi.fn(async ({ role } = {}) => ({
      users: role === "admin" ? [ASSIGNED_ADMIN] : [CURRENT_SUPERADMIN],
    })),
    listServices: vi.fn(async () => ({ services: [current] })),
    service: vi.fn(async () => current),
    createService: vi.fn<ServiceControlApi["createService"]>(async () => current),
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
