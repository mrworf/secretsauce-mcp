import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { authenticateRequest, buildAuthenticateChallenge, requireScopes } from "./auth.js";
import { handleBuiltinOAuthRequest, isBuiltinOAuthRequest } from "./builtinOAuth.js";
import { loadConfig } from "./config.js";
import { handleMcpRequest, isMcpDelete, isMcpGet, isMcpPost, readJsonBody } from "./mcp/server.js";
import { handleOAuthMetadataRequest, isOAuthMetadataRequest } from "./oauthMetadata.js";
import { createLogger } from "./logger.js";
import type { GatewayConfig } from "./types.js";
import type { AuthContext } from "./types.js";
import { RequestBodyError } from "./httpBody.js";
import { handleBrandAssetRequest, isBrandAssetRequest } from "./brandAssets.js";
import { GatewayError, type ConfigDiagnostic } from "./errors.js";
import type { AuditSink } from "./audit.js";
import { GatewayRuntime } from "./runtime.js";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ConsoleStore, loadManagedConfig, normalizeManagedOAuthPath } from "./consoleStore.js";
import { handleConsoleRequest, isConsoleRequest } from "./consoleHttp.js";
import { consoleNotifications } from './consoleNotifications.js';
import { bindConsoleServices } from "./consoleServices.js";
import { bindConsoleAuthentication } from "./consoleAuthentication.js";
import { bindConsoleClients } from "./consoleClients.js";
import { requiredScopeForTool } from "./mcp/tools.js";

type AuthenticatedRequest = IncomingMessage & { auth?: AuthContext };

