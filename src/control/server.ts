import cookie from "@fastify/cookie";
import { randomUUID } from "node:crypto";
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
import type { AdministrativeAuditEventInput } from "../persistence/administrativeAudit.js";
import { isUuidV7 } from "../persistence/uuidV7.js";
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
} from "../identity/userAdministration.js";
import {
  UserLifecycleAdministrationRepository,
  UserLifecycleAdministrationService,
} from "../identity/userLifecycleAdministration.js";
import {
  OidcFlowRepository,
  OidcFlowService,
} from "../identity/oidcFlow.js";
import { OidcTrustClient } from "../identity/oidcTrust.js";
import {
  OidcLoginRepository,
  OidcLoginService,
} from "../identity/oidcLogin.js";
import {
  OidcLinkRepository,
  OidcLinkService,
} from "../identity/oidcLink.js";
import {
  DatabaseOAuthRepository,
  DatabaseOAuthTokenHasher,
} from "../oauth/databaseOAuth.js";
import { OAuthIntentStateCodec } from "../oauth/intentState.js";
import { readVaultKeyFile } from "../vault/keyFile.js";
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
  type ControlSensitiveFailureAudit,
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
import {
  ServiceManagementAuthorization,
  ServiceManagementRepository,
  ServiceManagementService,
  ServiceRelationshipRepository,
} from "../serviceManagement.js";
import { registerServiceManagementRoutes } from "./serviceRoutes.js";
import {
  GroupAssignmentRepository,
  GroupAssignmentService,
} from "../groupAssignments.js";
import { registerGroupAssignmentRoutes } from "./groupRoutes.js";
import {
  CredentialManagementRepository,
  CredentialManagementService,
} from "../credentialManagement.js";
import {
  CredentialVaultCoordinator,
  type CredentialControlVault,
} from "../credentialVaultCoordinator.js";
import { registerCredentialRoutes } from "./credentialRoutes.js";
import {
  PolicyManagementRepository,
  PolicyManagementService,
} from "../policyManagement.js";
import { registerPolicyRoutes } from "./policyRoutes.js";
import {
  AccessCursorCodec,
  AccessManagementRepository,
} from "../accessManagement.js";
import {
  registerAccessManagementRoutes,
  type AccessRouteDependencies,
} from "./accessRoutes.js";
import type { ReferenceAggregateSource } from "../tokens.js";
import {
  ApiKeyCursorCodec,
  ApiKeyRepository,
  ApiKeyService,
  SystemApiKeyAuthenticator,
} from "../apiKeys.js";
import {
  registerApiKeyRoutes,
  type ApiKeyRouteDependencies,
} from "./apiKeyRoutes.js";

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
  serviceManagement?: ServiceManagementService;
  groupAssignments?: GroupAssignmentService;
  credentialManagement?: CredentialManagementService;
  credentialVault?: CredentialVaultCoordinator;
  policyManagement?: PolicyManagementService;
  accessManagement?: AccessRouteDependencies;
  apiKeys?: ApiKeyRouteDependencies;
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
      registerUserAdministrationRoutes(
        routeRegistry,
        options.localIdentity.users,
        options.localIdentity.userLifecycle,
      );
    }
  }
  if (options.serviceManagement !== undefined) {
    registerServiceManagementRoutes(routeRegistry, options.serviceManagement);
  }
  if (options.groupAssignments !== undefined) {
    registerGroupAssignmentRoutes(routeRegistry, options.groupAssignments);
  }
  if (options.credentialManagement !== undefined) {
    registerCredentialRoutes(
      routeRegistry,
      options.credentialManagement,
      options.credentialVault,
    );
  }
  if (options.policyManagement !== undefined) {
    registerPolicyRoutes(routeRegistry, options.policyManagement);
  }
  if (options.accessManagement !== undefined) {
    registerAccessManagementRoutes(routeRegistry, options.accessManagement);
  }
  if (options.apiKeys !== undefined) {
    registerApiKeyRoutes(routeRegistry, options.apiKeys);
  }
  options.registerControlRoutes?.(routeRegistry);
  installControlRoutes(
    application,
    routeRegistry,
    authorization,
    options.persistence === undefined
      ? undefined
      : sensitiveFailureAudit(options.persistence),
  );

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
  options: Pick<ControlApplicationOptions, "vaultReadiness"> & {
    credentialVaultClient?: CredentialControlVault;
    referenceAggregates?: ReferenceAggregateSource;
  } = {},
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
  let oidcFlow: OidcFlowService | undefined;
  let oidcLogin: OidcLoginService | undefined;
  let oidcLink: OidcLinkService | undefined;
  let serviceManagement: ServiceManagementService | undefined;
  let groupAssignments: GroupAssignmentService | undefined;
  let credentialManagement: CredentialManagementService | undefined;
  let credentialVault: CredentialVaultCoordinator | undefined;
  let policyManagement: PolicyManagementService | undefined;
  let accessManagement: AccessRouteDependencies | undefined;
  let accessCursor: AccessCursorCodec | undefined;
  let identityKeyRing: IdentityKeyRing | undefined;
  let databaseOAuthHasher: DatabaseOAuthTokenHasher | undefined;
  let oauthIntentState: OAuthIntentStateCodec | undefined;
  let apiKeyRepository: ApiKeyRepository | undefined;
  let apiKeyAuthenticator: SystemApiKeyAuthenticator | undefined;
  let apiKeyManagement: ApiKeyRouteDependencies | undefined;
  try {
    apiKeyRepository = new ApiKeyRepository(persistence);
    let localIdentity: LocalIdentityControl | undefined;
    if (config.identity !== undefined) {
      identityKeyRing = IdentityKeyRing.fromFiles(
        config.identity.activeRootKeyId,
        config.identity.rootKeyFiles,
      );
      const sessionKey = loadIdentitySessionHmacKey(config.identity.sessionHmacKeyFile);
      try {
        apiKeyManagement = {
          repository: apiKeyRepository,
          service: new ApiKeyService(apiKeyRepository),
          cursors: new ApiKeyCursorCodec(sessionKey),
        };
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
        if (
          config.auth.mode === "builtin_oauth"
          && config.auth.builtinOAuth.identitySource === "database"
        ) {
          accessCursor = new AccessCursorCodec(sessionKey);
          accessManagement = {
            repository: new AccessManagementRepository(
              persistence,
              config.identity.sessions,
              {
                accessTokenTtlMs:
                  config.auth.builtinOAuth.accessTokenTtlMs,
                refreshTokenIdleTtlMs:
                  config.auth.builtinOAuth.refreshTokenIdleTtlMs,
                refreshTokenMaxTtlMs:
                  config.auth.builtinOAuth.refreshTokenMaxTtlMs,
              },
              accessCursor,
              Date.now,
              stepUpRepository,
              options.referenceAggregates,
            ),
            browserSessions,
            idempotency: idempotencyHasher,
          };
        }
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
        const serviceRelationships = new ServiceRelationshipRepository(persistence);
        serviceManagement = new ServiceManagementService(
          new ServiceManagementRepository(persistence, stepUpRepository),
          serviceRelationships,
          idempotencyHasher,
          sessionKey,
        );
        groupAssignments = new GroupAssignmentService(
          new GroupAssignmentRepository(persistence),
          idempotencyHasher,
        );
        const credentialRepository = new CredentialManagementRepository(persistence);
        credentialManagement = new CredentialManagementService(
          credentialRepository,
          idempotencyHasher,
        );
        policyManagement = new PolicyManagementService(
          new PolicyManagementRepository(persistence),
          idempotencyHasher,
        );
        if (options.credentialVaultClient !== undefined) {
          credentialVault = new CredentialVaultCoordinator(
            persistence,
            credentialRepository,
            options.credentialVaultClient,
            Date.now,
            randomUUID,
            idempotencyHasher,
          );
          await credentialVault.reconcilePending();
        }
        const serviceAuthorization = new ServiceManagementAuthorization(
          serviceRelationships,
          stepUpAuthorization,
        );
        userAdministration = new UserAdministrationService(
          new UserAdministrationRepository(persistence),
          new UserCursorCodec(sessionKey),
          serviceRelationships,
        );
        const userLifecycle = new UserLifecycleAdministrationService(
          new UserLifecycleAdministrationRepository(persistence, stepUpRepository),
          idempotencyHasher,
          config.identity,
          serviceRelationships,
        );
        if (config.identity.oidc !== undefined) {
          const oidcTrust = new OidcTrustClient(config.identity.oidc);
          oidcFlow = new OidcFlowService(
            new OidcFlowRepository(persistence, Date.now, stepUpRepository),
            oidcTrust,
            identityKeyRing,
            config.identity.oidc,
            sessionKey,
          );
          oidcLogin = new OidcLoginService(
            new OidcLoginRepository(persistence),
            config.identity,
            sessionKey,
          );
          oidcLink = new OidcLinkService(
            new OidcLinkRepository(persistence, stepUpRepository),
            config.identity,
            sessionKey,
          );
          if (
            config.auth.mode === "builtin_oauth"
            && config.auth.builtinOAuth.identitySource === "database"
            && config.auth.builtinOAuth.tokenHmacKeyFile !== undefined
          ) {
            const tokenKey = readVaultKeyFile(
              config.auth.builtinOAuth.tokenHmacKeyFile,
            );
            try {
              databaseOAuthHasher = new DatabaseOAuthTokenHasher(tokenKey);
              oauthIntentState = new OAuthIntentStateCodec(tokenKey);
            } finally {
              tokenKey.fill(0);
            }
          }
        }
        localIdentity = {
          authentication: localAuthentication,
          browserSessions,
          stepUp,
          authorization: new UserManagementAuthorization(
            serviceAuthorization,
            serviceRelationships,
          ),
          enrollment,
          restrictedSessions,
          authenticator: new LocalControlAuthenticator(browserSessions, restrictedSessions),
          users: userAdministration,
          userLifecycle,
          ...(oidcFlow === undefined ||
            oidcLogin === undefined ||
            oidcLink === undefined ||
            config.identity.oidc === undefined
            ? {}
            : {
                oidc: {
                  flow: oidcFlow,
                  login: oidcLogin,
                  providers: config.identity.oidc.providers,
                  flowTtlMs: config.identity.oidc.flowTtlMs,
                  link: oidcLink,
                  ...(databaseOAuthHasher === undefined
                    || oauthIntentState === undefined
                    || config.auth.mode !== "builtin_oauth"
                    ? {}
                    : {
                        mcpOAuth: {
                          repository: new DatabaseOAuthRepository(
                            persistence,
                            databaseOAuthHasher,
                            {
                              accessTokenTtlMs:
                                config.auth.builtinOAuth.accessTokenTtlMs,
                              authorizationCodeTtlMs:
                                config.auth.builtinOAuth.authorizationCodeTtlMs,
                              refreshTokenIdleTtlMs:
                                config.auth.builtinOAuth.refreshTokenIdleTtlMs,
                              refreshTokenMaxTtlMs:
                                config.auth.builtinOAuth.refreshTokenMaxTtlMs,
                              maxAuthorizationCodes:
                                config.limits.maxAuthorizationCodes,
                              maxTokenRecords:
                                config.limits.maxRefreshTokenRecords,
                            },
                          ),
                          intentState: oauthIntentState,
                        },
                      }),
                },
              }),
        };
      } finally {
        sessionKey.fill(0);
      }
    }
    apiKeyAuthenticator = await SystemApiKeyAuthenticator.create(
      apiKeyRepository,
      localIdentity?.authenticator ?? denyControlAuthentication,
    );
    server = createControlApplication(config, {
      persistence,
      ...options,
      authenticator: apiKeyAuthenticator,
      ...(localIdentity === undefined
        ? {}
        : { identityReadiness: async () => "ready" as const }),
      ...(localIdentity === undefined ? {} : { localIdentity }),
      ...(serviceManagement === undefined ? {} : { serviceManagement }),
      ...(groupAssignments === undefined ? {} : { groupAssignments }),
      ...(credentialManagement === undefined ? {} : { credentialManagement }),
      ...(credentialVault === undefined ? {} : { credentialVault }),
      ...(policyManagement === undefined ? {} : { policyManagement }),
      ...(accessManagement === undefined ? {} : { accessManagement }),
      ...(apiKeyManagement === undefined ? {} : { apiKeys: apiKeyManagement }),
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
    oidcFlow?.close();
    oidcLogin?.close();
    oidcLink?.close();
    databaseOAuthHasher?.close();
    oauthIntentState?.close();
    accessCursor?.close();
    apiKeyManagement?.cursors.close();
    serviceManagement?.close();
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
        oidcFlow?.close();
        oidcLogin?.close();
        oidcLink?.close();
        databaseOAuthHasher?.close();
        oauthIntentState?.close();
        accessCursor?.close();
        apiKeyManagement?.cursors.close();
        serviceManagement?.close();
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

function sensitiveFailureAudit(persistence: PersistenceOwner): ControlSensitiveFailureAudit {
  return {
    record: async ({ route, authentication, body, params, requestId, error }) => {
      const targetId = safeAuditTargetId(route.id, authentication?.principalId, params);
      const justification = safeAuditJustification(body);
      await persistence.execute({
        run: (database) => {
          database.appendAdministrativeAudit({
            actor: authentication === undefined
              ? {
                  type: "system",
                  label: "unauthenticated request",
                  authenticationMethod: "none",
                }
              : {
                  type: authentication.method === "restricted_session"
                    ? "browser_session"
                    : authentication.method,
                  ...(isUuidV7(authentication.principalId)
                    ? { id: authentication.principalId }
                    : {}),
                  label: `principal ${authentication.principalId}`,
                  role: authentication.role,
                  authenticationMethod: authentication.method,
                },
            action: route.auditAction!,
            result: error.statusCode === 401 || error.statusCode === 403 || error.statusCode === 404
              ? "deny"
              : "error",
            target: {
              type: route.tags.includes("Users") ? "user" : "control_resource",
              ...(targetId === undefined ? {} : { id: targetId }),
              label: targetId === undefined ? route.id : `user ${targetId}`,
            },
            ...(justification === undefined ? {} : { justification }),
            changes: [],
            correlationId: requestId,
            source: { category: "control_http" },
            failureCode: error.code,
          } satisfies AdministrativeAuditEventInput);
        },
      });
    },
  };
}

function safeAuditTargetId(
  routeId: string,
  principalId: string | undefined,
  params: unknown,
): string | undefined {
  if (routeId.startsWith("identity.self_") && principalId !== undefined && isUuidV7(principalId)) {
    return principalId;
  }
  if (params === null || typeof params !== "object") return undefined;
  const candidate = (params as Record<string, unknown>).user_id;
  return typeof candidate === "string" && isUuidV7(candidate) ? candidate : undefined;
}

function safeAuditJustification(body: unknown): string | undefined {
  if (body === null || typeof body !== "object") return undefined;
  const candidate = (body as Record<string, unknown>).justification;
  return typeof candidate === "string" ? candidate : undefined;
}
