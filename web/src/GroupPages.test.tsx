// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://control.example.org/control/groups"}
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ControlService,
  ControlUser,
  GroupControlApi,
  ServiceAssignments,
  ServiceGroup,
} from "./controlApi";
import { GroupsPage } from "./GroupPages";

afterEach(cleanup);

describe("group and assignment workspace", () => {
  it("keeps the all-user scope conspicuous and explains effective access", async () => {
    const api = fakeApi({ kind: "all", group_ids: [], user_ids: [] });
    render(<GroupsPage api={api} />);

    expect(await screen.findByRole("heading", { name: "Service groups" })).toBeInTheDocument();
    expect(screen.getByLabelText("Allow every active ordinary user")).toBeChecked();
    expect(screen.getByText(/intentionally broad/i)).toBeInTheDocument();
    expect(screen.getByText("Included through all users")).toBeInTheDocument();
  });

  it("requires explicit confirmation before saving a direct-user exception", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    const store = vi.fn();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: { setItem: store },
    });
    render(<GroupsPage api={api} />);

    const direct = await screen.findByRole("group", { name: "Direct-user exceptions" });
    await user.click(within(direct).getByLabelText(/Target User/));
    const submit = screen.getByRole("button", { name: "Replace service assignments" });
    expect(submit).toBeDisabled();
    await user.click(within(direct).getByLabelText(/I confirm/));
    expect(submit).toBeEnabled();
    await user.click(submit);

    await waitFor(() => expect(api.replaceServiceAssignments).toHaveBeenCalledWith(
      expect.objectContaining({ service_id: SERVICE.id, version: 1 }),
      {
        kind: "principals",
        group_ids: [],
        user_ids: [TARGET.id],
        direct_assignment_confirmed: true,
      },
    ));
    expect(store).not.toHaveBeenCalled();
    expect(window.location.href).not.toContain(TARGET.id);
  });

  it("replaces group membership and binds archive justification to the selected group", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    render(<GroupsPage api={api} />);

    const members = await screen.findByRole("group", { name: "Members" });
    await user.click(within(members).getByLabelText(/Target User/));
    await user.click(within(members).getByRole("button", { name: "Replace membership" }));
    await waitFor(() => expect(api.replaceGroupMembers).toHaveBeenCalledWith(
      expect.objectContaining({ id: GROUP.id, version: 1 }),
      [TARGET.id],
    ));

    const archive = screen.getByRole("button", { name: "Archive Operators" });
    expect(archive).toBeDisabled();
    await user.type(screen.getByLabelText("Change justification"), "Team retired.");
    await user.click(archive);
    await waitFor(() => expect(api.archiveGroup).toHaveBeenCalledWith(
      expect.objectContaining({ id: GROUP.id }),
      "Team retired.",
    ));
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

const GROUP: ServiceGroup = {
  id: "018f1f2e-7b3c-7a10-8000-000000000002",
  service_id: SERVICE.id,
  name: "Operators",
  lifecycle: "active",
  member_count: 0,
  version: 1,
  created_at: 1,
  updated_at: 1,
};

const TARGET: ControlUser = {
  id: "018f1f2e-7b3c-7a10-8000-000000000003",
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

function fakeApi(selector?: ServiceAssignments["selector"]): GroupControlApi & {
  replaceServiceAssignments: ReturnType<typeof vi.fn<GroupControlApi["replaceServiceAssignments"]>>;
  replaceGroupMembers: ReturnType<typeof vi.fn<GroupControlApi["replaceGroupMembers"]>>;
  archiveGroup: ReturnType<typeof vi.fn<GroupControlApi["archiveGroup"]>>;
} {
  const assignments: ServiceAssignments = {
    service_id: SERVICE.id,
    ...(selector === undefined ? {} : { selector }),
    version: 1,
    authorization_generation: 0,
  };
  return {
    listServices: async () => ({ services: [SERVICE] }),
    listUsers: async () => ({ users: [TARGET] }),
    listGroups: async () => ({ groups: [GROUP] }),
    createGroup: async (_serviceId, input) => ({ ...GROUP, ...input }),
    updateGroup: async (group, input) => ({ ...group, ...input, version: group.version + 1 }),
    groupMembers: async () => ({ members: [] }),
    replaceGroupMembers: vi.fn(async (group, _userIds) =>
      ({ ...group, member_count: 1, version: 2 })),
    archiveGroup: vi.fn(async (group, _justification) =>
      ({ ...group, lifecycle: "archived", version: 2 })),
    deleteGroup: async (group) => ({ group_id: group.id, deleted: true, replayed: false }),
    serviceAssignments: async () => assignments,
    replaceServiceAssignments: vi.fn(async (_current, input) => ({
      ...assignments,
      selector: input.kind === "all"
        ? { kind: "all", group_ids: [], user_ids: [] }
        : {
            kind: "explicit",
            group_ids: input.group_ids,
            user_ids: input.user_ids,
          },
      version: 2,
    })),
    serviceAccess: async () => ({
      access: [{
        service_id: SERVICE.id,
        user_id: TARGET.id,
        email: TARGET.email,
        given_name: TARGET.given_name,
        family_name: TARGET.family_name,
        contributions: selector?.kind === "all"
          ? [{ kind: "all" as const }]
          : [{ kind: "group" as const, group_id: GROUP.id, group_name: GROUP.name }],
      }],
    }),
    ownServices: async () => ({ services: [] }),
  };
}