export function createGatewayServer(
  config: GatewayConfig,
  options: { auditSink?: AuditSink; runtime?: GatewayRuntime; closeRuntimeOnServerClose?: boolean; consoleStore?: ConsoleStore } = {},
) {
  const logger = createLogger(config.logging);
  for (const message of config.warnings) {
    logger.warn("config.warning", { message });
  }
  for (const diagnostic of config.debugDiagnostics) {
    logger.debug("config.credential_source_contains_whitespace", {
      service: diagnostic.serviceId,
      access_id: diagnostic.credentialId,
      suggestion: "Store only the credential value and describe static request syntax with usage prefix or suffix.",
    });
  }
  if(options.consoleStore)normalizeManagedOAuthPath(config,options.consoleStore.directory);
  const runtime = options.runtime ?? new GatewayRuntime(config, { ...(options.auditSink === undefined ? {} : { auditSink: options.auditSink }) });
  const auditSink = runtime.auditSink;
  if(options.consoleStore) { auditSink.bindConsole(options.consoleStore); runtime.builtinOAuth.bindManaged(options.consoleStore); bindConsoleClients(options.consoleStore,runtime.builtinOAuth); const manager = bindConsoleServices(options.consoleStore, config); bindConsoleAuthentication(options.consoleStore,runtime.builtinOAuth); manager.invalidate = (service, subject) => runtime.capabilities.tokenBroker.revoke(service, subject); runtime.builtinOAuth.invalidateSubject = subject => { for (const service of Object.keys(manager.state.services)) manager.invalidate(service,subject); }; options.consoleStore.invalidateUser = subject => { runtime.builtinOAuth.revokeSubject(subject); for (const service of Object.keys(manager.state.services)) manager.invalidate(service, subject); const user=options.consoleStore!.state.users.find(u=>u.id===subject);if(user)void consoleNotifications(options.consoleStore!).send('security',user.email,'Account security or access changed. Previous sessions and client grants were revoked; contact your Owner if unexpected.').catch(()=>{}); }; config.managedAdmission = (subject, service) => manager.admit(subject, service); }
  const server = createServer(async (request, response) => {
    if (options.consoleStore && isConsoleRequest(request)) { await handleConsoleRequest(options.consoleStore, request, response); return; }
    if (request.method === "GET" && request.url === "/health") {
      logger.debug("http.health", { method: request.method, path: "/health", service_count: Object.keys(config.services).length });
      writeJson(response, auditSink.degraded ? 503 : 200, {
        status: auditSink.degraded ? "not_ready" : "ready",
      });
      return;
    }

    if (isBrandAssetRequest(request)) {
      handleBrandAssetRequest(request, response);
      return;
    }

    if (isOAuthMetadataRequest(request)) {
      logger.debug("oauth.metadata_request", { method: request.method, path: request.url });
      handleOAuthMetadataRequest(config, request, response);
      return;
    }

    if (isBuiltinOAuthRequest(config, request)) {
      logger.debug("oauth.builtin_request", { method: request.method, path: request.url?.split("?")[0] });
      await handleBuiltinOAuthRequest(config, request, response, runtime.builtinOAuth);
      return;
    }

    if (isMcpPost(request, config.server.mcpPath)) {
      let requiredScopes = configuredMcpScopes(config);
      try {
        const authenticatedConfiguration = config.auth, authenticatedResource = config.server.resource, authenticatedPath = config.server.mcpPath;
        const registeredExternalSnapshot=options.consoleStore?.state.people?.external.map(e=>({...e}));
        const auth = await authenticateRequest(request, config);
        if (options.consoleStore) {
          const external = auth.mode==='oauth' && authenticatedConfiguration.mode==='oauth' ? registeredExternalSnapshot?.find(e=>e.issuer===authenticatedConfiguration.oauth.issuer && e.subject===auth.subject && e.active) : undefined;
          if(auth.mode==='oauth' && !external) throw new GatewayError('unauthenticated','External identity is not registered and eligible.');
          const externalGeneration=external?.authorizationGeneration??0;
          if(external)auth.subject=external.id;
          auth.assertCurrent = () => {
            if(!options.consoleStore!.storageReliable)throw new GatewayError('unauthenticated','Identity storage unavailable.');
            if (config.auth !== authenticatedConfiguration || config.server.resource !== authenticatedResource || config.server.mcpPath !== authenticatedPath) throw new GatewayError('unauthenticated','Authentication settings changed. Reconnect your client.');
            if(external){const current=options.consoleStore!.state.people?.external.find(e=>e.id===external.id);if(!current?.active || current.issuer!==external.issuer || current.subject!==external.subject || (current.authorizationGeneration??0)!==externalGeneration)throw new GatewayError('unauthenticated','Current external identity unavailable.');}
            if (auth.mode === 'builtin_oauth') runtime.builtinOAuth.assertGrant(auth.subject,auth.grantId,auth.authorizationGeneration);
          };
          auth.assertCurrent();
        }
        const body = await readJsonBody(request, config.limits.maxInboundBodyBytes, config.limits.inboundBodyTimeoutMs);
        requiredScopes = requiredScopesForMcpBody(body);
        auth.assertCurrent?.();
        requireScopes(auth, requiredScopes);
        (request as AuthenticatedRequest).auth = auth;
        logger.debug("mcp.request_authenticated", {
          method: request.method,
          path: config.server.mcpPath,
          rpc: summarizeMcpBody(body),
          required_scopes: requiredScopes,
          subject: auth.subject,
          auth_mode: auth.mode,
        });
        await handleMcpRequest(config, request, response, body, {
          auditSink: runtime.auditSink,
          capabilities: runtime.capabilities,
          secretRuntime: runtime.secretRuntime,
        });
      } catch (error) {
        if (error instanceof RequestBodyError) {
          response.setHeader("connection", "close");
          response.once("finish", () => request.destroy());
          writeJson(response, error.statusCode, { error: { code: error.code, message: error.message } });
          return;
        }
        if (error instanceof Error && error.name === "GatewayError") {
          logger.debug("mcp.request_rejected", {
            method: request.method,
            path: config.server.mcpPath,
            required_scopes: requiredScopes,
            error_code: "unauthenticated",
            message: error.message,
          });
          writeAuthError(response, buildAuthenticateChallenge(config, request, requiredScopes));
          return;
        }
        writeJson(response, 400, {
          error: {
            code: "invalid_request",
            message: "Invalid MCP request.",
          },
        });
      }
      return;
    }

    if (isMcpGet(request, config.server.mcpPath) || isMcpDelete(request, config.server.mcpPath)) {
      try {
        const authenticatedConfiguration = config.auth, authenticatedResource = config.server.resource, authenticatedPath = config.server.mcpPath;
        const registeredExternalSnapshot=options.consoleStore?.state.people?.external.map(e=>({...e}));
        const auth = await authenticateRequest(request, config);
        if (options.consoleStore) {
          const external = auth.mode==='oauth' && authenticatedConfiguration.mode==='oauth' ? registeredExternalSnapshot?.find(e=>e.issuer===authenticatedConfiguration.oauth.issuer && e.subject===auth.subject && e.active) : undefined;
          if(auth.mode==='oauth' && !external) throw new GatewayError('unauthenticated','External identity is not registered and eligible.');
          const externalGeneration=external?.authorizationGeneration??0;
          if(external)auth.subject=external.id;
          auth.assertCurrent = () => {
            if(!options.consoleStore!.storageReliable)throw new GatewayError('unauthenticated','Identity storage unavailable.');
            if (config.auth !== authenticatedConfiguration || config.server.resource !== authenticatedResource || config.server.mcpPath !== authenticatedPath) throw new GatewayError('unauthenticated','Authentication settings changed. Reconnect your client.');
            if(external){const current=options.consoleStore!.state.people?.external.find(e=>e.id===external.id);if(!current?.active || current.issuer!==external.issuer || current.subject!==external.subject || (current.authorizationGeneration??0)!==externalGeneration)throw new GatewayError('unauthenticated','Current external identity unavailable.');}
            if (auth.mode === 'builtin_oauth') runtime.builtinOAuth.assertGrant(auth.subject,auth.grantId,auth.authorizationGeneration);
          };
          auth.assertCurrent();
        }
        (request as AuthenticatedRequest).auth = auth;
        logger.debug("mcp.request_authenticated", {
          method: request.method,
          path: config.server.mcpPath,
          required_scopes: [],
          subject: auth.subject,
          auth_mode: auth.mode,
        });
      } catch (error) {
        if (error instanceof Error && error.name === "GatewayError") {
          logger.debug("mcp.request_rejected", {
            method: request.method,
            path: config.server.mcpPath,
            required_scopes: [],
            error_code: "unauthenticated",
            message: error.message,
          });
          writeAuthError(response, buildAuthenticateChallenge(config, request));
          return;
        }
        writeJson(response, 400, {
          error: {
            code: "invalid_request",
            message: "Invalid MCP request.",
          },
        });
        return;
      }
      writeJson(response, 405, {
        error: {
          code: "method_not_allowed",
          message: "Stateless MCP supports POST requests only.",
        },
      });
      return;
    }

    writeJson(response, 404, {
      error: {
        code: "not_found",
        message: "Not found.",
      },
    });
  });
  if (options.closeRuntimeOnServerClose !== false) {
    server.once("close", () => {
      void runtime.close().catch(() => logger.error("runtime.close_failed"));
    });
  }
  return server;
}

