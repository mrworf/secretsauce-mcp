import { isUuidV7 } from "./persistence/uuidV7.js";

export type PrincipalSelectorInput =
  | { kind: "all" }
  | { kind: "groups"; group_ids: unknown }
  | {
      kind: "users";
      user_ids: unknown;
      direct_assignment_confirmed: unknown;
    }
  | {
      kind: "principals";
      group_ids: unknown;
      user_ids: unknown;
      direct_assignment_confirmed: unknown;
    };

export type NormalizedPrincipalSelector =
  | { kind: "all"; groupIds: readonly []; userIds: readonly [] }
  | {
      kind: "explicit";
      groupIds: readonly string[];
      userIds: readonly string[];
    };

export type ServiceAccessContribution =
  | { kind: "all" }
  | { kind: "direct" }
  | { kind: "group"; groupId: string };

export class PrincipalSelectorError extends Error {
  constructor() {
    super("Principal selector input is invalid.");
    this.name = "PrincipalSelectorError";
  }
}

export function normalizePrincipalSelector(
  input: unknown,
  options: { omittedMeansAll?: boolean } = {},
): NormalizedPrincipalSelector {
  if (input === undefined) {
    if (options.omittedMeansAll === true) return allSelector();
    throw new PrincipalSelectorError();
  }
  if (!isPlainObject(input) || typeof input.kind !== "string") {
    throw new PrincipalSelectorError();
  }
  if (input.kind === "all") {
    requireKeys(input, ["kind"]);
    return allSelector();
  }
  if (input.kind === "groups") {
    requireKeys(input, ["kind", "group_ids"]);
    return explicitSelector(uuidArray(input.group_ids, false), []);
  }
  if (input.kind === "users") {
    requireKeys(input, ["kind", "user_ids", "direct_assignment_confirmed"]);
    const users = uuidArray(input.user_ids, false);
    requireDirectConfirmation(input.direct_assignment_confirmed, users);
    return explicitSelector([], users);
  }
  if (input.kind === "principals") {
    requireKeys(input, [
      "kind",
      "group_ids",
      "user_ids",
      "direct_assignment_confirmed",
    ]);
    const groups = uuidArray(input.group_ids, true);
    const users = uuidArray(input.user_ids, true);
    if (groups.length === 0 && users.length === 0) {
      throw new PrincipalSelectorError();
    }
    requireDirectConfirmation(input.direct_assignment_confirmed, users);
    return explicitSelector(groups, users);
  }
  throw new PrincipalSelectorError();
}

export function selectorContributions(input: {
  selector: NormalizedPrincipalSelector;
  userId: string;
  role: string;
  status: string;
  activeGroupIds: readonly string[];
}): ServiceAccessContribution[] {
  if (
    !isUuidV7(input.userId) ||
    input.role !== "user" ||
    input.status !== "active"
  ) return [];
  if (input.selector.kind === "all") return [{ kind: "all" }];
  const contributions: ServiceAccessContribution[] = [];
  if (input.selector.userIds.includes(input.userId)) {
    contributions.push({ kind: "direct" });
  }
  const activeMembership = new Set(input.activeGroupIds);
  for (const groupId of input.selector.groupIds) {
    if (activeMembership.has(groupId)) {
      contributions.push({ kind: "group", groupId });
    }
  }
  return contributions;
}

function allSelector(): NormalizedPrincipalSelector {
  return { kind: "all", groupIds: [], userIds: [] };
}

function explicitSelector(
  groupIds: readonly string[],
  userIds: readonly string[],
): NormalizedPrincipalSelector {
  if (groupIds.length === 0 && userIds.length === 0) {
    throw new PrincipalSelectorError();
  }
  return { kind: "explicit", groupIds, userIds };
}

function uuidArray(value: unknown, allowEmpty: boolean): string[] {
  if (!Array.isArray(value) || value.length > 1_000) {
    throw new PrincipalSelectorError();
  }
  if (!allowEmpty && value.length === 0) throw new PrincipalSelectorError();
  const ids = value.map((item) => {
    if (typeof item !== "string" || !isUuidV7(item)) {
      throw new PrincipalSelectorError();
    }
    return item;
  });
  if (new Set(ids).size !== ids.length) throw new PrincipalSelectorError();
  return ids.sort();
}

function requireDirectConfirmation(value: unknown, userIds: readonly string[]): void {
  if (userIds.length > 0 && value !== true) throw new PrincipalSelectorError();
  if (userIds.length === 0 && value !== false) throw new PrincipalSelectorError();
}

function requireKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): void {
  const keys = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    keys.length !== wanted.length ||
    keys.some((key, index) => key !== wanted[index])
  ) throw new PrincipalSelectorError();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
