import { describe, expect, it } from "vitest";
import {
  scanReleaseArtifacts,
  type ReleaseArtifactRule,
} from "../src/releaseArtifactScanner.js";

describe("closed release artifact scanner", () => {
  it("accepts safe public artifacts, placeholders, and binary assets", () => {
    expect(scanReleaseArtifacts([
      {
        path: "docs/operator.md",
        content: [
          "Use https://mcp.example.org/mcp.",
          "Authorization: Bearer <one-time-key>",
          "Cookie: <redacted>",
          "Opaque values use the notation gref_<opaque-reference>.",
          "Loopback development may use http://a.localhost:3000.",
        ].join("\n"),
      },
      {
        path: "test/fixtures/release-safe-output.json",
        content: JSON.stringify({ status: "ready", host: "api.example.org" }),
      },
      {
        path: "dist/control-web/assets/brand.png",
        content: Uint8Array.from([137, 80, 78, 71, 0, 1, 2]),
      },
    ])).toEqual([]);
  });

  it.each<[ReleaseArtifactRule, string]>([
    ["internal_hostname", "base_url: https://api.team.internal/v1"],
    ["raw_api_key", `key=${`ssk_v1_${"A".repeat(43)}`}`],
    ["authorization_value", "Authorization: Bearer release-token-value-123456"],
    ["authorization_value", "Basic dXNlcjpyZWxlYXNlLXBhc3N3b3Jk"],
    ["cookie_value", "Cookie: session=release-cookie-value"],
    ["private_key", "-----BEGIN PRIVATE KEY-----"],
    ["opaque_reference", `result=${`gref_${"B".repeat(32)}`}`],
    ["opaque_reference", `result=${`sec_${"C".repeat(32)}`}`],
  ])("reports %s without returning the matched value", (rule, content) => {
    const findings = scanReleaseArtifacts([{ path: "output/report.txt", content }]);
    expect(findings).toEqual([{ path: "output/report.txt", rule, line: 1 }]);
    expect(JSON.stringify(findings)).not.toContain(content);
  });

  it("detects configured synthetic canaries independently of format", () => {
    const canary = "release-known-canary-value";
    expect(scanReleaseArtifacts(
      [{ path: "output/audit.json", content: `safe\n${canary}` }],
      { knownCanaries: [canary] },
    )).toEqual([{
      path: "output/audit.json",
      rule: "known_canary",
      line: 2,
    }]);
  });

  it("rejects unbounded, duplicate, or non-normalized external inputs", () => {
    expect(() => scanReleaseArtifacts([
      { path: "../outside", content: "safe" },
    ])).toThrow("normalized");
    expect(() => scanReleaseArtifacts([
      { path: "same", content: "safe" },
      { path: "same", content: "safe" },
    ])).toThrow("Duplicate");
    expect(() => scanReleaseArtifacts([
      { path: "large", content: "12345" },
    ], { maxArtifactBytes: 4, maxTotalBytes: 4 })).toThrow("byte limit");
    expect(() => scanReleaseArtifacts([], {
      knownCanaries: ["too-short"],
    })).toThrow("at least 12");
  });
});
