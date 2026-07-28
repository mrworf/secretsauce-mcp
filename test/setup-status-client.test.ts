import {
  chmodSync,
  mkdtempSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import {
  readVaultProvisioningStatusDetails,
} from "../src/vault/client.js";
import { runVaultHealthCli } from "../src/vault/healthCli.js";

const servers = new Set<Server>();

afterEach(async () => {
  await Promise.all([...servers].map(close));
  servers.clear();
});

describe("private setup status client", () => {
  it("accepts the exact bounded status representation", async () => {
    const fixture = await server(() => ({
      status: 200,
      type: "application/json; charset=utf-8",
      body: {
        state: "preparing",
        retry_pending: true,
        error_category: "storage_unavailable",
      },
    }));
    await expect(readVaultProvisioningStatusDetails(fixture, {
      timeoutMs: 500,
    })).resolves.toEqual({
      state: "preparing",
      retryPending: true,
      errorCategory: "storage_unavailable",
    });
  });

  it("rejects absent, timed-out, and malformed private status", async () => {
    const directory = mkdtempSync(join(tmpdir(), "setup-status-absent-"));
    chmodSync(directory, 0o700);
    await expect(readVaultProvisioningStatusDetails(
      join(directory, "absent.sock"),
      { timeoutMs: 100 },
    )).rejects.toThrow();

    const timedOut = await server(() => undefined);
    await expect(readVaultProvisioningStatusDetails(timedOut, {
      timeoutMs: 100,
    })).rejects.toThrow();

    for (const response of [
      {
        status: 200,
        type: "text/plain",
        body: { state: "ready", retry_pending: false },
      },
      {
        status: 200,
        type: "application/json",
        body: { state: "ready", retry_pending: true },
      },
      {
        status: 200,
        type: "application/json",
        body: {
          state: "configuration_error",
          retry_pending: false,
        },
      },
      {
        status: 200,
        type: "application/json",
        body: {
          state: "preparing",
          retry_pending: true,
          error_category: "raw_internal_failure",
        },
      },
    ] as const) {
      const socket = await server(() => response);
      await expect(readVaultProvisioningStatusDetails(socket, {
        timeoutMs: 500,
      })).rejects.toThrow();
      await close([...servers].at(-1)!);
      servers.delete([...servers].at(-1)!);
    }
  });

  it("rejects timeout bounds before endpoint I/O", async () => {
    for (const timeoutMs of [99, 5_001, 1.5, Number.NaN]) {
      await expect(readVaultProvisioningStatusDetails(
        "/private/status.sock",
        { timeoutMs },
      )).rejects.toThrow();
    }
  });

  it("treats a responsive preparing vault as live but not ready", async () => {
    const socket = await server(() => ({
      status: 200,
      type: "application/json",
      body: {
        state: "preparing",
        retry_pending: true,
        error_category: "storage_unavailable",
      },
    }));
    const liveOutput: string[] = [];
    await expect(runVaultHealthCli({
      SECRETSAUCE_VAULT_STATUS_SOCKET: socket,
      SECRETSAUCE_VAULT_HEALTH_MODE: "liveness",
    }, (value) => liveOutput.push(value))).resolves.toBe(0);
    expect(liveOutput).toEqual(['{"status":"live"}\n']);

    const readyOutput: string[] = [];
    await expect(runVaultHealthCli({
      SECRETSAUCE_VAULT_STATUS_SOCKET: socket,
    }, (value) => readyOutput.push(value))).resolves.toBe(1);
    expect(readyOutput).toEqual(['{"status":"unavailable"}\n']);
  });

  it("rejects unknown vault health modes without exposing configuration", async () => {
    const output: string[] = [];
    await expect(runVaultHealthCli({
      SECRETSAUCE_VAULT_STATUS_SOCKET: "/private/status.sock",
      SECRETSAUCE_VAULT_HEALTH_MODE: "unknown",
    }, (value) => output.push(value))).resolves.toBe(1);
    expect(output).toEqual(['{"status":"unavailable"}\n']);
  });
});

async function server(
  result: () => {
    status: number;
    type: string;
    body: unknown;
  } | undefined,
): Promise<string> {
  const directory = mkdtempSync(join(tmpdir(), "setup-status-client-"));
  chmodSync(directory, 0o700);
  const socket = join(directory, "status.sock");
  const value = createServer((_request, response) => {
    const next = result();
    if (next === undefined) return;
    response.writeHead(next.status, { "content-type": next.type });
    response.end(`${JSON.stringify(next.body)}\n`);
  });
  servers.add(value);
  await new Promise<void>((resolve, reject) => {
    value.once("error", reject);
    value.listen(socket, resolve);
  });
  chmodSync(socket, 0o600);
  return socket;
}

function close(server: Server): Promise<void> {
  if (!server.listening) return Promise.resolve();
  return new Promise((resolve) => server.close(() => resolve()));
}
