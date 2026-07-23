import { randomBytes } from "node:crypto";

const MAX_TIMESTAMP = 0xffff_ffff_ffff;
const RANDOM_MASK = (1n << 74n) - 1n;
const RAND_B_MASK = (1n << 62n) - 1n;

export interface UuidV7Options {
  now?: () => number;
  random?: (size: number) => Uint8Array;
}

export class UuidV7Generator {
  readonly #now: () => number;
  readonly #random: (size: number) => Uint8Array;
  #lastTimestamp = -1;
  #sequence = 0n;

  constructor(options: UuidV7Options = {}) {
    this.#now = options.now ?? Date.now;
    this.#random = options.random ?? randomBytes;
  }

  next(): string {
    let timestamp = Math.trunc(this.#now());
    if (!Number.isSafeInteger(timestamp) || timestamp < 0 || timestamp > MAX_TIMESTAMP) {
      throw new Error("UUIDv7 time source is outside the supported range.");
    }

    if (timestamp > this.#lastTimestamp) {
      this.#sequence = random74(this.#random(10));
    } else {
      timestamp = this.#lastTimestamp;
      this.#sequence = (this.#sequence + 1n) & RANDOM_MASK;
      if (this.#sequence === 0n) {
        timestamp += 1;
        if (timestamp > MAX_TIMESTAMP) throw new Error("UUIDv7 space exhausted.");
        this.#sequence = random74(this.#random(10));
      }
    }
    this.#lastTimestamp = timestamp;
    return formatUuid(timestamp, this.#sequence);
  }
}

export function isUuidV7(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}

function random74(bytes: Uint8Array): bigint {
  if (bytes.length !== 10) throw new Error("UUIDv7 randomness source returned the wrong length.");
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value & RANDOM_MASK;
}

function formatUuid(timestamp: number, sequence: bigint): string {
  const bytes = new Uint8Array(16);
  let remainingTimestamp = BigInt(timestamp);
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = Number(remainingTimestamp & 0xffn);
    remainingTimestamp >>= 8n;
  }
  const randA = Number((sequence >> 62n) & 0xfffn);
  const randB = sequence & RAND_B_MASK;
  bytes[6] = 0x70 | (randA >> 8);
  bytes[7] = randA & 0xff;
  bytes[8] = 0x80 | Number((randB >> 56n) & 0x3fn);
  let remainingRandB = randB;
  for (let index = 15; index >= 9; index -= 1) {
    bytes[index] = Number(remainingRandB & 0xffn);
    remainingRandB >>= 8n;
  }
  const hex = Buffer.from(bytes).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
