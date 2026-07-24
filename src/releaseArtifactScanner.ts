export type ReleaseArtifactRule =
  | "internal_hostname"
  | "raw_api_key"
  | "authorization_value"
  | "cookie_value"
  | "private_key"
  | "opaque_reference"
  | "known_canary";

export interface ReleaseArtifact {
  path: string;
  content: string | Uint8Array;
}

export interface ReleaseArtifactFinding {
  path: string;
  rule: ReleaseArtifactRule;
  line: number;
}

export interface ReleaseArtifactScanOptions {
  knownCanaries?: readonly string[];
  maxArtifactBytes?: number;
  maxTotalBytes?: number;
}

const DEFAULT_MAX_ARTIFACT_BYTES = 16 * 1024 * 1024;
const DEFAULT_MAX_TOTAL_BYTES = 128 * 1024 * 1024;

const RULES: readonly {
  rule: Exclude<ReleaseArtifactRule, "known_canary">;
  pattern: RegExp;
  ignore?: (match: string) => boolean;
}[] = [
  {
    rule: "internal_hostname",
    pattern: /\bhttps?:\/\/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:internal|local|lan|corp|home)(?=[:/\\\s"'`]|$)/gi,
  },
  {
    rule: "raw_api_key",
    pattern: /\bssk_v1_[A-Za-z0-9_-]{32,}\b/g,
  },
  {
    rule: "authorization_value",
    pattern: /^(?:Authorization|Proxy-Authorization):[^\r\n]+$/gm,
    ignore: safeHeaderPlaceholder,
  },
  {
    rule: "authorization_value",
    pattern: /\b(?:Bearer\s+[A-Za-z0-9][A-Za-z0-9._~+/=-]{23,}|Basic\s+[A-Za-z0-9+/]{16,}={0,2})\b/g,
  },
  {
    rule: "cookie_value",
    pattern: /^Cookie:[^\r\n]+$/gm,
    ignore: safeHeaderPlaceholder,
  },
  {
    rule: "private_key",
    pattern: /-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----/g,
  },
  {
    rule: "opaque_reference",
    pattern: /\b(?:gref|sec)_[A-Za-z0-9_-]{16,}\b/g,
  },
] as const;

export function scanReleaseArtifacts(
  artifacts: readonly ReleaseArtifact[],
  options: ReleaseArtifactScanOptions = {},
): readonly ReleaseArtifactFinding[] {
  const maxArtifactBytes = options.maxArtifactBytes ?? DEFAULT_MAX_ARTIFACT_BYTES;
  const maxTotalBytes = options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
  if (!Number.isSafeInteger(maxArtifactBytes) || maxArtifactBytes < 1) {
    throw new Error("Release artifact byte limit must be a positive safe integer.");
  }
  if (!Number.isSafeInteger(maxTotalBytes) || maxTotalBytes < maxArtifactBytes) {
    throw new Error("Release artifact total limit must cover one artifact.");
  }
  validateCanaries(options.knownCanaries ?? []);

  const paths = new Set<string>();
  const findings: ReleaseArtifactFinding[] = [];
  let totalBytes = 0;
  for (const artifact of artifacts) {
    validatePath(artifact.path);
    if (paths.has(artifact.path)) throw new Error("Duplicate release artifact path.");
    paths.add(artifact.path);
    const bytes = typeof artifact.content === "string"
      ? Buffer.from(artifact.content, "utf8")
      : Buffer.from(artifact.content);
    if (bytes.byteLength > maxArtifactBytes) {
      throw new Error(`Release artifact exceeds byte limit: ${artifact.path}`);
    }
    totalBytes += bytes.byteLength;
    if (totalBytes > maxTotalBytes) throw new Error("Release artifact set exceeds byte limit.");
    if (isBinary(bytes)) continue;
    const text = bytes.toString("utf8");
    for (const { rule, pattern, ignore } of RULES) {
      collectMatches(findings, artifact.path, rule, text, pattern, ignore);
    }
    for (const canary of options.knownCanaries ?? []) {
      let offset = text.indexOf(canary);
      while (offset !== -1) {
        findings.push({
          path: artifact.path,
          rule: "known_canary",
          line: lineAt(text, offset),
        });
        offset = text.indexOf(canary, offset + canary.length);
      }
    }
  }
  const unique = [...new Map(findings.map((finding) => [
    `${finding.path}\0${finding.line}\0${finding.rule}`,
    finding,
  ])).values()];
  return unique.sort((left, right) =>
    left.path.localeCompare(right.path)
    || left.line - right.line
    || left.rule.localeCompare(right.rule));
}

function collectMatches(
  findings: ReleaseArtifactFinding[],
  path: string,
  rule: ReleaseArtifactRule,
  text: string,
  source: RegExp,
  ignore?: (match: string) => boolean,
): void {
  const pattern = new RegExp(source.source, source.flags);
  for (const match of text.matchAll(pattern)) {
    if (ignore?.(match[0])) continue;
    findings.push({
      path,
      rule,
      line: lineAt(text, match.index),
    });
  }
}

function safeHeaderPlaceholder(match: string): boolean {
  const value = match.slice(match.indexOf(":") + 1).trim();
  return /^(?:(?:Bearer|Basic)\s+)?(?:<[^>\r\n]+>|\[redacted\]|\.\.\.)$/i.test(value);
}

function lineAt(text: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (text.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

function isBinary(content: Buffer): boolean {
  const sample = content.subarray(0, Math.min(content.byteLength, 8_192));
  return sample.includes(0);
}

function validatePath(path: string): void {
  if (
    path.length < 1
    || path.startsWith("/")
    || path.includes("\\")
    || path.split("/").includes("..")
  ) throw new Error("Release artifact path must be normalized and repository-relative.");
}

function validateCanaries(canaries: readonly string[]): void {
  const seen = new Set<string>();
  for (const canary of canaries) {
    if (Buffer.byteLength(canary, "utf8") < 12 || seen.has(canary)) {
      throw new Error("Release canaries must be unique and at least 12 UTF-8 bytes.");
    }
    seen.add(canary);
  }
}
