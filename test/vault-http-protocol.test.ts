import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  canonicalVaultTarget,
  signVaultHttpRequest,
  signVaultHttpResponse,
  verifyVaultHttpRequest,
  verifyVaultHttpResponse,
  type VaultHttpRequestAuthentication,
} from "../src/vault/httpProtocol.js";

const key = Buffer.alloc(32, 9);
const now = 1_765_000_000_000;

function request(): VaultHttpRequestAuthentication {
  return {
    caller: "control_plane",
    method: "POST",
    target: "/v1/credentials",
    contentType: "application/vnd.secretsauce.vault-secret+octet-stream",
    body: Buffer.from("secret"),
    requestId: randomUUID(),
    timestamp: String(now),
    nonce: randomBytes(16).toString("base64url"),
    bootId: randomUUID(),
    representationHeaders: {
      "x-vault-service-id": randomUUID(),
    },
  };
}

describe("vault HTTP authentication", () => {
  it("authenticates exact request and response representations", () => {
    const input = request();
    const mac = signVaultHttpRequest(input, key);
    expect(verifyVaultHttpRequest(input, mac, key, now)).toEqual({
      timestampMs: now,
    });

    const response = {
      caller: input.caller,
      bootId: input.bootId!,
      requestId: input.requestId,
      status: 201,
      contentType: "application/json",
      body: Buffer.from('{"ok":true}'),
    } as const;
    const responseMac = signVaultHttpResponse(response, key);
    expect(() => verifyVaultHttpResponse(response, responseMac, key)).not.toThrow();
  });

  it("rejects tampering, stale/noncanonical fields, and ambiguous targets", () => {
    const input = request();
    const mac = signVaultHttpRequest(input, key);
    for (const changed of [
      { ...input, caller: "backup" as const },
      { ...input, method: "PUT" },
      { ...input, target: "/v1/readiness" },
      { ...input, body: Buffer.from("changed") },
      { ...input, bootId: randomUUID() },
      {
        ...input,
        representationHeaders: {
          "x-vault-service-id": randomUUID(),
        },
      },
    ]) {
      expect(() => verifyVaultHttpRequest(changed, mac, key, now)).toThrow();
    }
    expect(() => verifyVaultHttpRequest(
      { ...input, timestamp: String(now - 30_001) },
      signVaultHttpRequest({ ...input, timestamp: String(now - 30_001) }, key),
      key,
      now,
    )).toThrow();
    expect(() => signVaultHttpRequest({ ...input, timestamp: `0${now}` }, key)).toThrow();
    expect(() => signVaultHttpRequest({ ...input, nonce: "AAAAAAAAAAAAAAAAAAAAAA" }, key)).not.toThrow();
    expect(() => signVaultHttpRequest({ ...input, nonce: "AAAAAAAAAAAAAAAAAAAAAB" }, key)).toThrow();
    for (const target of [
      "http://localhost/v1/readiness",
      "/v1//readiness",
      "/v1/../readiness",
      "/v1/credentials%2Fother",
      "/v1/readiness#fragment",
    ]) expect(() => canonicalVaultTarget(target)).toThrow();
  });

  it("rejects alternate MAC encodings and unsigned response changes", () => {
    const input = request();
    const response = {
      caller: input.caller,
      bootId: input.bootId!,
      requestId: input.requestId,
      status: 200,
      contentType: "application/json",
      body: Buffer.from("{}"),
    } as const;
    const mac = signVaultHttpResponse(response, key);
    expect(() => verifyVaultHttpResponse(
      { ...response, status: 500 },
      mac,
      key,
    )).toThrow();
    expect(() => verifyVaultHttpResponse(response, `${mac.slice(0, -1)}=`, key)).toThrow();
  });
});
