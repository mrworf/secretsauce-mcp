import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { configError } from "./errors.js";

const MAX_PATTERNS = 256;
const MAX_PATTERN_LENGTH = 512;
const MAX_CANDIDATE_LENGTH = 256;
const idPattern = /^[a-z0-9][a-z0-9._-]*$/;

export interface SensitiveNamePattern {
  id: string;
  regex: string;
}

export interface SensitiveNameConfig {
  version: 1;
  mode: "extend" | "replace";
  allowPatterns: string[];
  patterns: SensitiveNamePattern[];
}

const regexSource = z.string().min(1).max(MAX_PATTERN_LENGTH);
const schema = z.object({
  version: z.literal(1),
  mode: z.enum(["extend", "replace"]).default("extend"),
  allow_patterns: z.array(regexSource).max(MAX_PATTERNS).default([]),
  patterns: z.array(z.object({
    id: z.string().regex(idPattern).max(64),
    regex: regexSource,
  }).strict()).max(MAX_PATTERNS).default([]),
}).strict();

export const DEFAULT_SENSITIVE_NAMES_CONFIG_PATH = "/config/sensitive-names.yaml";

export function loadSensitiveNameConfig(
  path = process.env.SENSITIVE_NAMES_CONFIG_PATH ?? DEFAULT_SENSITIVE_NAMES_CONFIG_PATH,
): SensitiveNameConfig {
  let raw: unknown;
  try {
    raw = parseYaml(readFileSync(path, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw configError(`Failed to read or parse sensitive-name config: ${detail}`);
  }
  return validateSensitiveNameConfig(raw);
}

export function validateSensitiveNameConfig(raw: unknown): SensitiveNameConfig {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw configError(`Invalid sensitive-name config: ${result.error.issues.map((issue) => issue.message).join("; ")}`);
  }
  const ids = result.data.patterns.map((pattern) => pattern.id);
  if (new Set(ids).size !== ids.length) throw configError("Invalid sensitive-name config: pattern ids must be unique");
  for (const source of [...result.data.allow_patterns, ...result.data.patterns.map((pattern) => pattern.regex)]) {
    compileRegex(source);
  }
  return {
    version: 1,
    mode: result.data.mode,
    allowPatterns: result.data.allow_patterns,
    patterns: result.data.patterns,
  };
}

export function resolveSensitiveNameConfig(
  configured: SensitiveNameConfig,
  defaults: SensitiveNameConfig,
): SensitiveNameConfig {
  if (configured.mode === "replace") return configured;
  const patterns = new Map(defaults.patterns.map((pattern) => [pattern.id, pattern]));
  for (const pattern of configured.patterns) patterns.set(pattern.id, pattern);
  return {
    version: 1,
    mode: "extend",
    allowPatterns: [...new Set([...defaults.allowPatterns, ...configured.allowPatterns])],
    patterns: [...patterns.values()],
  };
}

export class SensitiveNameMatcher {
  private readonly allows: RegExp[];
  private readonly patterns: Array<{ id: string; regex: RegExp }>;

  constructor(config: SensitiveNameConfig) {
    this.allows = config.allowPatterns.map(compileRegex);
    this.patterns = config.patterns.map((pattern) => ({ id: pattern.id, regex: compileRegex(pattern.regex) }));
  }

  match(name: string): string[] {
    if (name.length === 0 || name.length > MAX_CANDIDATE_LENGTH) return [];
    const normalized = normalizeSensitiveName(name);
    if (normalized.length === 0 || this.allows.some((pattern) => pattern.test(normalized))) return [];
    return this.patterns.filter((pattern) => pattern.regex.test(normalized)).map((pattern) => `gateway:sensitive-name:${pattern.id}`);
  }
}

export function normalizeSensitiveName(name: string): string {
  return name.trim()
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function compileRegex(source: string): RegExp {
  try {
    return new RegExp(source, "i");
  } catch {
    throw configError("Invalid sensitive-name config: regex must compile");
  }
}
