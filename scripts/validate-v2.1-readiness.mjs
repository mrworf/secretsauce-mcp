import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { parse } from "yaml";

const repositoryRoot = resolve(process.argv[2] ?? process.cwd());
const required = [
  "docs/architecture/v2.1/decisions.md",
  "docs/architecture/v2.1/data-model.md",
  "docs/architecture/v2.1/public-api.md",
  "docs/architecture/v2.1/provisioning.md",
  "docs/architecture/v2.1/threat-model.md",
  "docs/architecture/v2.1/ux.md",
  "docs/architecture/v2.1/validation-matrix.md",
  "docs/architecture/v2.1/vault-rest-api.md",
  "docs/openapi/vault-v1.yaml",
  "docs/audits/v2.1/milestone-00-acceptance.md",
  "docs/milestones/v2.1/00-implementation-readiness.md",
  "docs/milestones/v2.1/status.yaml",
  "docs/plans/v2.1/milestone-00-implementation-readiness.md",
  "docs/prd/secretsauce-v2.1-prd.md",
];

const failures = [];
const sources = new Map();

for (const relative of required) {
  const absolute = resolve(repositoryRoot, relative);
  if (!existsSync(absolute) || !statSync(absolute).isFile()) {
    failures.push(`missing required artifact: ${relative}`);
    continue;
  }
  sources.set(relative, readFileSync(absolute, "utf8"));
}

for (const [relative, source] of sources) {
  if (/\b(?:TBD|TODO|FIXME)\b/.test(source)) {
    failures.push(`unresolved placeholder in ${relative}`);
  }
  if (/Authorization:\s*(?:Basic|Bearer)\s+\S+/i.test(source)) {
    failures.push(`credential-shaped Authorization example in ${relative}`);
  }
  for (const match of source.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1].split("#", 1)[0];
    if (
      target === ""
      || target.startsWith("#")
      || /^[a-z][a-z0-9+.-]*:/i.test(target)
      || target.startsWith("/")
    ) continue;
    const linked = resolve(repositoryRoot, dirname(relative), target);
    if (!existsSync(linked)) failures.push(`broken link in ${relative}: ${target}`);
  }
  for (const match of source.matchAll(/https?:\/\/([^/\s)`]+)/g)) {
    const hostname = match[1].split(":")[0].toLowerCase();
    if (hostname !== "example.org" && hostname !== "localhost") {
      failures.push(`non-example hostname in ${relative}: ${hostname}`);
    }
  }
}

const decisions = sources.get("docs/architecture/v2.1/decisions.md") ?? "";
for (let index = 1; index <= 8; index += 1) {
  if (!decisions.includes(`ADR-2.1-0${index}`)) {
    failures.push(`missing Section 24 decision ADR-2.1-0${index}`);
  }
}

const matrix = sources.get("docs/architecture/v2.1/validation-matrix.md") ?? "";
for (const family of [
  "SETUP", "HEALTH", "VAULTAPI", "ENROLL", "LOGIN", "LOGOUT",
  "SESSION", "ABUSE", "SOURCE", "RECOVER", "ACCESS",
]) {
  if (!matrix.includes(`\`${family}-`)) failures.push(`validation matrix omits ${family}`);
}
for (const evidence of [
  "Positive result",
  "Negative/failure assertion",
  "Timing-comparability method",
  "Compose and topology evidence",
  "Browser and accessibility evidence",
  "Secret and diagnostic evidence",
]) {
  if (!matrix.includes(evidence)) failures.push(`validation matrix omits ${evidence}`);
}
const inputRows = (matrix.match(/^\| [^|-].*\|.*\|.*\|$/gm) ?? []).length;
if (inputRows < 20) failures.push("external-input matrix is unexpectedly incomplete");

const ux = sources.get("docs/architecture/v2.1/ux.md") ?? "";
for (const flow of [
  "Setup status",
  "Unified enrollment",
  "Branded login",
  "Global logout",
  "Account security",
  "Browser sessions",
  "Agent connections",
  "Suspension settings and recovery",
  "320",
  "keyboard",
  "focus",
]) {
  if (!ux.toLowerCase().includes(flow.toLowerCase())) failures.push(`UX contract omits ${flow}`);
}

const threat = sources.get("docs/architecture/v2.1/threat-model.md") ?? "";
if (!threat.includes("```mermaid")) failures.push("threat model omits trust-boundary diagram");
for (const boundary of [
  "Host configuration -> vault setup",
  "Runtime caller -> credential socket",
  "Browser -> enrollment",
  "Proxy field -> source resolver",
  "User/admin -> session/grant control",
]) {
  if (!threat.includes(boundary)) failures.push(`threat model omits ${boundary}`);
}

const openApiSource = sources.get("docs/openapi/vault-v1.yaml");
if (openApiSource !== undefined) {
  try {
    const document = parse(openApiSource);
    if (document?.openapi !== "3.1.0") failures.push("private OpenAPI is not 3.1.0");
    for (const path of [
      "/v1/status",
      "/v1/readiness",
      "/v1/credentials",
      "/v1/credentials/{locator}",
      "/v1/resolutions",
      "/v1/transfers",
      "/v1/transfers/{transfer_id}",
    ]) {
      if (document?.paths?.[path] === undefined) failures.push(`private OpenAPI omits ${path}`);
    }
    const serverUrls = (document?.servers ?? []).map((server) => server?.url);
    if (serverUrls.some((url) => typeof url !== "string" || url !== "http://localhost")) {
      failures.push("private OpenAPI advertises a non-logical or remote server");
    }
    const schemas = document?.components?.schemas ?? {};
    for (const schema of ["ProvisioningStatus", "CredentialMetadata", "ResolutionRequest", "TransferStart", "Error"]) {
      if (schemas[schema]?.additionalProperties !== false) {
        failures.push(`private OpenAPI schema is not closed: ${schema}`);
      }
    }
  } catch {
    failures.push("private OpenAPI does not parse as YAML");
  }
}

const prd = sources.get("docs/prd/secretsauce-v2.1-prd.md") ?? "";
if (!prd.includes("**Implementation-ready: yes**")) {
  failures.push("PRD final readiness declaration is not implementation-ready");
}

const milestone = sources.get("docs/milestones/v2.1/00-implementation-readiness.md") ?? "";
if ((milestone.match(/^- \[x\]/gm) ?? []).length !== 5 || milestone.includes("- [ ]")) {
  failures.push("Milestone 00 acceptance checklist is not completely satisfied");
}

const status = sources.get("docs/milestones/v2.1/status.yaml") ?? "";
if (!/id: "00"[\s\S]*?status: "(?:in_progress|completed)"/.test(status)) {
  failures.push("Milestone 00 durable status is not active or completed");
}

if (failures.length > 0) {
  for (const failure of failures) process.stderr.write(`v2.1 readiness: ${failure}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`v2.1 readiness: validated ${required.length} artifacts\n`);
}
