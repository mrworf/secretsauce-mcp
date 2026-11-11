import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import type { LookupFunction } from "node:net";
import { describe, expect, it, vi } from "vitest";

const { mockDnsLookup, mockHttpsRequest } = vi.hoisted(() => ({
  mockDnsLookup: vi.fn(),
  mockHttpsRequest: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({ lookup: mockDnsLookup }));
vi.mock("node:https", () => ({ request: mockHttpsRequest }));

import { OAuthClientMetadataFetcher } from "../src/oauthClientMetadata.js";

describe("OAuth metadata pinned HTTPS transport", () => {
  it("supplies all validated pinned addresses to Node address-family selection", async () => {
    const clientId = "https://client.example.org/oauth/metadata";
    const pinnedAddresses = [
      { address: "93.184.216.34", family: 4 },
      { address: "2606:4700:4700::1111", family: 6 },
    ];
    mockDnsLookup.mockResolvedValue(pinnedAddresses);
    mockHttpsRequest.mockImplementation((_url: unknown, options: { autoSelectFamily?: boolean; servername?: string; lookup: LookupFunction }, onResponse: (response: Readable) => void) => {
      const request = new EventEmitter() as EventEmitter & {
        setTimeout: (ms: number, callback: () => void) => void;
        end: () => void;
      };
      request.setTimeout = vi.fn();
      request.end = () => {
        const response = Readable.from([JSON.stringify({
          client_id: clientId,
          redirect_uris: ["https://client.example.org/callback"],
        })]) as Readable & { statusCode: number; headers: Record<string, string> };
        response.statusCode = 200;
        response.headers = { "content-type": "application/json" };
        onResponse(response);
      };
      expect(options.autoSelectFamily).not.toBe(false);
      expect(options.servername).toBe("client.example.org");
      options.lookup("client.example.org", { all: true }, (error, records) => {
        expect(error).toBeNull();
        expect(records).toEqual(pinnedAddresses);
      });
      options.lookup("client.example.org", {}, (error: Error | null, address: string, family: number) => {
        expect(error).toBeNull();
        expect(address).toBe(pinnedAddresses[0]!.address);
        expect(family).toBe(4);
      });
      return request;
    });

    const fetcher = new OAuthClientMetadataFetcher(4, 2);
    await expect(fetcher.fetch(clientId)).resolves.toMatchObject({
      clientId,
      redirectUris: ["https://client.example.org/callback"],
    });
    expect(mockDnsLookup).toHaveBeenCalledTimes(1);
    expect(mockHttpsRequest).toHaveBeenCalledTimes(1);
  });
});
