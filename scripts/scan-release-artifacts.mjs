#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { scanReleaseArtifacts } from "../dist/releaseArtifactScanner.js";

const INCLUDED_TRACKED_PREFIXES = [
  ".github/",
  "assets/",
  "config/",
  "docs/",
  "examples/",
  "scripts/",
  "src/",
  "web/",
];
const INCLUDED_TRACKED_FILES = new Set([
  "AGENTS.md",
  "Dockerfile",
  "README.md",
  "config.example.yaml",
  "docker-compose.example.yaml",
  "package.json",
  "package-lock.json",
]);
const DESIGNATED_FIXTURES = [
  "test/fixtures/release-safe-output.json",
];
const BUILD_ROOTS = [
  "dist",
];

const tracked = execFileSync("git", ["ls-files", "-z"], {
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
}).split("\0").filter(Boolean).filter((path) =>
  !isTestPath(path) && (
    INCLUDED_TRACKED_FILES.has(path)
    || INCLUDED_TRACKED_PREFIXES.some((prefix) => path.startsWith(prefix))
  ));
const paths = new Set([...tracked, ...DESIGNATED_FIXTURES]);
for (const root of BUILD_ROOTS) {
  for (const path of filesUnder(root)) paths.add(path);
}
const artifacts = [...paths].sort().map((path) => ({
  path,
  content: readFileSync(path),
}));
const findings = scanReleaseArtifacts(artifacts);
if (findings.length > 0) {
  console.error(`Release artifact scan found ${findings.length} prohibited item(s).`);
  for (const finding of findings) {
    console.error(`${finding.path}:${finding.line} ${finding.rule}`);
  }
  process.exit(1);
}
console.log(`Release artifact scan passed for ${artifacts.length} closed-scope files.`);

function filesUnder(root) {
  const absoluteRoot = resolve(root);
  const result = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = resolve(directory, entry.name);
      const repositoryPath = relative(process.cwd(), absolute);
      if (repositoryPath === "dist/test" || repositoryPath.startsWith("dist/test/")) {
        continue;
      }
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) result.push(repositoryPath);
    }
  };
  visit(absoluteRoot);
  return result;
}

function isTestPath(path) {
  return path.startsWith("test/")
    || /(?:^|\/)[^/]+\.test\.[cm]?[jt]sx?$/.test(path);
}
