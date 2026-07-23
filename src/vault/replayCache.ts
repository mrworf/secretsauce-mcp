import { vaultError } from "./errors.js";

export class BoundedReplayCache {
  readonly #entries = new Map<string, number>();
  readonly #capacity: number;

  constructor(capacity = 65_536) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error("Replay capacity must be positive.");
    this.#capacity = capacity;
  }

  consume(key: string, expiresAt: number, now = Date.now()): void {
    this.#prune(now);
    if (this.#entries.has(key)) throw vaultError("vault_replay_detected");
    if (this.#entries.size >= this.#capacity) throw vaultError("vault_capacity_exceeded");
    this.#entries.set(key, expiresAt);
  }

  get size(): number {
    return this.#entries.size;
  }

  #prune(now: number): void {
    for (const [key, expiresAt] of this.#entries) {
      if (expiresAt <= now) this.#entries.delete(key);
    }
  }
}
