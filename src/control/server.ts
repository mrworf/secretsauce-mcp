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
  BrowserSessionAuthenticator,
  BrowserSessionRepository,
  loadIdentitySessionHmacKey,
} from "../identity/browserSessions.js";
import {
  LocalAuthenticationRepository,
  LocalAuthenticationService,
} from "../identity/localAuthentication.js";
import { IdentityKeyRing } from "../identity/totp.js";
import {
  BrowserStepUpAuthorization,
  StepUpRepository,
  StepUpService,
} from "../identity/stepUp.js";
import {
  LocalControlAuthenticator,
  LocalEnrollmentRepository,
  LocalEnrollmentService,
  RestrictedSessionAuthenticator,
} from "../identity/enrollment.js";
import {
  UserAdministrationRepository,
  UserAdministrationService,
  UserCursorCodec,
  UserManagementAuthorization,
  denyUserRelationships,
} from "../identity/userAdministration.js";
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
import { registerUserAdministrationRoutes } from "./userRoutes.js";
import {
  installControlWebRoutes,
  loadControlWebAssets,
  type ControlWebAssets,
} from "./webAssets.js";
import {
  registerLocalIdentityRoutes,
  type LocalIdentityControl,
} from "./identityRoutes.js";

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
  identityReadiness?: () => Promise<"ready" | "unavailable" | "unsupported">;
  localIdentity?: LocalIdentityControl;
}

export function createControlApplication(
  config: GatewayConfig,
  options: ControlApplicationOptions = {},
): FastifyInstance {
  const control = config.control;
  if (control === undefined) throw new Error("Control configuration is required.");
  const logger = options.logger ?? createLogger(config.logging);
  const authenticator = options.authenticator ??
    options.localIdentity?.authenticator ??
    options.localIdentity?.browserSessions ??
    denyControlAuthentication;
  const authorization = options.authorization ??
    options.localIdentity?.authorization ??
    denyControlAuthorization;
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
    options.identityReadiness,
  );
  if (options.localIdentity !== undefined) {
    registerLocalIdentityRoutes(routeRegistry, options.localIdentity);
    if (options.localIdentity.users !== undefined) {
      registerUserAdministrationRoutes(routeRegistry, options.localIdentity.users);
    }
  }
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
  let localAuthentication: LocalAuthenticationService | undefined;
  let browserSessions: BrowserSessionAuthenticator | undefined;
  let stepUp: StepUpService | undefined;
  let stepUpAuthorization: BrowserStepUpAuthorization | undefined;
  let enrollment: LocalEnrollmentService | undefined;
  let restrictedSessions: RestrictedSessionAuthenticator | undefined;
  let userAdministration: UserAdministrationService | undefined;
  let identityKeyRing: IdentityKeyRing | undefined;
  try {
    let localIdentity: LocalIdentityControl | undefined;
    if (config.identity !== undefined) {
      identityKeyRing = IdentityKeyRing.fromFiles(
        config.identity.activeRootKeyId,
        config.identity.rootKeyFiles,
      );
      const sessionKey = loadIdentitySessionHmacKey(config.identity.sessionHmacKeyFile);
      try {
        const authenticationRepository = new LocalAuthenticationRepository(persistence);
        localAuthentication = await LocalAuthenticationService.create({
          repository: authenticationRepository,
          config: config.identity,
          keyRing: identityKeyRing,
          sessionHmacKey: sessionKey,
        });
        browserSessions = new BrowserSessionAuthenticator(
          new BrowserSessionRepository(persistence),
          config.identity.sessions,
          sessionKey,
        );
        const stepUpRepository = new StepUpRepository(persistence);
        stepUp = new StepUpService({
          authenticationRepository,
          repository: stepUpRepository,
          config: config.identity,
          keyRing: identityKeyRing,
          sessionHmacKey: sessionKey,
        });
        stepUpAuthorization = new BrowserStepUpAuthorization(
          browserSessions,
          stepUpRepository,
          config.identity.stepUpMode,
          sessionKey,
        );
        const enrollmentRepository = new LocalEnrollmentRepository(persistence);
        enrollment = await LocalEnrollmentService.create({
          repository: enrollmentRepository,
          config: config.identity,
          keyRing: identityKeyRing,
          sessionHmacKey: sessionKey,
        });
        restrictedSessions = new RestrictedSessionAuthenticator(
          enrollmentRepository,
          sessionKey,
        );
        userAdministration = new UserAdministrationService(
          new UserAdministrationRepository(persistence),
          new UserCursorCodec(sessionKey),
          denyUserRelationships,
        );
        localIdentity = {
          authentication: localAuthentication,
          browserSessions,
          stepUp,
          authorization: new UserManagementAuthorization(
            stepUpAuthorization,
            denyUserRelationships,
          ),
          enrollment,
          restrictedSessions,
          authenticator: new LocalControlAuthenticator(browserSessions, restrictedSessions),
          users: userAdministration,
        };
      } finally {
        sessionKey.fill(0);
      }
    }
    server = createControlApplication(config, {
      persistence,
      ...options,
      ...(localIdentity === undefined
        ? {}
        : { identityReadiness: async () => "ready" as const }),
      ...(localIdentity === undefined ? {} : { localIdentity }),
    });
    await server.listen({
      host: config.control.host,
      port: config.control.port,
    });
  } catch (error) {
    await server?.close().catch(() => undefined);
    browserSessions?.close();
    stepUpAuthorization?.close();
    stepUp?.close();
    restrictedSessions?.close();
    enrollment?.close();
    userAdministration?.close();
    localAuthentication?.close();
    identityKeyRing?.destroy();
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
        browserSessions?.close();
        stepUpAuthorization?.close();
        stepUp?.close();
        restrictedSessions?.close();
        enrollment?.close();
        userAdministration?.close();
        localAuthentication?.close();
        identityKeyRing?.destroy();
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