function writeAuthError(response: ServerResponse, challenge: string): void {
  response.writeHead(401, {
    "content-type": "application/json; charset=utf-8",
    "www-authenticate": challenge,
  });
  response.end(`${JSON.stringify({
    error: {
      code: "unauthenticated",
      message: "Authentication required.",
    },
  })}\n`);
}

function requiredScopesForMcpBody(body: unknown): string[] {
  if (Array.isArray(body)) {
    return [...new Set(body.flatMap((message) => requiredScopesForMcpBody(message)))];
  }
  if (!body || typeof body !== "object") return [];
  const message = body as { method?: unknown; params?: { name?: unknown } };
  if (message.method === "tools/list") return ["gateway.read"];
  if (message.method !== "tools/call") return [];
  const scope = requiredScopeForTool(message.params?.name);
  return scope === undefined ? [] : [scope];
}

function configuredMcpScopes(config: GatewayConfig): string[] {
  if (config.auth.mode === "oauth") return config.auth.oauth.requiredScopes;
  if (config.auth.mode === "builtin_oauth") return config.auth.builtinOAuth.requiredScopes;
  return ["gateway.read", "gateway.references", "gateway.request"];
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(`${JSON.stringify(body)}\n`);
}

export interface GatewayApplication {
  server: Server;
  runtime: GatewayRuntime;
  close(): Promise<void>;
}

export async function startServer(config: GatewayConfig): Promise<GatewayApplication> {
  const consoleStore = process.env.CONSOLE_STORAGE_DIR && process.env.CONSOLE_KEY_FILE ? new ConsoleStore(process.env.CONSOLE_STORAGE_DIR, process.env.CONSOLE_KEY_FILE, { config }) : undefined;
  if ((process.env.CONSOLE_STORAGE_DIR || process.env.CONSOLE_KEY_FILE) && !consoleStore) throw new Error("Protected console encryption material required.");
  if (consoleStore) { if (!consoleStore.state.config) { consoleStore.close(); throw new Error("Managed configuration missing."); } config = consoleStore.state.config; }
  let runtime: GatewayRuntime;
  try { runtime = new GatewayRuntime(config); } catch (error) { consoleStore?.close(); throw error; }
  let server: ReturnType<typeof createGatewayServer>;
  const logger = createLogger(config.logging);
  try {
    server = createGatewayServer(config, { runtime, closeRuntimeOnServerClose: false, ...(consoleStore ? { consoleStore } : {}) });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(config.server.port, config.server.host, () => {
        server.off("error", reject);
        resolve();
      });
    });
  } catch (error) {
    await runtime.close();
    consoleStore?.close();
    throw error;
  }
  logger.info("server.started", {
    listen: config.server.listen,
    mcp_path: config.server.mcpPath,
  });
  let closePromise: Promise<void> | undefined;
  return {
    server,
    runtime,
    close: () => {
      closePromise ??= (async () => {
        await closeHttpServer(server);
        await runtime.close();
        consoleStore?.close();
      })();
      return closePromise;
    },
  };
}

