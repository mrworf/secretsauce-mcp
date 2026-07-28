import { describe, expect, it } from "vitest";
import {
  canonicalIp,
  ClientSourceError,
  ClientSourceResolver,
} from "../src/clientSource.js";

describe("canonical client source", () => {
  it("ignores forwarding values in direct and untrusted-peer modes", () => {
    const direct = new ClientSourceResolver({
      mode: "direct",
      header: "x_forwarded_for",
      trustedProxies: [],
    });
    expect(direct.resolve("192.0.2.10", {
      "x-forwarded-for": "unknown, deliberately malformed",
    })).toBe("192.0.2.10");

    const trusted = new ClientSourceResolver({
      mode: "trusted_proxies",
      header: "x_forwarded_for",
      trustedProxies: ["10.0.0.0/8"],
    });
    expect(trusted.resolve("192.0.2.10", {
      "x-forwarded-for": "198.51.100.4",
    })).toBe("192.0.2.10");
  });

  it("walks a trusted X-Forwarded-For chain from the server side", () => {
    const resolver = new ClientSourceResolver({
      mode: "trusted_proxies",
      header: "x_forwarded_for",
      trustedProxies: ["10.0.0.0/8", "2001:db8:ffff::/48"],
    });
    expect(resolver.resolve("10.0.0.9", {
      "x-forwarded-for": "192.0.2.7:8443, 198.51.100.5, 10.2.3.4",
      forwarded: "for=203.0.113.99",
    })).toBe("198.51.100.5");
    expect(resolver.resolve("10.0.0.9", {})).toBe("10.0.0.9");
  });

  it("uses the client-most RFC Forwarded address in always mode", () => {
    const resolver = new ClientSourceResolver({
      mode: "always",
      header: "forwarded",
      trustedProxies: [],
    });
    expect(resolver.resolve("10.0.0.9", {
      forwarded: 'for="[2001:0db8:0:0:0:0:0:1]:443";proto=https, for=10.0.0.8',
      "x-forwarded-for": "203.0.113.99",
    })).toBe("2001:db8::1");
  });

  it("normalizes mapped IPv6 and rejects malformed or ambiguous chains", () => {
    expect(canonicalIp("::ffff:192.0.2.9")).toBe("192.0.2.9");
    expect(canonicalIp("::ffff:c000:209")).toBe("192.0.2.9");
    expect(canonicalIp("2001:0db8:0:0:0:0:0:1")).toBe("2001:db8::1");

    const resolver = new ClientSourceResolver({
      mode: "always",
      header: "x_forwarded_for",
      trustedProxies: [],
    });
    for (const value of [
      "",
      "unknown",
      "_hidden",
      "client.example.org",
      "fe80::1%eth0",
      "192.0.2.1,,198.51.100.1",
      "192.0.2.1:0",
      "192.0.2.1:65536",
    ]) {
      expect(() => resolver.resolve("127.0.0.1", {
        "x-forwarded-for": value,
      }), value).toThrow(ClientSourceError);
    }
    expect(() => resolver.resolve("127.0.0.1", {
      "x-forwarded-for": Array(33).fill("192.0.2.1").join(","),
    })).toThrow(ClientSourceError);
    expect(() => resolver.resolve("127.0.0.1", {
      "x-forwarded-for": "1".repeat(4_097),
    })).toThrow(ClientSourceError);
  });

  it("rejects noncanonical, host-bearing, or duplicate network authority", () => {
    for (const trustedProxies of [
      ["192.0.2.01"],
      ["192.0.2.1/24"],
      ["2001:0db8::/32"],
      ["proxy.example.org"],
      ["fe80::1%eth0"],
    ]) {
      expect(() => new ClientSourceResolver({
        mode: "trusted_proxies",
        header: "x_forwarded_for",
        trustedProxies,
      })).toThrow(ClientSourceError);
    }
  });
});
