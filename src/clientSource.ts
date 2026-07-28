import { isIP } from "node:net";
import type { IncomingHttpHeaders } from "node:http";
import type { IncomingMessage } from "node:http";
import type { ClientSourceConfig } from "./types.js";

export class ClientSourceError extends Error {
  constructor() {
    super("The client source is invalid.");
  }
}

interface Network {
  bytes: Uint8Array;
  prefix: number;
}

export class ClientSourceResolver {
  readonly #trusted: Network[];

  constructor(readonly config: ClientSourceConfig) {
    this.#trusted = config.trustedProxies.map(parseNetwork);
  }

  resolve(immediatePeer: string | undefined, headers: IncomingHttpHeaders): string {
    const peer = canonicalIp(immediatePeer ?? "");
    if (this.config.mode === "direct") return peer;
    if (
      this.config.mode === "trusted_proxies"
      && !this.#trusted.some((network) => contains(network, peer))
    ) return peer;
    const name = this.config.header === "forwarded" ? "forwarded" : "x-forwarded-for";
    const raw = headers[name];
    if (raw === undefined) return peer;
    if (Array.isArray(raw)) throw new ClientSourceError();
    if (Buffer.byteLength(raw, "utf8") > 4_096) throw new ClientSourceError();
    const chain = this.config.header === "forwarded"
      ? parseForwarded(raw)
      : parseXForwardedFor(raw);
    if (chain.length < 1 || chain.length > 32) throw new ClientSourceError();
    if (this.config.mode === "always") return chain[0]!;
    for (let index = chain.length - 1; index >= 0; index -= 1) {
      const address = chain[index]!;
      if (!this.#trusted.some((network) => contains(network, address))) return address;
    }
    return chain[0]!;
  }
}

const requestSources = new WeakMap<object, string>();

export function setCanonicalRequestSource(request: object, source: string): void {
  requestSources.set(request, source);
}

export function canonicalRequestSource(request: IncomingMessage): string {
  return requestSources.get(request) ?? canonicalIp(request.socket.remoteAddress ?? "");
}

export function canonicalIp(input: string): string {
  if (input.length < 1 || input.includes("%") || input !== input.trim()) {
    throw new ClientSourceError();
  }
  if (isIP(input) === 4) return canonicalIpv4(input);
  if (isIP(input) !== 6) throw new ClientSourceError();
  const words = ipv6Words(input);
  if (
    words.slice(0, 5).every((word) => word === 0)
    && words[5] === 0xffff
  ) {
    return `${words[6]! >>> 8}.${words[6]! & 255}.${words[7]! >>> 8}.${words[7]! & 255}`;
  }
  return new URL(`http://[${input}]/`).hostname.slice(1, -1).toLowerCase();
}

function parseXForwardedFor(value: string): string[] {
  const parts = value.split(",");
  if (parts.some((part) => part.trim().length === 0)) throw new ClientSourceError();
  return parts.map((part) => forwardedAddress(part.trim()));
}

function parseForwarded(value: string): string[] {
  const elements = splitQuoted(value, ",");
  return elements.map((element) => {
    let selected: string | undefined;
    for (const parameter of splitQuoted(element, ";")) {
      const equals = parameter.indexOf("=");
      if (equals < 1) throw new ClientSourceError();
      const name = parameter.slice(0, equals).trim().toLowerCase();
      if (name !== "for") continue;
      if (selected !== undefined) throw new ClientSourceError();
      selected = unquote(parameter.slice(equals + 1).trim());
    }
    if (selected === undefined) throw new ClientSourceError();
    return forwardedAddress(selected);
  });
}

function splitQuoted(value: string, separator: "," | ";"): string[] {
  const result: string[] = [];
  let quoted = false;
  let escaped = false;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quoted && character === "\\") {
      escaped = true;
      continue;
    }
    if (character === "\"") quoted = !quoted;
    if (!quoted && character === separator) {
      const part = value.slice(start, index).trim();
      if (part.length === 0) throw new ClientSourceError();
      result.push(part);
      start = index + 1;
    }
  }
  if (quoted || escaped) throw new ClientSourceError();
  const final = value.slice(start).trim();
  if (final.length === 0) throw new ClientSourceError();
  result.push(final);
  return result;
}

function unquote(value: string): string {
  if (!value.startsWith("\"")) {
    if (value.includes("\"")) throw new ClientSourceError();
    return value;
  }
  if (!value.endsWith("\"")) throw new ClientSourceError();
  let result = "";
  for (let index = 1; index < value.length - 1; index += 1) {
    const character = value[index]!;
    if (character === "\\") {
      index += 1;
      const escaped = value[index];
      if (escaped === undefined) throw new ClientSourceError();
      result += escaped;
    } else {
      result += character;
    }
  }
  return result;
}