function closeHttpServer(server: Server): Promise<void> {
  if (!server.listening) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

interface SignalTarget {
  once(event: NodeJS.Signals, listener: (signal: NodeJS.Signals) => void): unknown;
  off(event: NodeJS.Signals, listener: (signal: NodeJS.Signals) => void): unknown;
  exitCode: string | number | null | undefined;
}

export function installShutdownSignalHandlers(
  application: Pick<GatewayApplication, "close">,
  logger: ReturnType<typeof createLogger>,
  signalTarget: SignalTarget = process,
): { uninstall(): void; completion(): Promise<void> | undefined } {
  let shutdown: Promise<void> | undefined;
  const uninstall = () => {
    signalTarget.off("SIGTERM", handleSignal);
    signalTarget.off("SIGINT", handleSignal);
  };
  const handleSignal = (signal: NodeJS.Signals) => {
    shutdown ??= application.close()
      .then(() => {
        logger.info("runtime.shutdown_completed", { signal });
        signalTarget.exitCode = 0;
      })
      .catch((error: unknown) => {
        logger.error("runtime.shutdown_failed", {
          signal,
          error_type: error instanceof Error ? error.name : "UnknownError",
        });
        signalTarget.exitCode = 1;
      })
      .finally(uninstall);
  };
  signalTarget.once("SIGTERM", handleSignal);
  signalTarget.once("SIGINT", handleSignal);
  return { uninstall, completion: () => shutdown };
}

function summarizeMcpBody(body: unknown): Record<string, unknown> {
  const messages = Array.isArray(body) ? body : [body];
  const methods = messages
    .filter((message): message is { method?: unknown; params?: { name?: unknown } } => Boolean(message) && typeof message === "object")
    .map((message) => ({
      method: typeof message.method === "string" ? message.method : "unknown",
      ...(typeof message.params?.name === "string" ? { tool: message.params.name } : {}),
    }));
  return { message_count: methods.length, methods };
}

export function requestBody(_request: IncomingMessage): never {
  throw new Error("Request body handling is not implemented in milestone 01.");
}

export function startupErrorPayload(error: unknown): Record<string, unknown> {
  const gatewayError = error instanceof GatewayError ? error : undefined;
  const message = error instanceof Error ? error.message : "Unknown startup error.";
  return {
    level: "error",
    error: {
      code: gatewayError?.code ?? "config_error",
      message,
      ...(gatewayError?.diagnostics === undefined ? {} : {
        diagnostics: gatewayError.diagnostics.map(publicConfigDiagnostic),
      }),
    },
  };
}

function publicConfigDiagnostic(diagnostic: ConfigDiagnostic): Omit<ConfigDiagnostic, "configPath"> {
  const { configPath: _configPath, ...publicDiagnostic } = diagnostic;
  return publicDiagnostic;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const configPath = process.env.CONFIG_PATH;
  const managedDirectory = process.env.CONSOLE_STORAGE_DIR;
  const managedKey = process.env.CONSOLE_KEY_FILE;
  const hasManaged = managedDirectory !== undefined && existsSync(join(managedDirectory, "managed"));
  if (!configPath && !hasManaged) {
    console.error(JSON.stringify({
      level: "error",
      error: {
        code: "config_error",
        message: "CONFIG_PATH is required.",
      },
    }));
    process.exit(1);
  }

  try {
    const config = hasManaged ? loadManagedConfig(managedDirectory!, managedKey ?? "") : loadConfig(configPath!);
    const application = await startServer(config);
    installShutdownSignalHandlers(application, createLogger(config.logging));
  } catch (error) {
    console.error(JSON.stringify(startupErrorPayload(error)));
    process.exit(1);
  }
}
