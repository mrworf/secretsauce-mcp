import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createProvisioningManifest,
  initialProvisioningManifest,
  readProvisioningManifest,
} from "../src/vault/provisioningManifest.js";
import { VaultProvisioningRetryLoop } from "../src/vault/provisioningRetry.js";
import {
  VAULT_PROVISIONING_KEY_IDS,
  createVaultProvisioningRegistry,
  type VaultProvisioningKeyPaths,
} from "../src/vault/provisioningRegistry.js";

describe("vault provisioning retry loop", () => {
  it("uses one jittered capped timer and re-runs from durable state", () => {
    const manifestFile = manifestFixture();
    const callbacks: (() => void)[] = [];
    const delays: number[] = [];
    const publish = vi.fn();
    let calls = 0;
    const loop = new VaultProvisioningRetryLoop({
      manifestFile,
      provisioner: {
        runOnce: () => {
          calls += 1;
          return {
            state: "preparing" as const,
            retryPending: true as const,
            errorCategory: "storage_unavailable" as const,
          };
        },
      },
      publish,
      jitter: () => 0.5,
      schedule: (callback, delay) => {
        callbacks.push(callback);
        delays.push(delay);
        return callback;
      },
      cancel: () => {},
    });
    loop.start();
    loop.start();
    for (let index = 0; index < 6; index += 1) callbacks[index]!();
    expect(delays).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]);
    expect(calls).toBe(7);
    expect(publish).toHaveBeenCalledTimes(7);
    expect(readProvisioningManifest(manifestFile).retry)
      .toEqual({ attempt: 6, retryPending: true });
  });

  it("honors jitter bounds, stops terminal state, and cancels shutdown timer", () => {
    for (const [jitter, expected] of [[0, 750], [1, 1_250]] as const) {
      const scheduled: number[] = [];
      let callback: (() => void) | undefined;
      const cancel = vi.fn();
      const loop = new VaultProvisioningRetryLoop({
        manifestFile: manifestFixture(),
        provisioner: {
          runOnce: () => ({
            state: "preparing" as const,
            retryPending: true as const,
            errorCategory: "storage_unavailable" as const,
          }),
        },
        publish: () => {},
        jitter: () => jitter,
        schedule: (next, delay) => {
          callback = next;
          scheduled.push(delay);
          return 42;
        },
        cancel,
      });
      loop.start();
      expect(scheduled).toEqual([expected]);
      loop.stop();
      expect(cancel).toHaveBeenCalledWith(42);
      callback!();
      expect(scheduled).toHaveLength(1);
    }

    const scheduled = vi.fn();
    const terminal = new VaultProvisioningRetryLoop({
      manifestFile: manifestFixture(),
      provisioner: {
        runOnce: () => ({
          state: "configuration_error" as const,
          retryPending: false as const,
          errorCategory: "state_mismatch" as const,
        }),
      },
      publish: () => {},
      schedule: scheduled,
    });
    terminal.start();
    expect(scheduled).not.toHaveBeenCalled();
  });
});

function manifestFixture(): string {
  const directory = mkdtempSync(join(tmpdir(), "vault-retry-"));
  chmodSync(directory, 0o700);
  const keys = join(directory, "keys");
  mkdirSync(keys, { mode: 0o700 });
  const paths = Object.fromEntries(VAULT_PROVISIONING_KEY_IDS.map((id) => [
    id,
    join(keys, id),
  ])) as VaultProvisioningKeyPaths;
  const file = join(directory, "manifest.json");
  createProvisioningManifest(
    file,
    initialProvisioningManifest(createVaultProvisioningRegistry(paths)),
  );
  return file;
}
