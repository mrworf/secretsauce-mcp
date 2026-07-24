import {
  ApiKeyError,
  type ActiveApiKeyCandidate,
  type ApiKeyAuthenticationCandidate,
  type ApiKeyRepository,
  ApiKeyVerifierPool,
  generateApiKey,
  hashApiKey,
  parseApiKey,
} from "./apiKeys.js";

const CANDIDATE_PATTERN =
  /ssk_v1_[A-Za-z0-9_-]{16}_[A-Za-z0-9_-]{43}/g;
const TOKEN_CHARACTER = /[A-Za-z0-9_-]/;
const MAX_CANDIDATES = 16;
const MAX_VISITED_VALUES = 10_000;
const MAX_DEPTH = 64;

export type SelfApiKeyLocation = "header" | "query" | "body" | "credential";

export class SelfApiKeyProtectionError extends Error {
  constructor(
    readonly code:
      | "candidate_limit"
      | "rate_limited"
      | "unavailable",
  ) {
    super("Self API key protection could not complete.");
    this.name = "SelfApiKeyProtectionError";
  }
}

export interface StructuralApiKeyCandidate {
  value: string;
  identifier: string;
  location: SelfApiKeyLocation;
}

export interface ActiveSelfApiKeyMatch extends ActiveApiKeyCandidate {
  location: SelfApiKeyLocation;
}

export interface SelfApiKeyCandidateRepository {
  authenticationCandidate(
    identifier: string,
  ): Promise<ApiKeyAuthenticationCandidate | undefined>;
  activeVerifiedCandidate(input: {
    candidate: ApiKeyAuthenticationCandidate;
    verified: boolean;
  }): Promise<ActiveApiKeyCandidate | undefined>;
}

interface LimitEntry {
  startedAt: number;
  count: number;
}

export class SelfApiKeyVerificationLimiter {
  readonly #entries = new Map<string, LimitEntry>();

  constructor(
    private readonly maximumPerWindow = 20,
    private readonly windowMs = 60_000,
    private readonly maximumEntries = 10_000,
    private readonly now: () => number = Date.now,
  ) {
    if (
      !Number.isInteger(maximumPerWindow) ||
      maximumPerWindow < 1 ||
      maximumPerWindow > 1_000 ||
      !Number.isSafeInteger(windowMs) ||
      windowMs < 1_000 ||
      windowMs > 86_400_000 ||
      !Number.isInteger(maximumEntries) ||
      maximumEntries < 1 ||
      maximumEntries > 100_000
    ) throw new Error("Invalid self API key verifier limits.");
  }

  acquire(principal: string, source: string): void {
    if (
      principal.length < 1 ||
      principal.length > 256 ||
      source.length < 1 ||
      source.length > 256 ||
      /[\0\r\n]/.test(principal) ||
      /[\0\r\n]/.test(source)
    ) throw new SelfApiKeyProtectionError("rate_limited");
    this.#increment(`principal:${principal}`);
    try {
      this.#increment(`source:${source}`);
    } catch (error) {
      this.#decrement(`principal:${principal}`);
      throw error;
    }
  }

  #increment(key: string): void {
    const now = this.now();
    let entry = this.#entries.get(key);
    if (entry !== undefined && now - entry.startedAt >= this.windowMs) {
      this.#entries.delete(key);
      entry = undefined;
    }
    if (entry === undefined) {
      if (this.#entries.size >= this.maximumEntries) {
        this.#sweep(now);
      }
      if (this.#entries.size >= this.maximumEntries) {
        throw new SelfApiKeyProtectionError("rate_limited");
      }
      this.#entries.set(key, { startedAt: now, count: 1 });
      return;
    }
    if (entry.count >= this.maximumPerWindow) {
      throw new SelfApiKeyProtectionError("rate_limited");
    }
    entry.count += 1;
  }

  #decrement(key: string): void {
    const entry = this.#entries.get(key);
    if (entry === undefined) return;
    entry.count -= 1;
    if (entry.count === 0) this.#entries.delete(key);
  }

  #sweep(now: number): void {
    for (const [key, entry] of this.#entries) {
      if (now - entry.startedAt >= this.windowMs) this.#entries.delete(key);
    }
  }
}

