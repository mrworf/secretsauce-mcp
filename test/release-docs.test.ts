import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { describe, expect, it } from "vitest";

const RELEASE_DOCS = [
  "README.md",
  "docs/operator-guide.md",
  "docs/management-api.md",
  "docs/client-compatibility.md",
  "docs/release-matrix.md",
  "docs/audits/milestone-24-acceptance.md",
  "docs/audits/milestone-24-architecture-operations.md",
  "docs/audits/milestone-24-security-invariant.md",
  "docs/audits/milestone-24-ux-accessibility.md",
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

  it("keeps the final release reviews decision-complete without waiving pending gates", () => {
    const ux = readFileSync(
      "docs/audits/milestone-24-ux-accessibility.md",
      "utf8",
    );
    for (const heading of [
      "## Scope",
      "## Commands And Evidence",
      "## Limitations And Residual Risk",
      "## Verdict",
    ]) expect(ux).toContain(heading);

    const security = readFileSync(
      "docs/audits/milestone-24-security-invariant.md",
      "utf8",
    );
    for (const expected of [
      "## Threat Model",
      "## Findings Summary",
      "CVSS v3.1",
      "Accepted risk",
      "No open Critical or High",
    ]) expect(security).toContain(expected);

    const architecture = readFileSync(
      "docs/audits/milestone-24-architecture-operations.md",
      "utf8",
    );
    for (const heading of [
      "## Scope",
      "## Executive Summary",
      "## What Is Good",
      "## What Is Bad Or Risky",
      "## What Should Change",
      "## What I Would Not Change Yet",
      "## Overall Opinion",
    ]) expect(architecture).toContain(heading);

    const acceptance = readFileSync(
      "docs/audits/milestone-24-acceptance.md",
      "utf8",
    );
    expect(acceptance).toContain("Production container execution | **pending**");
    expect(acceptance).toContain("No pending gate is waived");
    expect(acceptance).not.toContain("Release approved");
  });

  it("records every verified gate while leaving unavailable container execution pending", () => {
    const matrix = readFileSync("docs/release-matrix.md", "utf8");
    const pendingRows = matrix
      .split("\n")
      .filter((line) => line.startsWith("|") && line.includes("pending"));
    expect(pendingRows).toEqual([
      expect.stringContaining(
        "Image build, unprivileged start, health, MCP, restart",
      ),
    ]);
    expect(matrix).toContain("146 files / 972 tests passed");
    expect(matrix).toContain("562 tracked, staged, built, generated");

    const status = readFileSync("docs/milestones/status.yaml", "utf8");
    expect(status).toMatch(
      /id: "24"[\s\S]*status: "in_progress"[\s\S]*container smoke remains unwaived/,
    );
    expect(status).not.toMatch(
      /id: "24"[\s\S]*status: "completed"/,
    );
  });
});
