import type { IncomingMessage } from "node:http";

export class RequestBodyError extends Error {
  constructor(
    readonly statusCode: 400 | 408 | 413,
    readonly code: "invalid_content_length" | "request_timeout" | "request_too_large",
    message: string,
  ) {
    super(message);
    this.name = "RequestBodyError";
  }
}

export async function readBoundedBody(request: IncomingMessage, maxBytes: number, timeoutMs?: number): Promise<Buffer> {
  const declaredLength = request.headers["content-length"];
  if (declaredLength !== undefined) {
    if (Array.isArray(declaredLength) || !/^\d+$/.test(declaredLength)) {
      throw new RequestBodyError(400, "invalid_content_length", "Invalid Content-Length header.");
    }
    if (Number(declaredLength) > maxBytes) {
      throw new RequestBodyError(413, "request_too_large", "Request body is too large.");
    }
  }

  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    const timer = timeoutMs === undefined ? undefined : setTimeout(() => {
      request.pause();
      cleanup();
      reject(new RequestBodyError(408, "request_timeout", "Request body read timed out."));
    }, timeoutMs);
    timer?.unref();

    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer);
      request.off("data", onData);
      request.off("end", onEnd);
      request.off("error", onError);
      request.off("aborted", onAborted);
    };
    const onData = (chunk: Buffer | string) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += bytes.byteLength;
      if (totalBytes > maxBytes) {
        request.pause();
        cleanup();
        reject(new RequestBodyError(413, "request_too_large", "Request body is too large."));
        return;
      }
      chunks.push(bytes);
    };
    const onEnd = () => {
      cleanup();
      resolve(Buffer.concat(chunks, totalBytes));
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onAborted = () => {
      cleanup();
      reject(new RequestBodyError(400, "invalid_content_length", "Request body was aborted."));
    };

    request.on("data", onData);
    request.once("end", onEnd);
    request.once("error", onError);
    request.once("aborted", onAborted);
  });
}
