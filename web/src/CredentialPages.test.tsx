// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://control.example.org/control/credentials"}
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ControlCredential,
  ControlService,
  ControlUser,
  CredentialControlApi,
  ServiceGroup,
} from "./controlApi";
import {
  CredentialsPage,
  SELF_API_KEY_RISK_ACKNOWLEDGEMENT,
} from "./CredentialPages";

afterEach(cleanup);

describe("credential workspace", () => {
  it("keeps value entry write-only, clears it after submission, and shows remediation", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    render(<CredentialsPage api={api} />);

    expect(await screen.findByText(/Remediation required/)).toBeInTheDocument();
    const input = screen.getByLabelText("New value");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("autocomplete", "new-password");
    await user.type(input, "never-retain-this-value");
    await user.click(screen.getByRole("button", { name: "Write value" }));
    await waitFor(() => expect(api.replaceCredentialValue).toHaveBeenCalledWith(
      expect.objectContaining({ id: CREDENTIAL.id }),
      "never-retain-this-value",
      false,
    ));
    expect(input).toHaveValue("");
    expect(window.location.href).not.toContain("never-retain");
  });

  it("puts groups first and requires confirmation for direct-user exceptions", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    render(<CredentialsPage api={api} />);

    const boundary = await screen.findByRole("group", {
      name: "Additional credential boundary",
    });
    await user.click(within(boundary).getByLabelText(
      "Every user already authorized for this service",
    ));
    await user.click(within(boundary).getByLabelText(`Group: ${GROUP.name}`));
    await user.click(within(boundary).getByLabelText(
      `Direct exception: ${TARGET.email}`,
    ));
    const submit = screen.getByRole("button", {
      name: "Replace credential assignments",
    });
    expect(submit).toBeDisabled();
    await user.click(within(boundary).getByLabelText(/I understand groups are preferred/));
    expect(submit).toBeEnabled();
    await user.click(submit);
    await waitFor(() => expect(api.replaceCredentialAssignments).toHaveBeenCalledWith(
      expect.objectContaining({ id: CREDENTIAL.id }),
      {
        kind: "principals",
        group_ids: [GROUP.id],
        user_ids: [TARGET.id],
        direct_assignment_confirmed: true,
      },
    ));
  });

  it("limits recursive key approval to superadmins and clears every submitted secret", async () => {
    const adminApi = fakeApi();
    const admin = render(<CredentialsPage api={adminApi} role="admin" />);
    await screen.findByText(/Remediation required/);
    expect(screen.queryByRole("heading", {
      name: "Recursive management authority",
    })).not.toBeInTheDocument();
    admin.unmount();

    const user = userEvent.setup();
    const api = fakeApi();
    render(<CredentialsPage api={api} role="superadmin" />);
    expect(await screen.findByRole("heading", {
      name: "Recursive management authority",
    })).toBeInTheDocument();

    const raw = "ssk_v1_AQEBAQEBAQEBAQEB_AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI";
    await user.type(screen.getByLabelText("Active SecretSauce API key"), raw);
    await user.type(
      screen.getByLabelText("Justification"),
      "Required recursive integration.",
    );
    await user.type(
      screen.getByLabelText(/Type the exact risk acknowledgement/),
      SELF_API_KEY_RISK_ACKNOWLEDGEMENT,
    );
    await user.type(screen.getByLabelText("Current password"), "fresh-password");
    await user.type(screen.getByLabelText("Current TOTP code"), "123456");
    await user.click(screen.getByRole("button", {
      name: "Approve recursive authority",
    }));

    await waitFor(() => expect(api.approveSelfApiKey).toHaveBeenCalledWith(
      expect.objectContaining({ id: CREDENTIAL.id }),
      {
        value: raw,
        capture_last_four: false,
        justification: "Required recursive integration.",
        risk_acknowledgement: SELF_API_KEY_RISK_ACKNOWLEDGEMENT,
        password: "fresh-password",
        totp: "123456",
      },
    ));
    expect(screen.getByLabelText("Active SecretSauce API key")).toHaveValue("");
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.getByLabelText("Current TOTP code")).toHaveValue("");
    expect(await screen.findByText("Approved management key")).toBeInTheDocument();
    expect(screen.getAllByText("CAgI")).toHaveLength(2);
    expect(document.body.textContent).not.toContain(raw);
    expect(window.location.href).not.toContain("ssk_v1");
  });
});

