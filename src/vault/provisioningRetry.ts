import { randomInt } from "node:crypto";
import {
  readProvisioningManifest,
  replaceProvisioningManifest,
  updateManifestRetry,
} from "./provisioningManifest.js";
import {
  type VaultProvisioner,
  type VaultProvisioningResult,
} from "./provisioning.js";

const DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000] as const;

export interface ProvisioningRetryLoopOptions {
  provisioner: Pick<VaultProvisioner, "runOnce">;
  manifestFile: string;
  publish(result: VaultProvisioningResult): void;
  schedule?: (callback: () => void, delayMs: number) => unknown;
  cancel?: (handle: unknown) => void;
  jitter?: () => number;
}

export class VaultProvisioningRetryLoop {
  readonly #schedule: (callback: () => void, delayMs: number) => unknown;
  readonly #cancel: (handle: unknown) => void;
  readonly #jitter: () => number;
  #timer: unknown;
  #running = false;
  #stopped = false;
  #attempt = 0;

  constructor(private readonly options: ProvisioningRetryLoopOptions) {
    this.#schedule = options.schedule ?? ((callback, delayMs) =>
      setTimeout(callback, delayMs));
    this.#cancel = options.cancel ?? ((handle) =>
      clearTimeout(handle as NodeJS.Timeout));
    this.#jitter = options.jitter ?? (() => randomInt(0, 1_000_001) / 1_000_000);
  }

  start(): void {
    if (this.#stopped || this.#running || this.#timer !== undefined) return;
    this.#run();
  }

  stop(): void {
    this.#stopped = true;
    if (this.#timer !== undefined) {
      this.#cancel(this.#timer);
      this.#timer = undefined;
    }
  }

  #run(): void {
    if (this.#stopped || this.#running) return;
    this.#timer = undefined;
    this.#running = true;
    try {
      const result = this.options.provisioner.runOnce();
      this.options.publish(result);
      if (result.state !== "preparing") {
        this.#attempt = 0;
        return;
      }
      this.#attempt = Math.min(this.#attempt + 1, DELAYS_MS.length);
      this.#persistRetry();
      const base = DELAYS_MS[Math.min(this.#attempt - 1, DELAYS_MS.length - 1)]!;
      const jitter = 0.75 + Math.min(1, Math.max(0, this.#jitter())) * 0.5;
      const delay = Math.round(base * jitter);
      this.#timer = this.#schedule(() => this.#run(), delay);
    } finally {
      this.#running = false;
    }
  }

  #persistRetry(): void {
    try {
      const manifest = readProvisioningManifest(this.options.manifestFile);
      if (manifest.state !== "provisioning") return;
      replaceProvisioningManifest(
        this.options.manifestFile,
        updateManifestRetry(manifest, this.#attempt, true),
      );
    } catch {
      // The retry still re-reads all durable state and never gains authority
      // from this best-effort status snapshot.
    }
  }
}
