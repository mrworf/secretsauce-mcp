export class RestoreMaintenanceError extends Error {
  constructor(readonly code: "maintenance" | "conflict" | "timeout") {
    super(code);
    this.name = "RestoreMaintenanceError";
  }
}

export interface RestoreOrdinaryLease {
  release(): void;
}

export interface RestoreExclusiveLease {
  release(): void;
}

export class RestoreMaintenanceGate {
  #phase: "open" | "draining" | "exclusive" = "open";
  #active = 0;
  readonly #drained = new Set<() => void>();

  get phase(): "open" | "draining" | "exclusive" {
    return this.#phase;
  }

  get active(): number {
    return this.#active;
  }

  acquireOrdinary(): RestoreOrdinaryLease {
    if (this.#phase !== "open") {
      throw new RestoreMaintenanceError("maintenance");
    }
    this.#active += 1;
    let released = false;
    return {
      release: () => {
        if (released) return;
        released = true;
        this.#active -= 1;
        if (this.#active === 0) {
          for (const resolve of this.#drained) resolve();
          this.#drained.clear();
        }
      },
    };
  }

  async acquireExclusive(
    timeoutMs = 30_000,
    markMaintenance?: () => void | Promise<void>,
  ): Promise<RestoreExclusiveLease> {
    if (
      !Number.isSafeInteger(timeoutMs)
      || timeoutMs < 1
      || timeoutMs > 30_000
    ) throw new RestoreMaintenanceError("conflict");
    if (this.#phase !== "open") {
      throw new RestoreMaintenanceError("conflict");
    }
    this.#phase = "draining";
    try {
      if (this.#active !== 0) await this.#waitForDrain(timeoutMs);
      await markMaintenance?.();
      this.#phase = "exclusive";
    } catch (error) {
      this.#phase = "open";
      throw error;
    }
    let released = false;
    return {
      release: () => {
        if (released) return;
        released = true;
        this.#phase = "open";
      },
    };
  }

  async runOrdinary<T>(work: () => T | Promise<T>): Promise<T> {
    const lease = this.acquireOrdinary();
    try {
      return await work();
    } finally {
      lease.release();
    }
  }

  #waitForDrain(timeoutMs: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.#drained.delete(finish);
        resolve();
      };
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.#drained.delete(finish);
        reject(new RestoreMaintenanceError("timeout"));
      }, timeoutMs);
      timer.unref();
      this.#drained.add(finish);
    });
  }
}

export const RESTORE_MAINTENANCE_EXEMPT_ROUTE_IDS = new Set([
  "restores.read_stage",
  "restores.preview",
  "restores.commit",
]);
