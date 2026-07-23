import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = "docs/architecture/v2";
const artifacts = [
  "README.md",
  "decisions.md",
  "system-architecture.md",
  "threat-model.md",
  "data-model.md",
  "management-api.md",
  "vault.md",
  "identity-oauth.md",
  "ux.md",
  "dependencies-and-sequencing.md",
  "validation-matrix.md",
];

function read(name: string): string {
  return readFileSync(`${root}/${name}`, "utf8");
}

function missingSection39Answers(source: string): number[] {
  return Array.from({ length: 10 }, (_, index) => index + 1).filter(
    (id) => !source.includes(`ADR-${String(id).padStart(3, "0")}:`),
  );
}

describe("v2 architecture baseline", () => {
  it("links every required approved artifact from the packet index", () => {
    const index = read("README.md");

    for (const artifact of artifacts.slice(1)) {
      expect(index).toContain(`](${artifact})`);
      expect(read(artifact).length).toBeGreaterThan(500);
    }
    expect(index).toContain("Status: approved for implementation planning");
  });

  it("answers all ten PRD Section 39 questions with accepted decisions", () => {
    const decisions = read("decisions.md");

    expect(missingSection39Answers(decisions)).toEqual([]);
    expect(decisions.match(/\*\*Decision\.\*\*/g)).toHaveLength(10);
  });

  it("detects an incomplete Section 39 decision set", () => {
    const withoutVaultBoundary = read("decisions.md").replace(
      /## ADR-001:[\s\S]*?(?=## ADR-002:)/,
      "",
    );

    expect(missingSection39Answers(withoutVaultBoundary)).toContain(1);
  });

  it("defines allowed and denied cases for every trust boundary", () => {
    const threatModel = read("threat-model.md");

    for (const boundary of [
      "Internet → MCP listener",
      "Internet → control listener",
      "Data plane → vault",
      "Control → SQLite",
      "Backup → vault",
      "Archive → restore/migration",
      "Host user → break glass",
    ]) {
      const row = threatModel.split("\n").find((line) => line.includes(boundary));
      expect(row).toBeDefined();
      expect(row?.split("|").filter(Boolean)).toHaveLength(4);
    }
  });

  it("maps positive and negative implementation scenarios to milestones 01 through 24", () => {
    const matrix = read("validation-matrix.md");

    for (let id = 1; id <= 24; id += 1) {
      expect(matrix).toMatch(new RegExp(`\\| ${String(id).padStart(2, "0")}(?:–\\d+)? \\|`));
    }
    expect(matrix).toContain("Positive scenario");
    expect(matrix).toContain("Negative/failure scenario");
  });

  it("keeps v2 examples on example.org and preserves the stateless MCP contract", () => {
    const joined = artifacts.map(read).join("\n");
    const documentedHosts = [...joined.matchAll(/https:\/\/([a-z0-9.-]+)/gi)].map(
      (match) => match[1],
    );

    expect(documentedHosts.filter((host) => host?.endsWith("example.org"))).not.toHaveLength(0);
    expect(
      documentedHosts.filter(
        (host) =>
          host !== undefined &&
          !host.endsWith("example.org") &&
          !["github.com", "fastify.dev", "www.rfc-editor.org"].includes(host),
      ),
    ).toEqual([]);
    expect(joined).toContain("never issue or trust\n   `mcp-session-id`");
    expect(joined).toContain("authenticate, authorize service and every credential");
  });

  it("specifies deletion, concurrency, API, vault, UX, and sequencing contracts", () => {
    expect(read("data-model.md")).toContain("no tombstone");
    expect(read("data-model.md")).toContain("stale-write conflict");
    expect(read("management-api.md")).toContain("Idempotency-Key");
    expect(read("management-api.md")).toContain("API keys never satisfy human step-up");
    expect(read("vault.md")).toContain("The control caller has no resolve or export operation");
    expect(read("ux.md")).toContain("WCAG 2.2 AA");
    expect(read("dependencies-and-sequencing.md")).toContain("schema `0001`");
  });
});
