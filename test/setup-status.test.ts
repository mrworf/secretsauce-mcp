import { describe, expect, it, vi } from "vitest";
import {
  SetupStatusMonitor,
  SetupStatusPollingLoop,
  projectVaultSetupStatus,
  vaultSetupStatusMonitor,
} from "../src/setup/status.js";

describe("bounded setup status", () => {
  it("maps the closed private states without exposing error detail", () => {
    expect(projectVaultSetupStatus({
      state: "preparing",
      retryPending: true,
      errorCategory: "storage_unavailable",
    })).toEqual({
      state: "preparing",
      message: "SecretSauce is preparing this installation.",
      retryPending: true,
    });
    expect(projectVaultSetupStatus({
      state: "ready",
      retryPending: false,
    }).state).toBe("available");
    const fatal = projectVaultSetupStatus({
      state: "configuration_error",
      retryPending: false,
      errorCategory: "state_mismatch",
    });
    expect(fatal).toEqual({
      state: "not_ready",
      message:
        "SecretSauce needs operator attention before setup can continue.",
      retryPending: false,
    });
    expect(JSON.stringify(fatal)).not.toContain("state_mismatch");
  });

  it("coalesces concurrent refreshes and fails closed on status loss", async () => {
    let resolve!: (value: {
      state: "preparing";
      retryPending: boolean;
    }) => void;
    const read = vi.fn(() => new Promise<{
      state: "preparing";
      retryPending: boolean;
    }>((complete) => {
      resolve = complete;
    }));
    const monitor = new SetupStatusMonitor(read);
    const first = monitor.refresh();
    const second = monitor.refresh();
    expect(read).toHaveBeenCalledOnce();
    resolve({ state: "preparing", retryPending: true });
    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ state: "preparing", retryPending: true }),
      expect.objectContaining({ state: "preparing", retryPending: true }),
    ]);

    const unavailable = new SetupStatusMonitor(async () => {
      throw new Error("private details must not escape");
    });
    await expect(unavailable.refresh()).resolves.toEqual({
      state: "not_ready",
      message:
        "SecretSauce needs operator attention before setup can continue.",
      retryPending: false,
    });
  });

  it("accepts only complete bounded environment configuration", () => {
    expect(() => vaultSetupStatusMonitor({
      SECRETSAUCE_VAULT_STATUS_SOCKET: "/run/vault/status.sock",
      SECRETSAUCE_VAULT_OWNER_UID: "1001",
      SECRETSAUCE_SETUP_STATUS_TIMEOUT_MS: "2000",
    })).not.toThrow();
    for (const environment of [
      {},
      {
        SECRETSAUCE_VAULT_STATUS_SOCKET: "/run/vault/status.sock",
        SECRETSAUCE_VAULT_OWNER_UID: "-1",
      },
      {
        SECRETSAUCE_VAULT_STATUS_SOCKET: "/run/vault/status.sock",
        SECRETSAUCE_SETUP_STATUS_TIMEOUT_MS: "99",
      },
      {
        SECRETSAUCE_VAULT_STATUS_SOCKET: "/run/vault/status.sock",
        SECRETSAUCE_SETUP_STATUS_TIMEOUT_MS: "5001",
      },
    ]) {
      expect(() => vaultSetupStatusMonitor(environment)).toThrow();
    }
  });

  it("polls one request at a time with capped bounded backoff", async () => {
    const delays: number[] = [];
    const callbacks: (() => void)[] = [];
    const monitor = new SetupStatusMonitor(async () => ({
      state: "preparing",
      retryPending: true,
    }));
    const published: string[] = [];
    const loop = new SetupStatusPollingLoop(
      monitor,
      (status) => published.push(status.state),
      ((callback: () => void, delay: number) => {
        callbacks.push(callback);
        delays.push(delay);
        return callbacks.length as unknown as ReturnType<typeof setTimeout>;
      }),
      vi.fn(),
    );
    loop.start();
    await vi.waitFor(() => expect(callbacks).toHaveLength(1));
    for (let index = 0; index < 6; index += 1) {
      callbacks.shift()!();
      await vi.waitFor(() => expect(callbacks).toHaveLength(1));
    }
    expect(delays).toEqual([250, 500, 1_000, 2_000, 5_000, 5_000, 5_000]);
    expect(published).toHaveLength(7);
    loop.stop();
    expect(callbacks).toHaveLength(1);
  });
});
