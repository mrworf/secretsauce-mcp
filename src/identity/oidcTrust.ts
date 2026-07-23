import { lookup as dnsLookup } from "node:dns/promises";
import { readFileSync } from "node:fs";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import {
  createLocalJWKSet,
  jwtVerify,
  type JSONWebKeySet,
  type JWTPayload,
} from "jose";
import { InflightLimiter } from "../inflightLimiter.js";
import { isPublicMetadataAddress } from "../oauthClientMetadata.js";
import type { IdentityConfig, OidcProviderConfig } from "../types.js";
import { normalizeVerifiedOidcClaims } from "./oidcAssurance.js";
import type { ProviderAssertion } from "./provider.js";

const MAX_CACHE_TTL_MS = 60 * 60_000;
const DEFAULT_CACHE_TTL_MS = 5 * 60_000;

export interface OidcNetworkAddress {
  address: string;
  family: 4 | 6;
}

export interface OidcNetworkRequest {
  url: URL;
  address: OidcNetworkAddress;
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: Uint8Array;
  timeoutMs: number;
  maxBodyBytes: number;
}

export interface OidcNetworkResponse {
  status: number;
  headers: Headers;
  body: Uint8Array;
  url: string;
}

export interface OidcNetwork {
  resolve(hostname: string): Promise<OidcNetworkAddress[]>;
  request(input: OidcNetworkRequest): Promise<OidcNetworkResponse>;
}

export interface OidcDiscovery {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
  tokenEndpointAuthMethods: string[];
  signingAlgorithms: Array<"RS256" | "ES256">;
}

export interface OidcJwkSet {
  keys: Array<Record<string, unknown>>;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class OidcTrustError extends Error {
  constructor() {
    super("OIDC provider trust is unavailable.");
    this.name = "OidcTrustError";
  }
}

export class OidcTrustClient {
  readonly #limiter: InflightLimiter;
  readonly #discovery = new Map<string, CacheEntry<OidcDiscovery>>();
  readonly #jwks = new Map<string, CacheEntry<OidcJwkSet>>();

  constructor(
    private readonly limits: NonNullable<IdentityConfig["oidc"]>,
    private readonly network: OidcNetwork = productionOidcNetwork,
    private readonly now: () => number = Date.now,
  ) {
    this.#limiter = new InflightLimiter(limits.maxInflight, limits.maxInflightPerProvider);
  }

