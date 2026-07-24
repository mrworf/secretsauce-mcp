// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://control.example.org/control/policies"}
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ControlCredential,
  ControlPolicyDetail,
  ControlServiceDetail,
  ControlUser,
  PolicyControlApi,
  PolicyCopyDocument,
  ServiceGroup,
} from "./controlApi";
import { PoliciesPage } from "./PolicyPages";

afterEach(cleanup);

describe("policy workspace", () => {
  it("keeps default deny visible and requires confirmation for direct-user rules", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    render(<PoliciesPage api={api} />);

    expect(await screen.findByText(/No matching rule defaults to/)).toHaveTextContent("deny");
    await user.click(screen.getByRole("button", { name: "New rule" }));
    const assignment = screen.getByRole("group", { name: "Principal assignment" });
    await user.type(
      within(assignment.closest("form")!).getByLabelText("Name"),
      "Allow health",
    );
    await user.click(within(assignment).getByLabelText(
      "Every user already authorized for this service",
    ));
    await user.click(within(assignment).getByLabelText(
      `Direct exception: ${TARGET.email}`,
    ));
    const submit = screen.getByRole("button", { name: "Create enabled rule" });
    expect(submit).toBeDisabled();
    await user.click(within(assignment).getByLabelText(/groups are preferred/));
    expect(submit).toBeEnabled();
    await user.click(submit);

    await waitFor(() => expect(api.createPolicyRule).toHaveBeenCalledWith(
      expect.objectContaining({ id: POLICY.id }),
      expect.objectContaining({
        name: "Allow health",
        selector: {
          kind: "principals",
          group_ids: [],
          user_ids: [TARGET.id],
          direct_assignment_confirmed: true,
        },
      }),
    ));
  });

  it("shows deny-tie explanations and previews only the closed safe document", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    render(<PoliciesPage api={api} />);

    await screen.findByRole("heading", { name: "Explain a request" });
    await user.click(screen.getByRole("button", { name: "Explain outcome" }));
    expect(await screen.findByText("Final outcome: DENY")).toBeInTheDocument();
    expect(screen.getByText(/deny wins equal priority/)).toBeInTheDocument();
    expect(api.simulatePolicy).toHaveBeenCalledWith(SERVICE.id, {
      user_id: TARGET.id,
      destination_id: DESTINATION.id,
      method: "GET",
      path: "/",
      credential_ids: [],
    });

    await user.click(screen.getByRole("button", { name: "Preview safe copy" }));
    const preview = await screen.findByLabelText("Safe policy copy preview");
    expect(preview).toHaveValue(JSON.stringify(COPY, null, 2));
    expect(preview).not.toHaveValue(expect.stringContaining("credential_value"));
    expect(preview).not.toHaveValue(expect.stringContaining("Authorization"));
  });
});

const SERVICE: ControlServiceDetail = {
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
  destinations: [{
    id: "018f1f2e-7b3c-7a10-8000-000000000006",
    slug: "primary",
    base_url: "https://api.example.org",
    schemes: ["https"],
    hosts: [{ type: "exact", value: "api.example.org" }],
    ports: [443],
    tls_verify: true,
    version: 1,
    created_at: 1,
    updated_at: 1,
  }],
};
const DESTINATION = SERVICE.destinations[0]!;
const TARGET: ControlUser = {
  id: "018f1f2e-7b3c-7a10-8000-000000000002",
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
const CREDENTIAL: ControlCredential = {
  id: "018f1f2e-7b3c-7a10-8000-000000000004",
  service_id: SERVICE.id,
  name: "API token",
  placement: {
    kind: "header",
    name: "X-Managed-Token",
    enforce_header_ownership: true,
  },
  selector: { kind: "all", group_ids: [], user_ids: [] },
  status: "configured",
  authorization_generation: 0,
  version: 1,
  created_at: 1,
  updated_at: 1,
};
const POLICY: ControlPolicyDetail = {
  id: "018f1f2e-7b3c-7a10-8000-000000000005",
  service_id: SERVICE.id,
  boundary: { kind: "service" },
  name: "Service access",
  operating_mode: "deny",
  lifecycle: "active",
  evaluation_generation: 1,
  rule_count: 0,
  rules: [],
  version: 1,
  created_at: 1,
  updated_at: 1,
};
const COPY: PolicyCopyDocument = {
  format_version: 1,
  policy: {
    name: POLICY.name,
    operating_mode: "deny",
    rules: [],
  },
};

function fakeApi(): PolicyControlApi & {
  createPolicyRule: ReturnType<typeof vi.fn<PolicyControlApi["createPolicyRule"]>>;
  simulatePolicy: ReturnType<typeof vi.fn<PolicyControlApi["simulatePolicy"]>>;
} {
  return {
    listServices: async () => ({ services: [SERVICE] }),
    service: async () => SERVICE,
    listUsers: async () => ({ users: [TARGET] }),
    listGroups: async () => ({ groups: [GROUP] }),
    listCredentials: async () => ({ credentials: [CREDENTIAL] }),
    listPolicies: async () => ({ policies: [POLICY] }),
    policy: async () => POLICY,
    createPolicy: async () => POLICY,
    updatePolicy: async () => POLICY,
    createPolicyRule: vi.fn<PolicyControlApi["createPolicyRule"]>(async (_policy, input) => ({
      ...input,
      id: "018f1f2e-7b3c-7a10-8000-000000000007",
      service_id: SERVICE.id,
      policy_id: POLICY.id,
      selector: input.selector?.kind === "all"
        ? { kind: "all", group_ids: [], user_ids: [] }
        : {
            kind: "explicit",
            group_ids: input.selector?.kind === "groups" ||
                input.selector?.kind === "principals"
              ? input.selector.group_ids
              : [],
            user_ids: input.selector?.kind === "users" ||
                input.selector?.kind === "principals"
              ? input.selector.user_ids
              : [],
          },
      version: 1,
      created_at: 1,
      updated_at: 1,
    })),
    updatePolicyRule: async (rule) => rule,
    replacePolicyRuleAssignments: async (rule) => rule,
    archivePolicy: async () => ({ ...POLICY, lifecycle: "archived" }),
    deletePolicy: async () => ({ policy_id: POLICY.id, deleted: true }),
    deletePolicyRule: async (rule) => ({ rule_id: rule.id, deleted: true }),
    copyPolicy: async () => COPY,
    clonePolicy: async () => POLICY,
    importPolicy: async () => POLICY,
    simulatePolicy: vi.fn<PolicyControlApi["simulatePolicy"]>(async (
      _serviceId,
      _input,
    ) => ({
      allowed: false,
      subject_id: TARGET.id,
      group_ids: [GROUP.id],
      canonical_target: {
        method: "GET",
        host: "api.example.org",
        pathname: "/",
      },
      boundaries: [{
        boundary_id: POLICY.id,
        kind: "service",
        assignment_allowed: true,
        allowed: false,
        mode: "deny",
        selected_priority: 10,
        selected_rule_ids: [],
        reason_code: "deny_tie",
        rules: [],
      }],
      reason_code: "boundary_denied",
      links: [{
        kind: "policy",
        id: POLICY.id,
        href: `/policies/${POLICY.id}`,
      }],
    })),
  };
}
