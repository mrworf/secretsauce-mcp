export type ControlRateLimitClass = "none" | "authentication" | "management" | "search";

export interface ControlRateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

interface RateWindow {
  count: number;
  resetAt: number;
}

const limits: Record<Exclude<ControlRateLimitClass, "none">, number> = {
  authentication: 30,
  management: 120,
  search: 30,
};

export class ControlRateLimiter {
  readonly #entries = new Map<string, RateWindow>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly maxEntries = 10_000,
  ) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new Error("maxEntries must be positive.");
  }

  check(
    rateClass: ControlRateLimitClass,
    directSource: string,
    principalId?: string,
  ): ControlRateLimitResult {
    if (rateClass === "none") return { allowed: true };
    const now = this.safeNow();
    this.prune(now);
    const keys = [
      `${rateClass}:source:${safeIdentity(directSource)}`,
      ...(principalId === undefined ? [] : [`${rateClass}:principal:${safeIdentity(principalId)}`]),
    ];
    const limit = limits[rateClass];
    let retryAfterSeconds = 0;
    for (const key of keys) {
      const window = this.#entries.get(key);
      if (window !== undefined && window.resetAt > now && window.count >= limit) {
        retryAfterSeconds = Math.max(retryAfterSeconds, Math.ceil((window.resetAt - now) / 1000));
      }
    }
    if (retryAfterSeconds > 0) return { allowed: false, retryAfterSeconds };
    const newEntryCount = keys.filter((key) => {
      const window = this.#entries.get(key);
      return window === undefined || window.resetAt <= now;
    }).length;
    if (this.#entries.size + newEntryCount > this.maxEntries) {
      return { allowed: false, retryAfterSeconds: 60 };
    }
    for (const key of keys) {
      const window = this.#entries.get(key);
      if (window === undefined || window.resetAt <= now) {
        this.#entries.set(key, { count: 1, resetAt: now + 60_000 });
      } else {
        window.count += 1;
      }
    }
    return { allowed: true };
  }

  private prune(now: number): void {
    for (const [key, window] of this.#entries) {
      if (window.resetAt <= now) this.#entries.delete(key);
    }
  }

  private safeNow(): number {
    const value = Math.trunc(this.now());
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid rate-limit clock.");
    return value;
  }
}

function safeIdentity(value: string): string {
  if (value.length < 1 || value.length > 256 || /[\r\n\0]/.test(value)) {
    throw new Error("Invalid rate-limit identity.");
  }
  return value;
}