  async discover(provider: OidcProviderConfig, force = false): Promise<OidcDiscovery> {
    if (!force) {
      const cached = this.cached(this.#discovery, provider.id);
      if (cached !== undefined) return cached;
    }
    try {
      const url = discoveryUrl(provider.issuer);
      const result = await this.jsonRequest(provider.id, url);
      const discovery = await verifyDiscovery(provider, result.value, this.network);
      this.cache(this.#discovery, provider.id, discovery, result.ttlMs);
      return discovery;
    } catch {
      throw new OidcTrustError();
    }
  }

  async jwks(provider: OidcProviderConfig, force = false): Promise<OidcJwkSet> {
    if (!force) {
      const cached = this.cached(this.#jwks, provider.id);
      if (cached !== undefined) return cached;
    }
    try {
      const discovery = await this.discover(provider);
      const result = await this.jsonRequest(provider.id, new URL(discovery.jwksUri));
      const jwks = verifyJwks(provider, result.value);
      this.cache(this.#jwks, provider.id, jwks, result.ttlMs);
      return jwks;
    } catch {
      throw new OidcTrustError();
    }
  }

  async verifyIdToken(
    provider: OidcProviderConfig,
    token: string,
    nonce: string,
  ): Promise<ProviderAssertion> {
    if (
      token.length < 1 ||
      Buffer.byteLength(token, "utf8") > 65_536 ||
      nonce.length < 32 ||
      nonce.length > 256
    ) throw new OidcTrustError();
    const discovery = await this.discover(provider);
    try {
      return await this.verifyWithKeys(provider, discovery, token, nonce, false);
    } catch (error) {
      if (!isRefreshableJwksFailure(error)) throw new OidcTrustError();
      try {
        return await this.verifyWithKeys(provider, discovery, token, nonce, true);
      } catch {
        throw new OidcTrustError();
      }
    }
  }

  async exchangeCode(
    provider: OidcProviderConfig,
    code: string,
    verifier: string,
    redirectUri: string,
  ): Promise<string> {
    if (
      code.length < 1 ||
      Buffer.byteLength(code, "utf8") > 4_096 ||
      /[\0\r\n]/.test(code) ||
      !/^[A-Za-z0-9_-]{43}$/.test(verifier) ||
      redirectUri !== `${provider.redirectOrigin}/api/v2/auth/oidc/${provider.id}/callback`
    ) throw new OidcTrustError();
    try {
      const discovery = await this.discover(provider);
      const form = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      });
      const headers: Record<string, string> = {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      };
      if (provider.clientSecretFile === undefined) {
        form.set("client_id", provider.clientId);
      } else {
        const secret = readClientSecret(provider.clientSecretFile);
        headers.authorization = `Basic ${Buffer.from(
          `${formComponent(provider.clientId)}:${formComponent(secret)}`,
          "utf8",
        ).toString("base64")}`;
      }
      const result = await this.jsonRequest(
        provider.id,
        new URL(discovery.tokenEndpoint),
        {
          method: "POST",
          headers,
          body: Buffer.from(form.toString(), "utf8"),
        },
      );
      const response = result.value as Record<string, unknown>;
      if (
        typeof response.id_token !== "string" ||
        response.id_token.length < 1 ||
        Buffer.byteLength(response.id_token, "utf8") > 65_536
      ) throw new Error("missing ID token");
      return response.id_token;
    } catch {
      throw new OidcTrustError();
    }
  }

  private async jsonRequest(
    providerId: string,
    url: URL,
    request: {
      method: "POST";
      headers: Record<string, string>;
      body: Uint8Array;
    } | undefined = undefined,
  ): Promise<{ value: unknown; ttlMs: number }> {
    const release = this.#limiter.acquire(providerId);
    if (release === undefined) throw new OidcTrustError();
    try {
      const address = await validatedAddress(url, this.network);
      const response = await this.network.request({
        url,
        address,
        method: request?.method ?? "GET",
        headers: request?.headers ?? { accept: "application/json" },
        ...(request === undefined ? {} : { body: request.body }),
        timeoutMs: this.limits.networkTimeoutMs,
        maxBodyBytes: this.limits.maxResponseBodyBytes,
      });
      if (
        response.url !== url.toString() ||
        response.status < 200 ||
        response.status >= 300 ||
        response.body.byteLength > this.limits.maxResponseBodyBytes ||
        !isJsonContentType(response.headers.get("content-type"))
      ) throw new Error("invalid response");
      const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(response.body));
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("invalid JSON object");
      }
      return { value, ttlMs: cacheTtl(response.headers) };
    } catch {
      throw new OidcTrustError();
    } finally {
      release();
    }
  }

  private async verifyWithKeys(
    provider: OidcProviderConfig,
    discovery: OidcDiscovery,
    token: string,
    nonce: string,
    forceKeys: boolean,
  ): Promise<ProviderAssertion> {
    const jwks = await this.jwks(provider, forceKeys);
    const now = this.now();
    const { payload, protectedHeader } = await jwtVerify(
      token,
      createLocalJWKSet(jwks as JSONWebKeySet),
      {
        issuer: provider.issuer,
        audience: provider.clientId,
        algorithms: discovery.signingAlgorithms,
        clockTolerance: provider.clockSkewSeconds,
        currentDate: new Date(now),
        requiredClaims: ["sub", "iat", "exp", "auth_time", "nonce"],
      },
    );
    if (
      protectedHeader.alg === undefined ||
      !provider.allowedSigningAlgorithms.includes(protectedHeader.alg as "RS256" | "ES256") ||
      payload.nonce !== nonce ||
      typeof payload.iat !== "number" ||
      !Number.isSafeInteger(payload.iat) ||
      payload.iat * 1_000 > now + provider.clockSkewSeconds * 1_000 ||
      now - payload.iat * 1_000 > this.limits.flowTtlMs + provider.clockSkewSeconds * 1_000 ||
      !validAuthorizedParty(payload, provider.clientId)
    ) throw new OidcTrustError();
    return normalizeVerifiedOidcClaims(provider, payload, now);
  }

  private cached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
    const entry = cache.get(key);
    if (entry === undefined) return undefined;
    if (entry.expiresAt <= this.now()) {
      cache.delete(key);
      return undefined;
    }
    cache.delete(key);
    cache.set(key, entry);
    return entry.value;
  }

