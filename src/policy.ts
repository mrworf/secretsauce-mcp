import type { PolicyRuleConfig, ServiceConfig } from "./types.js";
import type { ResolvedTarget } from "./urlValidation.js";
import { normalizeHost } from "./urlValidation.js";
import {
  matchesPolicyHost,
  matchesPolicyPath,
  type PolicyHostMatcher,
  type PolicyPathMatcher,
} from "./policyMatchers.js";

export interface PolicyDecision {
  allowed: boolean;
  matchedRule?: string;
  policyMode: "allow" | "deny";
  reason: string;
  suggestion?: string;
}

export type PolicyPrincipalSelector =
  | { kind: "all" }
  | { kind: "groups"; groupIds: readonly string[] }
  | { kind: "users"; userIds: readonly string[] }
  | { kind: "principals"; groupIds: readonly string[]; userIds: readonly string[] };

export interface PolicyRuleSnapshot {
  id: string;
  effect: "allow" | "deny";
  priority: number;
  enabled: boolean;
  methods: readonly string[];
  hosts: readonly PolicyHostMatcher[];
  paths: readonly PolicyPathMatcher[];
  selector: PolicyPrincipalSelector;
  reason?: string;
}

export interface PolicyBoundarySnapshot {
  id: string;
  kind: "service" | "credential";
  mode: "allow" | "deny";
  assignmentAllowed: boolean;
  rules: readonly PolicyRuleSnapshot[];
}

export interface PolicyEvaluationSnapshot {
  subjectId: string;
  groupIds: readonly string[];
  method: string;
  host: string;
  pathname: string;
  service: PolicyBoundarySnapshot;
  credentials: readonly PolicyBoundarySnapshot[];
}

export type PolicyRuleReasonCode =
  | "disabled"
  | "principal_not_applicable"
  | "method_not_matched"
  | "host_not_matched"
  | "path_not_matched"
  | "matched_lower_priority"
  | "selected_allow"
  | "selected_deny";

export interface PolicyRuleExplanation {
  ruleId: string;
  applicable: boolean;
  requestMatched: boolean;
  selected: boolean;
  reasonCode: PolicyRuleReasonCode;
  priority: number;
  effect: "allow" | "deny";
}

export interface PolicyBoundaryExplanation {
  boundaryId: string;
  kind: "service" | "credential";
  assignmentAllowed: boolean;
  allowed: boolean;
  mode: "allow" | "deny";
  selectedPriority?: number;
  selectedRuleIds: string[];
  decisiveRuleId?: string;
  reasonCode:
    | "assignment_denied"
    | "default_allow"
    | "default_deny"
    | "selected_allow"
    | "selected_deny"
    | "deny_tie";
  rules: PolicyRuleExplanation[];
}

export interface PolicyEvaluationExplanation {
  allowed: boolean;
  subjectId: string;
  groupIds: string[];
  canonicalTarget: {
    method: string;
    host: string;
    pathname: string;
  };
  boundaries: PolicyBoundaryExplanation[];
  reasonCode: "all_boundaries_allow" | "boundary_denied";
}

export function evaluatePolicySnapshot(
  snapshot: PolicyEvaluationSnapshot,
): PolicyEvaluationExplanation {
  const method = snapshot.method.toUpperCase();
  const host = normalizeHost(snapshot.host);
  const groupIds = [...new Set(snapshot.groupIds)].sort();
  const inputs = [snapshot.service, ...snapshot.credentials];
  const boundaries = inputs.map((boundary) =>
    evaluateBoundary(boundary, snapshot.subjectId, groupIds, method, host, snapshot.pathname));
  const allowed = boundaries.every((boundary) => boundary.allowed);
  return {
    allowed,
    subjectId: snapshot.subjectId,
    groupIds,
    canonicalTarget: { method, host, pathname: snapshot.pathname },
    boundaries,
    reasonCode: allowed ? "all_boundaries_allow" : "boundary_denied",
  };
}

export function evaluatePolicy(service: ServiceConfig, target: ResolvedTarget, method: string): PolicyDecision {
  const explanation = evaluatePolicySnapshot({
    subjectId: "yaml-runtime-subject",
    groupIds: [],
    method,
    host: target.url.hostname,
    pathname: target.methodPath,
    service: {
      id: service.id,
      kind: "service",
      mode: service.policy.mode,
      assignmentAllowed: true,
      rules: service.policy.rules.map(legacyRuleSnapshot),
    },
    credentials: [],
  });
  const boundary = explanation.boundaries[0] as PolicyBoundaryExplanation;
  if (boundary.decisiveRuleId !== undefined) {
    const selected = service.policy.rules.find(
      (rule) => rule.id === boundary.decisiveRuleId,
    ) as PolicyRuleConfig;
    const allowed = boundary.allowed;
    return {
      allowed,
      matchedRule: selected.id,
      policyMode: service.policy.mode,
      reason: selected.reason ?? `${allowed ? "Allowed" : "Denied"} by policy rule ${selected.id}.`,
      ...(allowed ? {} : { suggestion: "Use an allowed request or ask the user to update service policy." }),
    };
  }

  const allowed = boundary.allowed;
  return {
    allowed,
    policyMode: service.policy.mode,
    reason: allowed ? "Allowed by default policy mode." : "Denied by default policy mode.",
    ...(allowed ? {} : { suggestion: "Use an allowed request or ask the user to update service policy." }),
  };
}

