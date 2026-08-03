import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

describe("release container deployment", () => {
  it("can compile native dependencies without shipping the toolchain", () => {
    const dockerfile = readFileSync("Dockerfile", "utf8");
    const runtime = dockerfile.slice(dockerfile.lastIndexOf("FROM node:22-alpine"));
    expect(dockerfile).toContain("FROM node:22-alpine AS native-build");
    expect(dockerfile).toContain("RUN apk add --no-cache python3 make g++");
    expect(dockerfile).toContain("FROM native-build AS deps");
    expect(dockerfile).toContain("FROM native-build AS build");
    expect(runtime).not.toMatch(/\b(?:python3|make|g\+\+)\b/);
  });

  it("runs the production image as an unprivileged read-only-compatible user", () => {
    const dockerfile = readFileSync("Dockerfile", "utf8");
    const runtime = dockerfile.slice(dockerfile.lastIndexOf("FROM node:22-alpine"));
    expect(runtime).toContain("USER node");
    expect(runtime).toContain("install -d -o node -g node -m 0700");
    expect(runtime).toContain("/var/lib/secretsauce/database");
    expect(runtime).toContain("/var/lib/secretsauce/audit");
    expect(runtime).toContain("/var/lib/secretsauce/oauth");
    expect(runtime).toContain("HEALTHCHECK");
    expect(runtime).toContain(
      "http://127.0.0.1:8080/health/live",
    );
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
    expect(gateway.healthcheck.test).toEqual([
      "CMD",
      "wget",
      "-qO-",
      "http://127.0.0.1:8080/health/live",
    ]);
    expect(gateway.volumes).toEqual(expect.arrayContaining([
      "./examples/config-v2.1.yaml:/config/config.yaml:ro",
      "secretsauce-database:/var/lib/secretsauce/database",
      "secretsauce-audit:/var/lib/secretsauce/audit",
      "secretsauce-oauth:/var/lib/secretsauce/oauth",
      "vault-generated:/var/lib/secretsauce/generated:ro",
      "vault-setup-state:/var/lib/secretsauce/setup:ro",
    ]));
    expect(gateway.environment.SECRETSAUCE_VAULT_CONTROL_KEY_FILE)
      .toBe("/var/lib/secretsauce/generated/shared/control-plane.key");
    expect(compose.services["secretsauce-vault"].volumes).toContain(
      "vault-store:/var/lib/secretsauce/vault",
    );
    for (const service of [gateway, compose.services["secretsauce-vault"]]) {
      expect(service.logging).toEqual({
        driver: "local",
        options: { "max-size": "10m", "max-file": "3" },
      });
    }
    expect(source).toContain("gref_/sec_ capability state is intentionally ephemeral");
    expect(gateway.volumes.join("\n")).not.toMatch(/gref|sec-token|capability-state/);
    expect(gateway.environment).not.toHaveProperty("SECRETSAUCE_MCP_TOKEN");
    expect(gateway.environment).not.toHaveProperty("SECRETSAUCE_RESTORE_DIRECTORY");
    expect(gateway.environment).not.toHaveProperty(
      "SECRETSAUCE_RESTORE_RECOVERY_KEY_FILE",
    );
    expect(source).toContain("Portable restore is opt-in");
  });

  it("provides a loopback-only Compose topology with production security parity", () => {
    const production = parse(
      readFileSync("docker-compose.example.yaml", "utf8"),
    ) as any;
    const source = readFileSync("docker-compose.local.yaml", "utf8");
    const local = parse(source) as any;
    const application = local.services.secretsauce;
    const vault = local.services["secretsauce-vault"];

    expect(Object.keys(local.services).sort()).toEqual(
      Object.keys(production.services).sort(),
    );
    expect(application.ports).toEqual([
      "127.0.0.1:8080:8080",
      "127.0.0.1:8081:8081",
    ]);
    expect(application.volumes).toContain(
      "./examples/config-v2.1.local.yaml:/config/config.yaml:ro",
    );
    expect(vault.network_mode).toBe("none");
    expect(vault).not.toHaveProperty("ports");
    expect(application.deploy.replicas).toBe(1);
    expect(application.healthcheck.test).toEqual(
      production.services.secretsauce.healthcheck.test,
    );
    expect(Object.keys(local.volumes).sort()).toEqual(
      Object.keys(production.volumes).sort(),
    );
    expect(application.volumes).toEqual(expect.arrayContaining([
      "secretsauce-database:/var/lib/secretsauce/database",
      "secretsauce-audit:/var/lib/secretsauce/audit",
      "secretsauce-oauth:/var/lib/secretsauce/oauth",
      "vault-generated:/var/lib/secretsauce/generated:ro",
      "vault-setup-state:/var/lib/secretsauce/setup:ro",
      "vault-runtime:/run/secretsauce-vault:ro",
    ]));
    expect(vault.volumes).toEqual(expect.arrayContaining([
      "vault-store:/var/lib/secretsauce/vault",
      "secretsauce-database:/inventory/database:ro",
      "secretsauce-audit:/inventory/audit:ro",
      "secretsauce-oauth:/inventory/oauth:ro",
    ]));
    expect(application.logging).toEqual(
      production.services.secretsauce.logging,
    );
    expect(vault.logging).toEqual(
      production.services["secretsauce-vault"].logging,
    );
    expect(source).not.toContain("docker.sock");
    expect(source).not.toContain("depends_on");

    const scripts = JSON.parse(readFileSync("package.json", "utf8"))
      .scripts as Record<string, string>;
    expect(scripts["local:up"]).toBe(
      "docker compose -f docker-compose.local.yaml up --build",
    );
    expect(scripts["local:down"]).toBe(
      "docker compose -f docker-compose.local.yaml down",
    );
    expect(scripts["local:logs"]).toBe(
      "docker compose -f docker-compose.local.yaml logs --follow secretsauce",
    );
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
    expect(smoke).toContain(
      "docker exec \"${container_name}\" stat -c '%s' /var/lib/secretsauce/audit/audit.jsonl",
    );
    expect(smoke).toContain("audit_size_after");
    expect(smoke).not.toContain('wc -c <"${audit_directory}/audit.jsonl"');
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

  it("audits production dependencies before build and tests", () => {
    const workflow = parse(readFileSync(".github/workflows/ci.yml", "utf8")) as any;
    const steps = workflow.jobs["quality-gates"].steps as Array<Record<string, unknown>>;
    const audit = steps.findIndex((step) => step.run === "npm run audit:production");
    const build = steps.findIndex((step) => step.run === "npm run build");
    const test = steps.findIndex((step) => step.run === "npm test");
    expect(audit).toBeGreaterThan(-1);
    expect(audit).toBeLessThan(build);
    expect(build).toBeLessThan(test);
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts["audit:production"])
      .toBe("npm audit --omit=dev --audit-level=high");
  });
});
