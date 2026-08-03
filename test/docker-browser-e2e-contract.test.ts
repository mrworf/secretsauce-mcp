import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

describe("Docker browser end-to-end contract", () => {
  it("owns and cleans one exact disposable Compose project", () => {
    const setup = readFileSync("test/e2e/global-setup.mjs", "utf8");
    expect(setup).toContain("SECRETSAUCE_E2E_COMPOSE_PROJECT = project");
    expect(setup).toContain('`secretsauce-e2e-${process.pid}-');
    expect(setup).toContain('"--detach"');
    expect(setup).toContain('"--volumes"');
    expect(setup).toContain('"--remove-orphans"');
    expect(setup).toMatch(/function cleanup\(project\)[\s\S]*?"-p",\s*project/);
    expect(setup).not.toMatch(/down[\s\S]*?process\.env/);
  });

  it("disables sensitive browser artifacts and keeps Docker logs private", () => {
    const config = readFileSync("playwright.config.ts", "utf8");
    const journey = readFileSync("test/e2e/docker-browser.e2e.ts", "utf8");
    expect(config).toContain('trace: "off"');
    expect(config).toContain('screenshot: "off"');
    expect(config).toContain('video: "off"');
    expect(config).toContain("workers: 1");
    expect(journey).toContain('stdio: ["ignore", "pipe", "ignore"]');
    expect(journey).toContain("invalid-enrollment-code");
    expect(journey).toContain("setSensitiveValue");
    expect(journey).not.toMatch(/console\.(?:log|error|warn)/);
    expect(journey).not.toMatch(/\.fill\((?:enrollmentSecret|password|totpCode)/);
  });

  it("runs the browser gate before image publication", () => {
    const workflow = parse(readFileSync(".github/workflows/ci.yml", "utf8")) as any;
    const browser = workflow.jobs["docker-browser-e2e"];
    expect(browser.needs).toBe("quality-gates");
    expect(browser.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        run: "npx playwright install --with-deps chromium",
      }),
      expect.objectContaining({ run: "npm run test:e2e:docker" }),
    ]));
    expect(workflow.jobs["docker-image"].needs).toEqual([
      "quality-gates",
      "docker-browser-e2e",
    ]);

    const scripts = JSON.parse(readFileSync("package.json", "utf8"))
      .scripts as Record<string, string>;
    expect(scripts["test:e2e:docker"]).toBe(
      "playwright test --config playwright.config.ts",
    );
  });
});