function forwardedAddress(value: string): string {
  if (
    value.length < 1
    || value.toLowerCase() === "unknown"
    || value.startsWith("_")
    || /[\s%]/.test(value)
  ) throw new ClientSourceError();
  if (value.startsWith("[")) {
    const close = value.indexOf("]");
    if (close < 2) throw new ClientSourceError();
    const suffix = value.slice(close + 1);
    if (suffix !== "" && !/^:[1-9][0-9]{0,4}$/.test(suffix)) {
      throw new ClientSourceError();
    }
    validatePort(suffix.slice(1));
    return canonicalIp(value.slice(1, close));
  }
  if (isIP(value) !== 0) return canonicalIp(value);
  const ipv4Port = /^([^:]+):([1-9][0-9]{0,4})$/.exec(value);
  if (ipv4Port === null) throw new ClientSourceError();
  validatePort(ipv4Port[2]!);
  return canonicalIp(ipv4Port[1]!);
}

function validatePort(value: string): void {
  if (value === "") return;
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new ClientSourceError();
  }
}

function parseNetwork(value: string): Network {
  const pieces = value.split("/");
  if (pieces.length > 2 || pieces[0] === "") throw new ClientSourceError();
  const address = canonicalIp(pieces[0]!);
  if (address !== pieces[0]) throw new ClientSourceError();
  const bytes = addressBytes(address);
  const maximum = bytes.length * 8;
  const prefix = pieces[1] === undefined
    ? maximum
    : canonicalPrefix(pieces[1], maximum);
  if (!hostBitsZero(bytes, prefix)) throw new ClientSourceError();
  return { bytes, prefix };
}

function canonicalPrefix(value: string, maximum: number): number {
  if (!/^(?:0|[1-9][0-9]{0,2})$/.test(value)) throw new ClientSourceError();
  const prefix = Number(value);
  if (prefix > maximum) throw new ClientSourceError();
  return prefix;
}

function contains(network: Network, address: string): boolean {
  const candidate = addressBytes(address);
  if (candidate.length !== network.bytes.length) return false;
  const whole = Math.floor(network.prefix / 8);
  for (let index = 0; index < whole; index += 1) {
    if (candidate[index] !== network.bytes[index]) return false;
  }
  const remaining = network.prefix % 8;
  if (remaining === 0) return true;
  const mask = 0xff << (8 - remaining);
  return (candidate[whole]! & mask) === (network.bytes[whole]! & mask);
}

function hostBitsZero(bytes: Uint8Array, prefix: number): boolean {
  for (let bit = prefix; bit < bytes.length * 8; bit += 1) {
    if ((bytes[Math.floor(bit / 8)]! & (1 << (7 - (bit % 8)))) !== 0) return false;
  }
  return true;
}

function addressBytes(address: string): Uint8Array {
  if (isIP(address) === 4) return Uint8Array.from(address.split(".").map(Number));
  const words = ipv6Words(address);
  return Uint8Array.from(words.flatMap((word) => [word >>> 8, word & 255]));
}

function canonicalIpv4(input: string): string {
  const parts = input.split(".");
  if (
    parts.length !== 4
    || parts.some((part) => !/^(?:0|[1-9][0-9]{0,2})$/.test(part))
  ) throw new ClientSourceError();
  const numbers = parts.map(Number);
  if (numbers.some((part) => part > 255)) throw new ClientSourceError();
  return numbers.join(".");
}

function ipv6Words(input: string): number[] {
  const embedded = /(?:^|:)(\d+\.\d+\.\d+\.\d+)$/.exec(input);
  let value = input;
  if (embedded !== null) {
    const ipv4 = canonicalIpv4(embedded[1]!);
    const bytes = ipv4.split(".").map(Number);
    value = `${input.slice(0, embedded.index)}:${((bytes[0]! << 8) | bytes[1]!).toString(16)}:${((bytes[2]! << 8) | bytes[3]!).toString(16)}`;
  }
  const halves = value.split("::");
  if (halves.length > 2) throw new ClientSourceError();
  const left = halves[0] === "" ? [] : halves[0]!.split(":");
  const right = halves.length === 1 || halves[1] === "" ? [] : halves[1]!.split(":");
  const missing = 8 - left.length - right.length;
  if (
    (halves.length === 1 && missing !== 0)
    || (halves.length === 2 && missing < 1)
  ) throw new ClientSourceError();
  const words = [...left, ...Array(missing).fill("0"), ...right].map((word) => {
    if (!/^[0-9a-fA-F]{1,4}$/.test(word)) throw new ClientSourceError();
    return Number.parseInt(word, 16);
  });
  if (words.length !== 8) throw new ClientSourceError();
  return words;
}