function evaluateBoundary(
  boundary: PolicyBoundarySnapshot,
  subjectId: string,
  groupIds: readonly string[],
  method: string,
  host: string,
  pathname: string,
): PolicyBoundaryExplanation {
  if (!boundary.assignmentAllowed) {
    return {
      boundaryId: boundary.id,
      kind: boundary.kind,
      assignmentAllowed: false,
      allowed: false,
      mode: boundary.mode,
      selectedRuleIds: [],
      reasonCode: "assignment_denied",
      rules: boundary.rules.map((rule) => explainRule(
        rule,
        subjectId,
        groupIds,
        method,
        host,
        pathname,
      )),
    };
  }
  const initial = boundary.rules.map((rule) =>
    explainRule(rule, subjectId, groupIds, method, host, pathname));
  const matches = initial.filter((rule) => rule.requestMatched);
  if (matches.length === 0) {
    return {
      boundaryId: boundary.id,
      kind: boundary.kind,
      assignmentAllowed: true,
      allowed: boundary.mode === "allow",
      mode: boundary.mode,
      selectedRuleIds: [],
      reasonCode: boundary.mode === "allow" ? "default_allow" : "default_deny",
      rules: initial,
    };
  }
  const selectedPriority = Math.max(...matches.map((rule) => rule.priority));
  const selected = matches.filter((rule) => rule.priority === selectedPriority);
  const denies = selected.filter((rule) => rule.effect === "deny");
  const allowed = denies.length === 0;
  const selectedRuleIds = selected.map((rule) => rule.ruleId).sort();
  const decisiveRuleId = (allowed ? selected : denies)
    .map((rule) => rule.ruleId)
    .sort()[0] as string;
  const selectedSet = new Set(selectedRuleIds);
  const rules = initial.map((rule): PolicyRuleExplanation => {
    if (!rule.requestMatched) return rule;
    if (!selectedSet.has(rule.ruleId)) {
      return { ...rule, reasonCode: "matched_lower_priority" };
    }
    return {
      ...rule,
      selected: true,
      reasonCode: rule.effect === "deny" ? "selected_deny" : "selected_allow",
    };
  });
  return {
    boundaryId: boundary.id,
    kind: boundary.kind,
    assignmentAllowed: true,
    allowed,
    mode: boundary.mode,
    selectedPriority,
    selectedRuleIds,
    decisiveRuleId,
    reasonCode: allowed
      ? "selected_allow"
      : selected.some((rule) => rule.effect === "allow")
        ? "deny_tie"
        : "selected_deny",
    rules,
  };
}

function explainRule(
  rule: PolicyRuleSnapshot,
  subjectId: string,
  groupIds: readonly string[],
  method: string,
  host: string,
  pathname: string,
): PolicyRuleExplanation {
  const base = {
    ruleId: rule.id,
    priority: rule.priority,
    effect: rule.effect,
    selected: false,
  };
  if (!rule.enabled) {
    return { ...base, applicable: false, requestMatched: false, reasonCode: "disabled" };
  }
  if (!selectorApplies(rule.selector, subjectId, groupIds)) {
    return {
      ...base,
      applicable: false,
      requestMatched: false,
      reasonCode: "principal_not_applicable",
    };
  }
  if (rule.methods.length > 0 && !rule.methods.includes(method)) {
    return { ...base, applicable: true, requestMatched: false, reasonCode: "method_not_matched" };
  }
  if (rule.hosts.length > 0 && !rule.hosts.some((matcher) => matchesPolicyHost(matcher, host))) {
    return { ...base, applicable: true, requestMatched: false, reasonCode: "host_not_matched" };
  }
  if (rule.paths.length > 0 && !rule.paths.some((matcher) => matchesPolicyPath(matcher, pathname))) {
    return { ...base, applicable: true, requestMatched: false, reasonCode: "path_not_matched" };
  }
  return {
    ...base,
    applicable: true,
    requestMatched: true,
    reasonCode: rule.effect === "deny" ? "selected_deny" : "selected_allow",
  };
}

function selectorApplies(
  selector: PolicyPrincipalSelector,
  subjectId: string,
  groupIds: readonly string[],
): boolean {
  if (selector.kind === "all") return true;
  if (selector.kind === "groups") {
    return selector.groupIds.some((groupId) => groupIds.includes(groupId));
  }
  if (selector.kind === "users") return selector.userIds.includes(subjectId);
  return selector.userIds.includes(subjectId)
    || selector.groupIds.some((groupId) => groupIds.includes(groupId));
}

function legacyRuleSnapshot(rule: PolicyRuleConfig): PolicyRuleSnapshot {
  return {
    id: rule.id,
    effect: rule.effect,
    priority: rule.priority,
    enabled: true,
    methods: rule.methods.map((value) => value.toUpperCase()),
    hosts: rule.hosts.map((value) => ({ kind: "regex" as const, value })),
    paths: rule.paths.map((value) => ({ kind: "regex" as const, value })),
    selector: { kind: "all" },
    ...(rule.reason === undefined ? {} : { reason: rule.reason }),
  };
}
