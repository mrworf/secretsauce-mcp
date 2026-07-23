import cookie from "@fastify/cookie";
import Fastify, {
  type FastifyInstance,
  type FastifyRequest,
  LogController,
} from "fastify";
import { createLogger, type Logger } from "../logger.js";
import {
  PersistenceWorker,
  type PersistenceOwner,
} from "../persistence/worker.js";
import { createRequestId } from "../requestId.js";
import { configuredAuditTextSanitizer } from "../runtime.js";
import type { GatewayConfig } from "../types.js";
import { PACKAGE_VERSION } from "../version.js";
import {
  denyControlAuthentication,
  controlAuthentication,
  type ControlAuthenticator,
} from "./authentication.js";
import { createDefaultControlRouteRegistry } from "./defaultRoutes.js";
import { ControlRateLimiter } from "./rateLimiter.js";
import {
  ControlContractError,
} from "./contracts.js";
import {
  denyControlAuthorization,
  installControlRoutes,
  type ControlAuthorizationSeam,
  type ControlRouteRegistry,
} from "./routeRegistry.js";
import {
  CONTROL_BODY_LIMIT_BYTES,
  controlSecurityHooks,
  sendControlError,
} from "./security.js";
import {
  ControlIdempotencyHasher,
  loadControlIdempotencyKey,
} from "./idempotency.js";
import {
  installControlWebRoutes,
  loadControlWebAssets,
  type ControlWebAssets,
} from "./webAssets.js";

export interface ControlApplicationOptions {
  authenticator?: ControlAuthenticator;
  logger?: Logger;
  persistence?: PersistenceOwner;
  registerRoutes?: (application: FastifyInstance) => void | Promise<void>;
  registerControlRoutes?: (registry: ControlRouteRegistry) => void;
  authorization?: ControlAuthorizationSeam;
  rateLimiter?: ControlRateLimiter;
  webAssets?: ControlWebAssets;
  vaultReadiness?: () => Promise<"ready" | "unavailable" | "unsupported">;
}

export function createControlApplication(
  config: GatewayConfig,
  options: ControlApplicationOptions = {},
): FastifyInstance {
  const control = config.control;
  if (control === undefined) throw new Error("Control configuration is required.");
  const logger = options.logger ?? createLogger(config.logging);
  const authenticator = options.authenticator ?? denyControlAuthentication;
  const authorization = options.authorization ?? denyControlAuthorization;
  const rateLimiter = options.rateLimiter ?? new ControlRateLimiter();
  const application = Fastify({
    logger: false,
    trustProxy: false,
    bodyLimit: CONTROL_BODY_LIMIT_BYTES,
    requestIdHeader: false,
    genReqId: createRequestId,
    logController: new LogController({ disableRequestLogging: true }),
  });
  void application.register(cookie);
  const security = controlSecurityHooks(control, authenticator, rateLimiter);
  application.addHook("onRequest", security.onRequest);
  application.addHook("onSend", security.onSend);
  application.addHook("onResponse", async (request, reply) => {
    const authentication = controlAuthentication(request);
    logger.info("control.request_completed", {
      request_id: request.id,
      method: request.method,
      route: registeredRoute(request),
      status_code: reply.statusCode,
      duration_class: durationClass(reply.elapsedTime),
      ...(authentication === undefined ? {} : {
        principal_id: authentication.principalId,
        authentication_method: authentication.method,
      }),
    });
  });

  const routeRegistry = createDefaultControlRouteRegistry(
    options.persistence,
    control.publicOrigin,
    options.vaultReadiness,
  );
  options.registerControlRoutes?.(routeRegistry);
  installControlRoutes(application, routeRegistry, authorization);

  installControlWebRoutes(application, options.webAssets ?? loadControlWebAssets());

  if (options.registerRoutes !== undefined) {
    void application.register(async (scope) => options.registerRoutes?.(scope));
  }
  application.setErrorHandler((error, request, reply) => {
    if (error instanceof ControlContractError) {
      sendControlError(
        reply,
        request.id,
        error.statusCode,
        error.code,
        error.message,
        error.details,
      );
      return;
    }
    const receivedStatus = errorStatusCode(error);
    const statusCode = receivedStatus === 413 ? 413 : receivedStatus === 400 ? 400 : 500;
    if (statusCode === 500) {
      logger.error("control.request_failed", {
        request_id: request.id,
        method: request.method,
        route: registeredRoute(request),
        error_type: error instanceof Error ? error.name : "UnknownError",
      });
    }
    sendControlError(
      reply,
      request.id,
      statusCode,
      statusCode === 500 ? "internal_error" : "invalid_request",
      statusCode === 500 ? "The request could not be completed." : "The request is invalid.",
    );
  });
  application.setNotFoundHandler((request, reply) => {
    sendControlError(reply, request.id, 404, "not_found", "Not found.");
  });
  return application;
}

export interface ControlServerApplication {
  server: FastifyInstance;
  persistence: PersistenceOwner;
  idempotencyHasher: ControlIdempotencyHasher;
  close(): Promise<void>;
}

export async function startControlServer(
  config: GatewayConfig,
  options: Pick<ControlApplicationOptions, "vaultReadiness"> = {},
): Promise<ControlServerApplication> {
  if (config.control === undefined || config.persistence === undefined) {
    throw new Error("Control and persistence configuration are required.");
  }
  const idempotencyHasher = new ControlIdempotencyHasher(
    loadControlIdempotencyKey(config.control.idempotencyHmacKeyFile),
  );
  const persistence = PersistenceWorker.open({
    databaseFile: config.persistence.databaseFile,
    productVersion: PACKAGE_VERSION,
    sanitizeAuditText: configuredAuditTextSanitizer(config),
  });
  let server: FastifyInstance | undefined;
  try {
    server = createControlApplication(config, { persistence, ...options });
    await server.listen({
      host: config.control.host,
      port: config.control.port,
    });
  } catch (error) {
    await server?.close().catch(() => undefined);
    await persistence.close();
    throw error;
  }
  const startedServer = server;
  let closePromise: Promise<void> | undefined;
  return {
    server: startedServer,
    persistence,
    idempotencyHasher,
    close: () => {
      closePromise ??= (async () => {
        await startedServer.close();
        await persistence.close();
      })();
      return closePromise;
    },
  };
}

function registeredRoute(request: FastifyRequest): string {
  return request.routeOptions.url ?? "unmatched";
}

function durationClass(elapsedMilliseconds: number): string {
  if (elapsedMilliseconds < 100) return "under_100ms";
  if (elapsedMilliseconds < 1_000) return "under_1s";
  return "one_second_or_more";
}

function errorStatusCode(error: unknown): number | undefined {
  if (error === null || typeof error !== "object" || !("statusCode" in error)) return undefined;
  return typeof error.statusCode === "number" ? error.statusCode : undefined;
}
