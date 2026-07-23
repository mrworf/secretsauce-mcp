#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import {
  createDefaultControlRouteRegistry,
} from "../dist/control/defaultRoutes.js";
import {
  generateControlOpenApi,
  serializeControlOpenApi,
} from "../dist/control/openapi.js";

const outputPath = "docs/openapi/control-v2.json";
const registry = createDefaultControlRouteRegistry(undefined, "https://control.example.org");
const generated = serializeControlOpenApi(
  generateControlOpenApi(registry, "https://control.example.org"),
);

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(outputPath, "utf8");
  } catch {
    // A missing artifact is drift.
  }
  if (current !== generated) {
    console.error("Generated control OpenAPI artifact is out of date.");
    process.exit(1);
  }
  console.log("Control OpenAPI artifact is current.");
} else {
  writeFileSync(outputPath, generated);
  console.log(`Wrote ${outputPath}.`);
}
