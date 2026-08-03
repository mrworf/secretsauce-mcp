import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

const composeFile = "docker-compose.local.yaml";

export default function globalSetup() {
  requireCommand(["compose", "version"], "Docker Compose is unavailable.");
  requireCommand(["info"], "The Docker daemon is unavailable.");

  const project = `secretsauce-e2e-${process.pid}-${randomBytes(4).toString("hex")}`;
  process.env.SECRETSAUCE_E2E_COMPOSE_PROJECT = project;
  const started = spawnSync("docker", [
    "compose",
    "-p",
    project,
    "-f",
    composeFile,
    "up",
    "--build",
    "--detach",
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "inherit",
    timeout: 20 * 60_000,
  });
  if (started.status !== 0) {
    cleanup(project);
    throw new Error("The disposable browser-test topology did not start.");
  }

  return () => cleanup(project);
}

function requireCommand(args, message) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    stdio: "ignore",
    timeout: 15_000,
  });
  if (result.status !== 0) throw new Error(message);
}

function cleanup(project) {
  spawnSync("docker", [
    "compose",
    "-p",
    project,
    "-f",
    composeFile,
    "down",
    "--volumes",
    "--remove-orphans",
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "ignore",
    timeout: 2 * 60_000,
  });
}