  private cache<T>(
    cache: Map<string, CacheEntry<T>>,
    key: string,
    value: T,
    ttlMs: number,
  ): void {
    cache.delete(key);
    while (cache.size >= this.limits.maxCacheRecords) {
      const oldest = cache.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
    cache.set(key, { value, expiresAt: this.now() + ttlMs });
  }
}

function readClientSecret(path: string): string {
  const value = readFileSync(path, "utf8");
  if (
    value.length < 1 ||
    Buffer.byteLength(value, "utf8") > 4_096 ||
    /[\0\r\n]/.test(value)
  ) throw new Error("invalid client secret");
  return value;
}

function formComponent(value: string): string {
  return new URLSearchParams({ value }).toString().slice("value=".length);
}

function isRefreshableJwksFailure(error: unknown): boolean {
  if (error === null || typeof error !== "object" || !("code" in error)) return false;
  const code = (error as { code?: unknown }).code;
  return code === "ERR_JWKS_NO_MATCHING_KEY" ||
    code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
}

function validAuthorizedParty(payload: JWTPayload, clientId: string): boolean {
  const audiences = Array.isArray(payload.aud)
    ? payload.aud
    : typeof payload.aud === "string"
      ? [payload.aud]
      : [];
  if (audiences.length > 1) return payload.azp === clientId;
  return payload.azp === undefined || payload.azp === clientId;
}

function discoveryUrl(issuer: string): URL {
  return new URL(`${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`);
}

async function verifyDiscovery(
  provider: OidcProviderConfig,
  input: unknown,
  network: OidcNetwork,
): Promise<OidcDiscovery> {
  const value = input as Record<string, unknown>;
  if (
    value.issuer !== provider.issuer ||
    !stringArray(value.response_types_supported, 32).includes("code") ||
    !stringArray(value.code_challenge_methods_supported, 16).includes("S256")
  ) throw new Error("invalid discovery");
  const authorizationEndpoint = canonicalHttpsUrl(value.authorization_endpoint);
  const tokenEndpoint = canonicalHttpsUrl(value.token_endpoint);
  const jwksUri = canonicalHttpsUrl(value.jwks_uri);
  await Promise.all([
    validatedAddress(new URL(authorizationEndpoint), network),
    validatedAddress(new URL(tokenEndpoint), network),
    validatedAddress(new URL(jwksUri), network),
  ]);
  const tokenEndpointAuthMethods = stringArray(value.token_endpoint_auth_methods_supported, 16);
  const requiredMethod = provider.clientSecretFile === undefined ? "none" : "client_secret_basic";
  if (!tokenEndpointAuthMethods.includes(requiredMethod)) throw new Error("unsupported token auth");
  const supportedAlgorithms = stringArray(value.id_token_signing_alg_values_supported, 16);
  const signingAlgorithms = provider.allowedSigningAlgorithms
    .filter((algorithm) => supportedAlgorithms.includes(algorithm));
  if (signingAlgorithms.length === 0) throw new Error("unsupported signing algorithm");
  return {
    issuer: provider.issuer,
    authorizationEndpoint,
    tokenEndpoint,
    jwksUri,
    tokenEndpointAuthMethods,
    signingAlgorithms,
  };
}

function verifyJwks(provider: OidcProviderConfig, input: unknown): OidcJwkSet {
  const value = input as Record<string, unknown>;
  if (!Array.isArray(value.keys) || value.keys.length < 1 || value.keys.length > 100) {
    throw new OidcTrustError();
  }
  const keys = value.keys.map((entry) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new OidcTrustError();
    }
    const key = entry as Record<string, unknown>;
    if (
      typeof key.kid !== "string" ||
      key.kid.length < 1 ||
      key.kid.length > 256 ||
      (key.kty !== "RSA" && key.kty !== "EC") ||
      "d" in key ||
      (key.use !== undefined && key.use !== "sig") ||
      (key.key_ops !== undefined &&
        (!Array.isArray(key.key_ops) || !key.key_ops.includes("verify"))) ||
      (key.alg !== undefined &&
        (typeof key.alg !== "string" ||
          !provider.allowedSigningAlgorithms.includes(key.alg as "RS256" | "ES256")))
    ) throw new OidcTrustError();
    if (
      (key.kty === "RSA" &&
        (typeof key.n !== "string" || typeof key.e !== "string")) ||
      (key.kty === "EC" &&
        (key.crv !== "P-256" || typeof key.x !== "string" || typeof key.y !== "string"))
    ) throw new OidcTrustError();
    return { ...key };
  });
  if (new Set(keys.map((key) => key.kid)).size !== keys.length) throw new OidcTrustError();
  return { keys };
}

