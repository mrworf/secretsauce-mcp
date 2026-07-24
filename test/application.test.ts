import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  startSecretSauceApplication,
  type SecretSauceApplication,
} from "../src/application.js";
import { validateConfig } from "../src/config.js";
import { PersistenceWorker } from "../src/persistence/worker.js";

const applications: SecretSauceApplication[] = [];

afterEach(async () => {
  await Promise.allSettled(
    applications.splice(0).map((application) => application.close()),
  );
});

describe("combined SecretSauce application", () => {
  it("shares only the bounded runtime aggregate seam with control", () => {
    const source = readFileSync("src/application.ts", "utf8");
    expect(source).toContain(
      "referenceAggregates: runtime.capabilities.tokenBroker",
    );
    expect(source).not.toContain("runtime.capabilities.tokenBroker.records");
  });

  it("serves gateway and control listeners through one database owner", async () => {
    const dataPort = await unusedPort();
    const controlPort = await unusedPort();
    const config = combinedConfig(dataPort, controlPort);
    const application = await startSecretSauceApplication(config, {});
    applications.push(application);

    const gatewayHealth = await request(dataPort, "/health", "mcp.example.org");
    expect(gatewayHealth.statusCode).toBe(200);
    const gatewayControl = await request(
      dataPort,
      "/api/v2/health",
      "mcp.example.org",
    );
    expect(gatewayControl.statusCode).toBe(404);

    const controlHealth = await request(
      controlPort,
      "/api/v2/health",
      "control.example.org",
    );
    expect(controlHealth.statusCode).toBe(200);
    const controlMcp = await request(
      controlPort,
      "/mcp",
      "control.example.org",
    );
    expect(controlMcp.statusCode).toBe(401);

    expect(() => PersistenceWorker.open({
      databaseFile: config.persistence!.databaseFile,
      productVersion: "test",
    })).toThrow();
    await application.close();
    applications.pop();
    const reopened = PersistenceWorker.open({
      databaseFile: config.persistence!.databaseFile,
      productVersion: "test",
    });
    await reopened.close();
  });

  it("closes the control listener and shared database when gateway startup fails", async () => {
    const dataPort = await unusedPort();
    const controlPort = await unusedPort();
    const blocker = createNetServer();
    await new Promise<void>((resolve, reject) => {
      blocker.once("error", reject);
      blocker.listen(dataPort, "127.0.0.1", resolve);
    });
    const config = combinedConfig(dataPort, controlPort);
    try {
      await expect(startSecretSauceApplication(config, {})).rejects.toBeDefined();
      await expect(request(
        controlPort,
        "/api/v2/health",
        "control.example.org",
      )).rejects.toBeDefined();
      const reopened = PersistenceWorker.open({
        databaseFile: config.persistence!.databaseFile,
        productVersion: "test",
      });
      await reopened.close();
    } finally {
      await new Promise<void>((resolve, reject) => {
        blocker.close((error) => error ? reject(error) : resolve());
      });
    }
  });
});

function combinedConfig(dataPort: number, controlPort: number) {
  const directory = mkdtempSync(
    join(tmpdir(), "secretsauce-application-test-"),
  );
  const idempotencyKey = join(directory, "idempotency.key");
  writeFileSync(
    idempotencyKey,
    `${Buffer.alloc(32, 117).toString("base64url")}\n`,
    { mode: 0o600 },
  );
  chmodSync(idempotencyKey, 0o600);
  return validateConfig({
    server: {
      listen: `127.0.0.1:${dataPort}`,
      mcp_path: "/mcp",
      resource: "https://mcp.example.org",
    },
    control: {
      listen: `127.0.0.1:${controlPort}`,
      public_origin: "https://control.example.org",
      idempotency_hmac_key_file: idempotencyKey,
    },
    persistence: {
      database_file: join(directory, "control.sqlite"),
    },
    auth: {
      mode: "bearer",
      bearer: { token_env: "APPLICATION_FIXTURE_TOKEN" },
    },
    services: {
      demo: {
        type: "http",
        name: "Demo",
        no_auth: true,
        destinations: [{
          name: "primary",
          base_url: "https://api.example.org",
        }],
      },
    },
  }, {
    APPLICATION_FIXTURE_TOKEN: "synthetic-application-token",
  });
}

async function unusedPort(): Promise<number> {
  const server = createNetServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  return address.port;
}

async function request(
  port: number,
  path: string,
  host: string,
): Promise<{ statusCode: number; body: string }> {
  const { request: httpRequest } = await import("node:http");
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      host: "127.0.0.1",
      port,
      path,
      method: "GET",
      headers: { host },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => resolve({
        statusCode: response.statusCode ?? 0,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
    });
    request.once("error", reject);
    request.end();
  });
}
