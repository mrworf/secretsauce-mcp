import { createHash, createHmac } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { parseIdempotencyKey } from "./contracts.js";
import { isUuidV7 } from "../persistence/uuidV7.js";
import { PersistenceError } from "../persistence/errors.js";

const routeIdPattern = /^[a-z][a-z0-9_.-]{0,127}$/;

export class ControlIdempotencyHasher {
  readonly #key: Buffer;

  constructor(key: Buffer) {
    if (key.byteLength !== 32) throw new PersistenceError("invalid_idempotency_record");
    this.#key = Buffer.from(key);
  }

  keyHash(input: {
    key: string;
    principalId: string;
    routeId: string;
  }): string {
    const key = parseIdempotencyKey(input.key);
    if (!isUuidV7(input.principalId) || !routeIdPattern.test(input.routeId)) {
      throw new PersistenceError("invalid_idempotency_record");
    }
    return createHmac("sha256", this.#key)
      .update("secretsauce-control-idempotency-v1\0", "utf8")
      .update(input.principalId, "utf8")
      .update("\0", "utf8")
      .update(input.routeId, "utf8")
      .update("\0", "utf8")
      .update(key, "utf8")
      .digest("hex");
  }

  requestDigest(input: unknown): string {
    let canonical: string;
    try {
      canonical = canonicalControlJson(input);
    } catch {
      throw new PersistenceError("invalid_idempotency_record");
    }
    return createHash("sha256")
      .update("secretsauce-control-request-v1\0", "utf8")
      .update(canonical, "utf8")
      .digest("hex");
  }
}

export function loadControlIdempotencyKey(path: string): Buffer {
  try {
    const stats = statSync(path);
    if (!stats.isFile() || (stats.mode & 0o077) !== 0) {
      throw new Error("invalid");
    }
    const encoded = readFileSync(path, "utf8").trim();
    if (!/^[A-Za-z0-9_-]{43}$/.test(encoded)) throw new Error("invalid");
    const key = Buffer.from(encoded, "base64url");
    if (key.byteLength !== 32 || key.toString("base64url") !== encoded) {
      throw new Error("invalid");
    }
    return key;
  } catch {
    throw new PersistenceError("invalid_idempotency_record");
  }
}

export function canonicalControlJson(input: unknown): string {
  if (input === null) return "null";
  if (typeof input === "string") return JSON.stringify(input);
  if (typeof input === "boolean") return input ? "true" : "false";
  if (typeof input === "number") {
    if (!Number.isFinite(input)) throw new Error("unsupported");
    return JSON.stringify(input);
  }
  if (Array.isArray(input)) {
    return `[${input.map((value) => canonicalControlJson(value)).join(",")}]`;
  }
  if (typeof input === "object") {
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) throw new Error("unsupported");
    const record = input as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    if (keys.some((key) => record[key] === undefined)) throw new Error("unsupported");
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalControlJson(record[key])}`).join(",")}}`;
  }
  throw new Error("unsupported");
}
