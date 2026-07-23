import { describe, expect, it } from "vitest";
import {
  normalizePrincipalSelector,
  PrincipalSelectorError,
  selectorContributions,
} from "../src/principalSelectors.js";

const USER = "018f1f2e-7b3c-7a10-8000-000000000001";
const OTHER = "018f1f2e-7b3c-7a10-8000-000000000002";
const GROUP_A = "018f1f2e-7b3c-7a10-8000-000000000003";
const GROUP_B = "018f1f2e-7b3c-7a10-8000-000000000004";

describe("principal selectors", () => {
  it("normalizes explicit all, group, user, and mixed selectors", () => {
    expect(normalizePrincipalSelector({ kind: "all" })).toEqual({
      kind: "all",
      groupIds: [],
      userIds: [],
    });
    expect(normalizePrincipalSelector({
      kind: "groups",
      group_ids: [GROUP_B, GROUP_A],
    })).toEqual({
      kind: "explicit",
      groupIds: [GROUP_A, GROUP_B],
      userIds: [],
    });
    expect(normalizePrincipalSelector({
      kind: "users",
      user_ids: [OTHER, USER],
      direct_assignment_confirmed: true,
    })).toEqual({
      kind: "explicit",
      groupIds: [],
      userIds: [USER, OTHER],
    });
    expect(normalizePrincipalSelector({
      kind: "principals",
      group_ids: [GROUP_A],
      user_ids: [USER],
      direct_assignment_confirmed: true,
    })).toEqual({
      kind: "explicit",
      groupIds: [GROUP_A],
      userIds: [USER],
    });
    expect(normalizePrincipalSelector(undefined, { omittedMeansAll: true }))
      .toEqual({ kind: "all", groupIds: [], userIds: [] });
  });

  it("rejects omitted, empty, duplicate, malformed, unconfirmed, and open inputs", () => {
    for (const input of [
      undefined,
      null,
      {},
      { kind: "all", user_ids: [] },
      { kind: "groups", group_ids: [] },
      { kind: "groups", group_ids: [GROUP_A, GROUP_A] },
      { kind: "groups", group_ids: ["not-a-uuid"] },
      { kind: "users", user_ids: [USER], direct_assignment_confirmed: false },
      { kind: "users", user_ids: [], direct_assignment_confirmed: true },
      {
        kind: "principals",
        group_ids: [],
        user_ids: [],
        direct_assignment_confirmed: false,
      },
      {
        kind: "principals",
        group_ids: [GROUP_A],
        user_ids: [],
        direct_assignment_confirmed: true,
      },
    ]) {
      expect(() => normalizePrincipalSelector(input)).toThrow(PrincipalSelectorError);
    }
  });

  it("explains all, direct, and every matching group only for active ordinary users", () => {
    expect(selectorContributions({
      selector: { kind: "all", groupIds: [], userIds: [] },
      userId: USER,
      role: "user",
      status: "active",
      activeGroupIds: [],
    })).toEqual([{ kind: "all" }]);
    expect(selectorContributions({
      selector: {
        kind: "explicit",
        groupIds: [GROUP_A, GROUP_B],
        userIds: [USER],
      },
      userId: USER,
      role: "user",
      status: "active",
      activeGroupIds: [GROUP_B, GROUP_A],
    })).toEqual([
      { kind: "direct" },
      { kind: "group", groupId: GROUP_A },
      { kind: "group", groupId: GROUP_B },
    ]);
    for (const [role, status] of [
      ["admin", "active"],
      ["superadmin", "active"],
      ["user", "suspended"],
      ["user", "deactivated"],
      ["user", "invited"],
    ]) {
      expect(selectorContributions({
        selector: { kind: "all", groupIds: [], userIds: [] },
        userId: USER,
        role,
        status,
        activeGroupIds: [],
      })).toEqual([]);
    }
  });
});