const SERVICE: ControlService = {
  id: "018f1f2e-7b3c-7a10-8000-000000000001",
  slug: "managed-api",
  name: "Managed API",
  lifecycle: "published",
  draft_matches_published: true,
  publication_generation: 1,
  destination_count: 1,
  admin_count: 1,
  version: 1,
  created_at: 1,
  updated_at: 1,
};

const CREDENTIAL: ControlCredential = {
  id: "018f1f2e-7b3c-7a10-8000-000000000002",
  service_id: SERVICE.id,
  name: "API token",
  placement: {
    kind: "header",
    name: "Authorization",
    prefix: "Bearer ",
    enforce_header_ownership: true,
  },
  selector: { kind: "all", group_ids: [], user_ids: [] },
  status: "unconfigured",
  authorization_generation: 0,
  version: 1,
  created_at: 1,
  updated_at: 1,
};

const GROUP: ServiceGroup = {
  id: "018f1f2e-7b3c-7a10-8000-000000000003",
  service_id: SERVICE.id,
  name: "Operators",
  lifecycle: "active",
  member_count: 1,
  version: 1,
  created_at: 1,
  updated_at: 1,
};

const TARGET: ControlUser = {
  id: "018f1f2e-7b3c-7a10-8000-000000000004",
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

function fakeApi(): CredentialControlApi & {
  replaceCredentialValue: ReturnType<typeof vi.fn<CredentialControlApi["replaceCredentialValue"]>>;
  replaceCredentialAssignments:
    ReturnType<typeof vi.fn<CredentialControlApi["replaceCredentialAssignments"]>>;
  approveSelfApiKey:
    ReturnType<typeof vi.fn<CredentialControlApi["approveSelfApiKey"]>>;
} {
  return {
    listServices: async () => ({ services: [SERVICE] }),
    listUsers: async () => ({ users: [TARGET] }),
    listGroups: async () => ({ groups: [GROUP] }),
    listCredentials: async () => ({ credentials: [CREDENTIAL] }),
    createCredential: async (_serviceId, input) => ({
      ...CREDENTIAL,
      ...input,
      placement: {
        ...input.placement,
        enforce_header_ownership:
          input.placement.enforce_header_ownership ?? false,
      },
      selector: input.selector.kind === "all"
        ? { kind: "all", group_ids: [], user_ids: [] }
        : {
            kind: "explicit",
            group_ids: input.selector.group_ids,
            user_ids: input.selector.user_ids,
          },
    }),
    replaceCredentialValue: vi.fn(async (credential, _value, _capture) => ({
      ...credential,
      status: "configured",
      version: 2,
    })),
    approveSelfApiKey: vi.fn(async (credential, _input) => ({
      credential: {
        ...credential,
        status: "configured",
        last_four: "CAgI",
        version: credential.version + 1,
      },
      approval: {
        api_key_id: "018f1f2e-7b3c-7a10-8000-000000000099",
        nickname: "Approved management key",
        last_four: "CAgI",
        vault_generation: 1,
        approved_at: 1_800_000_000_000,
      },
    })),
    deleteCredentialValue: async (credential) => ({
      ...credential,
      status: "unconfigured",
      version: credential.version + 1,
    }),
    replaceCredentialAssignments: vi.fn(async (credential, input) => ({
      ...credential,
      selector: input.kind === "all"
        ? { kind: "all", group_ids: [], user_ids: [] }
        : {
            kind: "explicit",
            group_ids: input.group_ids,
            user_ids: input.user_ids,
          },
      version: credential.version + 1,
    })),
    credentialAction: async (credential, action) => ({
      ...credential,
      status: action === "disable"
        ? "disabled"
        : action === "enable"
          ? "configured"
          : "archived",
      version: credential.version + 1,
    }),
  };
}