async function validatedAddress(url: URL, network: OidcNetwork): Promise<OidcNetworkAddress> {
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.hash !== ""
  ) throw new Error("unsafe OIDC URL");
  const hostname = stripIpv6Brackets(url.hostname);
  const literalFamily = isIP(hostname);
  const addresses = literalFamily === 0
    ? await network.resolve(hostname)
    : [{ address: hostname, family: literalFamily as 4 | 6 }];
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicMetadataAddress(address))) {
    throw new Error("unsafe OIDC address");
  }
  return addresses[0]!;
}

function canonicalHttpsUrl(input: unknown): string {
  if (typeof input !== "string" || input.length > 2048) throw new Error("invalid URL");
  const url = new URL(input);
  const canonical = url.pathname === "/" && url.search === "" ? url.origin : url.toString();
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.hash !== "" ||
    canonical !== input
  ) throw new Error("invalid URL");
  return input;
}

function stringArray(input: unknown, maximum: number): string[] {
  if (
    !Array.isArray(input) ||
    input.length < 1 ||
    input.length > maximum ||
    !input.every((value) => typeof value === "string" && value.length >= 1 && value.length <= 256)
  ) throw new Error("invalid string array");
  const values = input as string[];
  if (new Set(values).size !== values.length) throw new Error("duplicate string");
  return values;
}

function isJsonContentType(value: string | null): boolean {
  const mediaType = value?.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "application/json" ||
    (mediaType?.startsWith("application/") === true && mediaType.endsWith("+json"));
}

function cacheTtl(headers: Headers): number {
  const cacheControl = headers.get("cache-control")?.toLowerCase();
  if (cacheControl !== undefined && !/(?:^|,)\s*no-store\s*(?:,|$)/.test(cacheControl)) {
    const match = /(?:^|,)\s*(?:s-maxage|max-age)\s*=\s*(\d+)/.exec(cacheControl);
    if (match?.[1] !== undefined) {
      const seconds = Number(match[1]);
      if (Number.isSafeInteger(seconds) && seconds > 0) {
        return Math.min(seconds * 1_000, MAX_CACHE_TTL_MS);
      }
    }
  }
  return DEFAULT_CACHE_TTL_MS;
}

function stripIpv6Brackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

const productionOidcNetwork: OidcNetwork = {
  async resolve(hostname) {
    const results = await dnsLookup(hostname, { all: true, verbatim: true });
    return results.map(({ address, family }) => ({
      address,
      family: family as 4 | 6,
    }));
  },
  request(input) {
    return requestPinned(input);
  },
};

async function requestPinned(input: OidcNetworkRequest): Promise<OidcNetworkResponse> {
  return await new Promise((resolve, reject) => {
    const lookup: LookupFunction = (_hostname, _options, callback) =>
      callback(null, input.address.address, input.address.family);
    const request = httpsRequest(input.url, {
      method: input.method,
      headers: input.headers,
      lookup,
      servername: stripIpv6Brackets(input.url.hostname),
    }, (response) => {
      const declaredLength = response.headers["content-length"];
      if (
        declaredLength !== undefined &&
        /^\d+$/.test(declaredLength) &&
        Number(declaredLength) > input.maxBodyBytes
      ) {
        response.destroy();
        reject(new Error("OIDC response is too large"));
        return;
      }
      const chunks: Buffer[] = [];
      let total = 0;
      response.on("data", (chunk) => {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += bytes.byteLength;
        if (total > input.maxBodyBytes) {
          response.destroy();
          request.destroy();
          reject(new Error("OIDC response is too large"));
          return;
        }
        chunks.push(bytes);
      });
      response.on("error", reject);
      response.on("end", () => resolve({
        status: response.statusCode ?? 0,
        headers: new Headers(Object.entries(response.headers).flatMap(([name, value]) =>
          value === undefined ? [] : [[name, Array.isArray(value) ? value.join(", ") : value]])),
        body: Buffer.concat(chunks),
        url: input.url.toString(),
      }));
    });
    request.setTimeout(input.timeoutMs, () => request.destroy(new Error("OIDC request timed out")));
    request.on("error", reject);
    if (input.body !== undefined) request.write(input.body);
    request.end();
  });
}
