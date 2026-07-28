import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { describe, expect, it } from "vitest";

const RELEASE_DOCS = [
  "README.md",
  "docs/operator-guide.md",
  "docs/management-api.md",
  "docs/client-compatibility.md",
  "docs/access-management.md",
  "docs/release-matrix.md",
  "docs/v2.1-release-qualification.md",
  "docs/plans/v2.1/milestone-10-release-qualification-and-documentation.md",
  "docs/audits/v2.1/milestone-10-automated-qualification.md",
  "docs/audits/v2.1/milestone-10-security-invariant.md",
  "docs/audits/v2.1/milestone-10-architecture-operations.md",
  "docs/audits/v2.1/milestone-10-ux-accessibility.md",
  "docs/audits/v2.1/milestone-10-data-api-documentation.md",
  ...Array.from(
    { length: 10 },
    (_, index) => `docs/audits/v2.1/milestone-${String(index).padStart(2, "0")}-acceptance.md`,
  ),
];

describe("release operations documentation", () => {
  it("keeps every local release-document link resolvable", () => {
    for (const sourcePath of RELEASE_DOCS) {
      const source = readFileSync(sourcePath, "utf8");
      for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
        const target = match[1]!;
        if (/^(?:https?:|#)/.test(target)) continue;
        const path = normalize(join(dirname(sourcePath), target.split("#")[0]!));
        expect(existsSync(path), `${sourcePath} -> ${target}`).toBe(true);
      }
    }
  });

  it("distinguishes origin-only OAuth values from the full MCP client URL", () => {
    const operator = readFileSync("docs/operator-guide.md", "utf8");
    const clients = readFileSync("docs/client-compatibility.md", "utf8");
    for (const source of [operator, clients]) {
      expect(source).toContain("https://mcp.example.org/mcp");
      expect(source).toContain("https://mcp.example.org");
    }
    expect(operator).toContain("`server.resource` and the OAuth issuer are the");
    expect(clients).toContain("while the client MCP Server URL is");
  });

  it("provides separate bounded proxies without exposing private listeners or forwarding trust", () => {
    const mcp = readFileSync("examples/proxy-mcp-oauth.haproxy.cfg", "utf8");
    const control = readFileSync("examples/proxy-control.haproxy.cfg", "utf8");
    expect(mcp).toContain("/mcp");
    expect(mcp).toContain("/.well-known/oauth-protected-resource");
    expect(mcp).toContain("/oauth/authorize");
    expect(mcp).toContain("/oauth/token");
    expect(mcp).not.toContain("/api/v2");
    expect(control).toContain("/control /api/v2 /assets/brand/");
    expect(control).not.toContain("/mcp");
    for (const source of [mcp, control]) {
      expect(source).toContain("timeout http-request");
      expect(source).toContain("req.body_size gt");
      expect(source).toContain("http-request del-header Forwarded");
      expect(source).toContain("http-request del-header X-Forwarded-For");
      expect(source).toContain("127.0.0.1:");
      expect(source).not.toMatch(/vault\.sock|var\/lib\/secretsauce\/vault/);
      expect(source).not.toMatch(/\bserver\s+\w+\s+0\.0\.0\.0/);
    }
    expect(control).toContain('Cache-Control "no-store"');
  });

  it("covers installation through recovery and exact live-client blocking evidence", () => {
    const operator = readFileSync("docs/operator-guide.md", "utf8");
    for (const topic of [
      "Install and bootstrap",
      "Daily administration",
      "Backup, restore, and migration",
      "Upgrade and restart",
      "Troubleshooting",
    ]) expect(operator).toContain(topic);
    const clients = readFileSync("docs/client-compatibility.md", "utf8");
    expect(clients).toContain("Codex release fixture");
    expect(clients).toContain("ChatGPT release fixture");
    expect(clients).toContain("A failure blocks that deployment");
    expect(clients).toContain("no `mcp-session-id`");
    expect(clients).toContain("Revoke each grant");
  });

  it("documents API authentication, bounded inputs, concurrency, idempotency, and safe errors", () => {
    const api = readFileSync("docs/management-api.md", "utf8");
    for (const expected of [
      "Browser routes",
      "System-owned API keys",
      "cannot satisfy browser step-up",
      "If-Match",
      "Idempotency-Key",
      "opaque `cursor`",
      "Cache-Control: no-store",
      "request ID",
    ]) expect(api).toContain(expected);
    expect(api).not.toMatch(/Authorization:\s+(?!Bearer <)/);
    expect(api).not.toMatch(/Cookie:\s+\S+/);
  });

  it("records verified v2.1 gates without converting external evidence to pass", () => {
    const matrix = readFileSync("docs/release-matrix.md", "utf8");
    const pendingRows = matrix
      .split("\n")
      .filter((line) => line.startsWith("|") && line.includes("pending"));
    expect(pendingRows).toHaveLength(4);
    expect(pendingRows).toEqual(expect.arrayContaining([
      expect.stringContaining("Production dependency advisory threshold"),
      expect.stringContaining("Official Compose clean setup and recreation"),
      expect.stringContaining("Live Codex and ChatGPT deployment procedure"),
      expect.stringContaining("Final security, architecture, UX"),
    ]));
    expect(matrix).toContain(
      "Official Compose clean setup and recreation",
    );
    expect(matrix).toContain("168 files / 1,089 tests passed");
    expect(matrix).toContain("662 tracked, staged, built, generated");
    expect(matrix).toContain("executable candidate `b780201`");
    expect(matrix).toContain("Project-authored final review packet");
    expect(matrix).toContain("explicitly non-independent");
    expect(matrix).toContain("No red or pending gate is waived");
    expect(matrix).not.toContain("candidate `acf8b67`");

    const status = readFileSync("docs/milestones/v2.1/status.yaml", "utf8");
    for (const id of Array.from({ length: 10 }, (_, index) =>
      String(index).padStart(2, "0"))) {
      expect(status, id).toMatch(
        new RegExp(`id: "${id}"[\\s\\S]*?status: "completed"`),
      );
    }
    expect(status).toMatch(
      /id: "10"[\s\S]*status: "in_progress"[\s\S]*commit_hash: null/,
    );
    expect(status).not.toMatch(
      /id: "10"[\s\S]*status: "completed"/,
    );
  });

  it("keeps exact-candidate external qualification complete and secret-safe", () => {
    const runbook = readFileSync("docs/v2.1-release-qualification.md", "utf8");
    const normalized = runbook.replace(/\s+/g, " ");
    for (const expected of [
      "npm run audit:production",
      "docker-compose.example.yaml",
      "network mode `none`",
      "does not automatically create a browser session",
      "force-recreate both containers",
      "identity` and `vault`",
      "https://mcp.example.org/mcp",
      "200% zoom",
      "representative screen reader",
      "No gate is waived",
    ]) expect(normalized).toContain(expected);
    expect(normalized).toContain(
      "sends dependency metadata to the public npm registry",
    );
    expect(normalized).toContain(
      "never apply the cleanup command to an existing installation",
    );
    expect(runbook).not.toMatch(/Authorization:\s+(?!Bearer <)/);
    expect(runbook).not.toMatch(/Cookie:\s+\S+/);
    expect(runbook).not.toMatch(/https?:\/\/(?![a-z0-9.-]*example\.org)[a-z0-9.-]+/i);
  });
});
