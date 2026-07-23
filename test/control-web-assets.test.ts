import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  installControlWebRoutes,
  loadControlWebAssets,
} from "../src/control/webAssets.js";
import { createControlApplication } from "../src/control/server.js";
import { validateConfig } from "../src/config.js";
import type { GatewayConfig } from "../src/types.js";

describe("built control web assets", () => {
  it("loads the production build and serves hashed assets with a bounded SPA fallback", async () => {
    const webAssets = loadControlWebAssets();
    const application = createControlApplication(controlConfig(), { webAssets });
    try {
      const index = await application.inject({
        method: "GET",
        url: "/control/services",
        headers: { host: "control.example.org" },
      });
      expect(index.statusCode).toBe(200);
      expect(index.headers["content-type"]).toContain("text/html");
      expect(index.headers["cache-control"]).toBe("no-store");
      expect(index.body).toContain('<div id="root"></div>');
      expect(index.body).not.toMatch(/<script(?![^>]*\bsrc=)/i);

      const assetName = [...webAssets.assets.keys()].find((name) => name.endsWith(".js"));
      expect(assetName).toBeDefined();
      const asset = await application.inject({
        method: "GET",
        url: `/control/assets/${assetName}`,
        headers: { host: "control.example.org" },
      });
      expect(asset.statusCode).toBe(200);
      expect(asset.headers["content-type"]).toContain("text/javascript");
      expect(asset.headers["cache-control"]).toBe("public, max-age=31536000, immutable");

      for (const url of [
        "/control/assets/not-built.js",
        "/control/assets/%2e%2e%2findex.html",
        "/control/nested/unbounded",
      ]) {
        const rejected = await application.inject({
          method: "GET",
          url,
          headers: { host: "control.example.org" },
        });
        expect([400, 404]).toContain(rejected.statusCode);
        expect(rejected.body).not.toContain('<div id="root"></div>');
      }
    } finally {
      await application.close();
    }
  });

  it("rejects missing, unbounded, inline, unreferenced, and linked build inputs safely", () => {
    const directory = fixtureDirectory("invalid");
    mkdirSync(join(directory, "assets"));
    writeFileSync(join(directory, "index.html"), "<!doctype html><div id=\"root\"></div>");
    expect(() => loadControlWebAssets(directory)).toThrow("Control web assets are unavailable.");

    writeFileSync(join(directory, "assets", "index-abcdefgh.js"), "export {}");
    expect(() => loadControlWebAssets(directory)).toThrow("Control web assets are unavailable.");

    writeFileSync(
      join(directory, "index.html"),
      '<!doctype html><div id="root"></div><script src="/control/assets/index-abcdefgh.js"></script>',
    );
    expect(loadControlWebAssets(directory).assets.size).toBe(1);

    writeFileSync(
      join(directory, "index.html"),
      '<!doctype html><script>globalThis.inline = true</script><script src="/control/assets/index-abcdefgh.js"></script>',
    );
    expect(() => loadControlWebAssets(directory)).toThrow("Control web assets are unavailable.");

    writeFileSync(
      join(directory, "index.html"),
      '<!doctype html><script src="/control/assets/index-abcdefgh.js"></script>',
    );
    writeFileSync(join(directory, "assets", "index-abcdefgh.js"), Buffer.alloc(2 * 1024 * 1024 + 1));
    expect(() => loadControlWebAssets(directory)).toThrow("Control web assets are unavailable.");

    const linkedDirectory = fixtureDirectory("linked");
    mkdirSync(join(linkedDirectory, "assets"));
    writeFileSync(
      join(linkedDirectory, "index.html"),
      '<!doctype html><script src="/control/assets/index-abcdefgh.js"></script>',
    );
    symlinkSync(join(directory, "assets", "index-abcdefgh.js"), join(linkedDirectory, "assets", "index-abcdefgh.js"));
    expect(() => loadControlWebAssets(linkedDirectory)).toThrow(
      "Control web assets are unavailable.",
    );
  });
});

function fixtureDirectory(name: string): string {
  return mkdtempSync(join(tmpdir(), `secretsauce-control-web-${name}-`));
}

function controlConfig(): GatewayConfig {
  const directory = fixtureDirectory("config");
  const keyFile = join(directory, "idempotency.key");
  writeFileSync(keyFile, `${Buffer.alloc(32, 9).toString("base64url")}\n`, { mode: 0o600 });
  return validateConfig({
    server: {
      listen: "127.0.0.1:8080",
      mcp_path: "/mcp",
      resource: "https://mcp.example.org",
    },
    control: {
      listen: "127.0.0.1:8081",
      public_origin: "https://control.example.org",
      idempotency_hmac_key_file: keyFile,
    },
    persistence: { database_file: join(directory, "control.sqlite") },
    auth: {
      mode: "bearer",
      bearer: { token_env: "TEST_GATEWAY_TOKEN" },
    },
    services: {
      demo: {
        type: "http",
        name: "Demo",
        no_auth: true,
        destinations: [{ name: "primary", base_url: "https://api.example.org" }],
      },
    },
  }, { TEST_GATEWAY_TOKEN: "test-token" });
}
