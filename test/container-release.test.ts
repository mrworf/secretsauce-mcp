import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

describe("release container deployment", () => {
  it("runs the production image as an unprivileged read-only-compatible user", () => {
    const dockerfile = readFileSync("Dockerfile", "utf8");
    const runtime = dockerfile.slice(dockerfile.lastIndexOf("FROM node:22-alpine"));
    expect(runtime).toContain("USER node");
    expect(runtime).toContain("HEALTHCHECK");
    expect(runtime).toContain('CMD ["node", "dist/application.js"]');
    expect(runtime).toContain("EXPOSE 8080 8081");
    expect(runtime).not.toMatch(/\bUSER\s+(?:0|root)\b/);
  });

  it("keeps one instance and every durable store explicit while references remain ephemeral", () => {
    const source = readFileSync("docker-compose.example.yaml", "utf8");
    const compose = parse(source) as any;
    const gateway = compose.services.secretsauce;
    expect(gateway.deploy.replicas).toBe(1);
    expect(gateway.ports).toEqual(["8080:8080", "8081:8081"]);
    expect(gateway.volumes).toEqual(expect.arrayContaining([
      "./database:/var/lib/secretsauce/database",
      "./audit:/var/lib/secretsauce/audit",
      "./oauth-state:/var/lib/secretsauce/oauth",
      "./restore:/var/lib/secretsauce/restore",
      "./vault-keys/control-plane.key:/run/vault-caller/control-plane.key:ro",
    ]));
    expect(gateway.environment.SECRETSAUCE_VAULT_CONTROL_KEY_FILE)
      .toBe("/run/vault-caller/control-plane.key");
    expect(compose.services["secretsauce-vault"].volumes).toContain(
      "./vault-store:/var/lib/secretsauce/vault",
    );
    expect(source).toContain("gref_/sec_ capability state is intentionally ephemeral");
    expect(gateway.volumes.join("\n")).not.toMatch(/gref|sec-token|capability-state/);
  });

  it("smokes independent stateless MCP requests before and after restart", () => {
    const smoke = readFileSync("scripts/container-smoke.sh", "utf8");
    expect(smoke).toContain("docker build --platform linux/amd64");
    expect(smoke).toContain("--read-only");
    expect(smoke).toContain("test \"$(docker image inspect --format '{{.Config.User}}'");
    expect(smoke).toContain('"method":"initialize"');
    expect(smoke).toContain('"method":"tools/list"');
    expect(smoke).toContain('"method":"tools/call"');
    expect(smoke).toContain("docker restart");
    expect(smoke).toContain("mcp-session-id");
    expect(smoke).toContain("audit_size_after");
    expect(smoke).not.toContain("--privileged");
    expect(smoke).not.toMatch(/docker\s+run[\s\S]*--user\s+(?:0|root)/);
  });

  it("runs smoke before login and multi-architecture publication", () => {
    const workflow = parse(readFileSync(".github/workflows/ci.yml", "utf8")) as any;
    const steps = workflow.jobs["docker-image"].steps as Array<Record<string, unknown>>;
    const smoke = steps.findIndex((step) => step.run === "npm run smoke:container");
    const login = steps.findIndex((step) =>
      typeof step.uses === "string" && step.uses.startsWith("docker/login-action@"));
    const publish = steps.findIndex((step) =>
      typeof step.uses === "string" && step.uses.startsWith("docker/build-push-action@"));
    expect(smoke).toBeGreaterThan(-1);
    expect(smoke).toBeLessThan(login);
    expect(login).toBeLessThan(publish);
  });
});
