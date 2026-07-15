import { PassThrough, Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { readBoundedBody, RequestBodyError } from "../src/httpBody.js";
import type { IncomingMessage } from "node:http";

describe("bounded HTTP request bodies", () => {
  it("accepts an exact-limit chunked body", async () => {
    const request = requestFrom(["12", "34"], {});
    await expect(readBoundedBody(request, 4)).resolves.toEqual(Buffer.from("1234"));
  });

  it("rejects declared and streamed bodies over the limit", async () => {
    await expect(readBoundedBody(requestFrom([], { "content-length": "5" }), 4)).rejects.toMatchObject({
      statusCode: 413, code: "request_too_large",
    });
    await expect(readBoundedBody(requestFrom(["123", "45"], {}), 4)).rejects.toMatchObject({
      statusCode: 413, code: "request_too_large",
    });
  });

  it("rejects malformed declared lengths", async () => {
    await expect(readBoundedBody(requestFrom([], { "content-length": "not-a-number" }), 4)).rejects.toBeInstanceOf(RequestBodyError);
  });

  it("times out an incomplete body and accepts one completed before the deadline", async () => {
    await expect(readBoundedBody(requestFrom(["1234"], {}), 4, 50)).resolves.toEqual(Buffer.from("1234"));

    const stalled = new PassThrough() as IncomingMessage;
    Object.defineProperty(stalled, "headers", { value: {} });
    const result = readBoundedBody(stalled, 4, 10);
    stalled.write("1");
    await expect(result).rejects.toMatchObject({ statusCode: 408, code: "request_timeout" });
    stalled.destroy();
  });
});

function requestFrom(chunks: string[], headers: IncomingMessage["headers"]): IncomingMessage {
  const stream = Readable.from(chunks) as IncomingMessage;
  Object.defineProperty(stream, "headers", { value: headers });
  return stream;
}
