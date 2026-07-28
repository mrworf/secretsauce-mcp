import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { GatewayConfig } from "../types.js";
import type { PublicSetupStatus } from "./status.js";
import {
  loadControlWebAssets,
  type ControlWebAssets,
} from "../control/webAssets.js";

const RETRY_AFTER_SECONDS = 3;
const MAX_SOCKET_WAIT_MS = 5_000;
const LIVE_PATH = "/api/v2/health/live";
const READY_PATH = "/api/v2/health/ready";
const STATUS_PATH = "/api/v2/setup/status";

export interface SetupOnlyApplication {
  controlServer: Server;
  gatewayServer: Server;
  close(): Promise<void>;
}

export async function startSetupOnlyApplication(
  config: GatewayConfig,
  status: () => PublicSetupStatus,
  webAssets: ControlWebAssets = loadControlWebAssets(),
): Promise<SetupOnlyApplication> {
  if (config.control === undefined) {
    throw new Error("Control configuration is required.");
  }
  const controlServer = createServer((request, response) => {
    handleControlSetupRequest(
      request,
      response,
      status,
      config.control!.publicAuthority,
      webAssets,
    );
  });
  const gatewayServer = createServer((request, response) => {
    handleGatewaySetupRequest(request, response);
  });
  try {
    await listen(controlServer, config.control.port, config.control.host);
    await listen(gatewayServer, config.server.port, config.server.host);
  } catch (error) {
    await Promise.all([
      closeServer(controlServer),
      closeServer(gatewayServer),
    ]);
    throw error;
  }
  let closePromise: Promise<void> | undefined;
  return {
    controlServer,
    gatewayServer,
    close: () => {
      closePromise ??= Promise.all([
        closeServer(controlServer),
        closeServer(gatewayServer),
      ]).then(() => undefined);
      return closePromise;
    },
  };
}

function handleControlSetupRequest(
  request: IncomingMessage,
  response: ServerResponse,
  status: () => PublicSetupStatus,
  publicAuthority: string,
  webAssets: ControlWebAssets,
): void {
  setSecurityHeaders(response);
  if (!hasExactHost(request, publicAuthority)) {
    writeJson(response, 400, {
      error: {
        code: "invalid_request",
        message: "The request is invalid.",
      },
    });
    return;
  }
  if (isExactGet(request, LIVE_PATH)) {
    writeJson(response, 200, { state: "live" });
    return;
  }
  if (isExactGet(request, READY_PATH)) {
    writeJson(response, 503, {
      state: "not_ready",
      message: "SecretSauce is not operational yet.",
    });
    return;
  }
  if (isExactGet(request, STATUS_PATH)) {
    let current: PublicSetupStatus;
    try {
      current = status();
    } catch {
      current = {
        state: "not_ready",
        message:
          "SecretSauce needs operator attention before setup can continue.",
        retryPending: false,
      };
    }
    writeJson(response, 200, {
      state: current.state,
      message: current.message,
      retry_pending: current.retryPending,
    });
    return;
  }
  if (
    isExactGet(request, "/control/setup")
    || isExactGet(request, "/control/setup/")
  ) {
    writeAsset(response, webAssets.index.body, webAssets.index.contentType);
    return;
  }
  if (request.method === "GET" && request.url?.startsWith("/control/assets/")) {
    const name = request.url.slice("/control/assets/".length);
    const asset = webAssets.assets.get(name);
    if (
      asset !== undefined
      && !name.includes("?")
      && request.headers["content-length"] === undefined
      && request.headers["transfer-encoding"] === undefined
    ) {
      response.setHeader("cache-control", "public, max-age=31536000, immutable");
      writeAsset(response, asset.body, asset.contentType);
      return;
    }
    writeJson(response, 400, {
      error: {
        code: "invalid_request",
        message: "The request is invalid.",
      },
    });
    return;
  }
  if (
    request.url === LIVE_PATH
    || request.url === READY_PATH
    || request.url === STATUS_PATH
    || request.url?.startsWith(`${LIVE_PATH}?`)
    || request.url?.startsWith(`${READY_PATH}?`)
    || request.url?.startsWith(`${STATUS_PATH}?`)
    || request.url === "/control/setup"
    || request.url === "/control/setup/"
    || request.url?.startsWith("/control/setup?")
    || request.url?.startsWith("/control/setup/?")
  ) {
    writeJson(response, 400, {
      error: {
        code: "invalid_request",
        message: "The request is invalid.",
      },
    });
    return;
  }
  writeUnavailable(response);
}

function writeAsset(
  response: ServerResponse,
  body: Buffer,
  contentType: string,
): void {
  response.writeHead(200, {
    "content-type": contentType,
    "content-length": String(body.byteLength),
  });
  response.end(body);
}

function handleGatewaySetupRequest(
  request: IncomingMessage,
  response: ServerResponse,
): void {
  setSecurityHeaders(response);
  if (
    isExactGet(request, "/health")
    || isExactGet(request, "/health/live")
  ) {
    writeJson(response, 200, { state: "live" });
    return;
  }
  writeUnavailable(response);
}

function isExactGet(request: IncomingMessage, path: string): boolean {
  return request.method === "GET"
    && request.url === path
    && request.headers["content-length"] === undefined
    && request.headers["transfer-encoding"] === undefined;
}

function hasExactHost(
  request: IncomingMessage,
  publicAuthority: string,
): boolean {
  const hostHeaders = request.rawHeaders.filter(
    (value, index) =>
      index % 2 === 0 && value.toLowerCase() === "host",
  );
  return hostHeaders.length === 1
    && request.headers.host === publicAuthority;
}

function writeUnavailable(response: ServerResponse): void {
  response.setHeader("retry-after", String(RETRY_AFTER_SECONDS));
  writeJson(response, 503, {
    error: {
      code: "temporarily_unavailable",
      message: "SecretSauce is temporarily unavailable.",
    },
  });
}

function setSecurityHeaders(response: ServerResponse): void {
  response.setHeader("cache-control", "no-store");
  response.setHeader("content-security-policy", "default-src 'none'");
  response.setHeader("referrer-policy", "no-referrer");
  response.setHeader("x-content-type-options", "nosniff");
}

function writeJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(`${JSON.stringify(body)}\n`);
}

function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("Setup listener timed out."));
    }, MAX_SOCKET_WAIT_MS);
    timeout.unref();
    const onError = (error: Error): void => {
      clearTimeout(timeout);
      reject(error);
    };
    server.once("error", onError);
    server.listen(port, host, () => {
      clearTimeout(timeout);
      server.off("error", onError);
      resolve();
    });
  });
}

function closeServer(server: Server): Promise<void> {
  if (!server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