export class ActiveSelfApiKeyDetector {
  private constructor(
    private readonly repository: SelfApiKeyCandidateRepository,
    private readonly verifier: ApiKeyVerifierPool,
    private readonly dummyVerifier: string,
    private readonly limiter: SelfApiKeyVerificationLimiter,
  ) {}

  static async create(
    repository: ApiKeyRepository | SelfApiKeyCandidateRepository,
    verifier = new ApiKeyVerifierPool(),
    limiter = new SelfApiKeyVerificationLimiter(),
  ): Promise<ActiveSelfApiKeyDetector> {
    const generated = generateApiKey();
    const dummyVerifier = await hashApiKey(generated.raw);
    return new ActiveSelfApiKeyDetector(
      repository,
      verifier,
      dummyVerifier,
      limiter,
    );
  }

  async inspect(
    values: readonly { value: unknown; location: SelfApiKeyLocation }[],
    binding: { principal: string; source: string },
  ): Promise<ActiveSelfApiKeyMatch[]> {
    const candidates = scanStructuralApiKeyCandidates(values);
    if (candidates.length === 0) return [];
    const matches: ActiveSelfApiKeyMatch[] = [];
    for (const candidate of candidates) {
      this.limiter.acquire(binding.principal, binding.source);
      let parsed;
      try {
        parsed = parseApiKey(candidate.value);
      } catch {
        continue;
      }
      try {
        const stored = await this.repository.authenticationCandidate(
          parsed.identifier,
        );
        const verified = await this.verifier.check(
          parsed.raw,
          stored?.verifierHash ?? this.dummyVerifier,
        );
        if (stored === undefined) continue;
        const active = await this.repository.activeVerifiedCandidate({
          candidate: stored,
          verified,
        });
        if (active !== undefined) {
          matches.push({ ...active, location: candidate.location });
        }
      } catch (error) {
        parsed.raw.fill(0);
        if (error instanceof ApiKeyError && error.code === "rate_limited") {
          throw new SelfApiKeyProtectionError("rate_limited");
        }
        if (error instanceof ApiKeyError && error.code === "unavailable") {
          throw new SelfApiKeyProtectionError("unavailable");
        }
        throw error;
      }
    }
    return matches;
  }
}

export function scanStructuralApiKeyCandidates(
  roots: readonly { value: unknown; location: SelfApiKeyLocation }[],
): StructuralApiKeyCandidate[] {
  const found: StructuralApiKeyCandidate[] = [];
  const seen = new Set<string>();
  const visited = new WeakSet<object>();
  let visitedValues = 0;

  const visit = (
    value: unknown,
    location: SelfApiKeyLocation,
    depth: number,
  ): void => {
    visitedValues += 1;
    if (visitedValues > MAX_VISITED_VALUES || depth > MAX_DEPTH) {
      throw new SelfApiKeyProtectionError("candidate_limit");
    }
    if (typeof value === "string") {
      for (const match of value.matchAll(CANDIDATE_PATTERN)) {
        const candidate = match[0];
        const index = match.index;
        if (
          index === undefined ||
          (index > 0 && TOKEN_CHARACTER.test(value[index - 1]!)) ||
          (
            index + candidate.length < value.length &&
            TOKEN_CHARACTER.test(value[index + candidate.length]!)
          )
        ) continue;
        let parsed;
        try {
          parsed = parseApiKey(candidate);
        } catch {
          continue;
        }
        parsed.raw.fill(0);
        const identity = `${location}\0${candidate}`;
        if (seen.has(identity)) continue;
        if (found.length >= MAX_CANDIDATES) {
          throw new SelfApiKeyProtectionError("candidate_limit");
        }
        seen.add(identity);
        found.push({ value: candidate, identifier: parsed.identifier, location });
      }
      return;
    }
    if (value === null || typeof value !== "object") return;
    if (Buffer.isBuffer(value) || ArrayBuffer.isView(value)) return;
    if (visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      for (const child of value) visit(child, location, depth + 1);
      return;
    }
    for (const child of Object.values(value as Record<string, unknown>)) {
      visit(child, location, depth + 1);
    }
  };

  for (const root of roots) visit(root.value, root.location, 0);
  return found;
}
