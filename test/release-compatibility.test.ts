import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtempSync } from "node:fs";
import { createServer, request as httpRequest, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AccessCursorCodec,
  AccessManagementRepository,
} from "../src/accessManagement.js";
import {
  BuiltinOAuthRuntime,
  type DatabaseBuiltinOAuthServices,
} from "../src/builtinOAuth.js";
import { validateConfig } from "../src/config.js";
import { IdentityRepository } from "../src/identity/repository.js";
import { IdentityKeyRing } from "../src/identity/totp.js";
import {
  DatabaseOAuthRepository,
  DatabaseOAuthTokenHasher,
} from "../src/oauth/databaseOAuth.js";
import { OAuthIntentStateCodec } from "../src/oauth/intentState.js";
import { setOAuthClientMetadataTestFetch } from "../src/oauthClientMetadata.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import { GatewayRuntime } from "../src/runtime.js";
import { createGatewayServer } from "../src/server.js";
import type { GatewayConfig } from "../src/types.js";

const SERVICE_ID = "018f1f2e-7b3c-7a10-8000-000000000701";
const SNAPSHOT_ID = "018f1f2e-7b3c-7a10-8000-000000000702";
const ASSIGNMENT_ID = "018f1f2e-7b3c-7a10-8000-000000000703";
const REVISION_ID = "018f1f2e-7b3c-7a10-8000-000000000704";
const TOKEN_KEY = Buffer.alloc(32, 107);
const CLIENTS = [
  {
    key: "codex",
    name: "Codex release fixture",
    identifier: "https://codex.example.org/oauth/client.json",
    redirectUri: "https://codex.example.org/oauth/callback",
  },
  {
    key: "chatgpt",
    name: "ChatGPT release fixture",
    identifier: "https://chatgpt.example.org/oauth/client.json",
    redirectUri: "https://chatgpt.example.org/oauth/callback",
  },
] as const;

const workers = new Set<PersistenceWorker>();
const codecs = new Set<AccessCursorCodec>();

afterEach(async () => {
  setOAuthClientMetadataTestFetch(undefined);
  for (const codec of codecs) codec.close();
  codecs.clear();
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("release client compatibility", () => {
  it("runs independent Codex and ChatGPT OAuth/MCP journeys through restart and revocation", async () => {
    const fixture = await createDatabaseIdentityFixture();
    const config = releaseConfig(fixture.userId);
    setOAuthClientMetadataTestFetch(async (input) => {
      const identifier = String(input);
      const client = CLIENTS.find((candidate) => candidate.identifier === identifier);
      if (client === undefined) return new Response("not found", { status: 404 });
      return new Response(JSON.stringify({
        client_id: client.identifier,
        client_name: client.name,
        redirect_uris: [client.redirectUri],
      }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "cache-control": "max-age=60",
        },
      });
    });

    const firstRuntime = releaseRuntime(config, fixture.worker, fixture.userId);
    const firstServer = await listen(config, firstRuntime);
    const issued = new Map<string, OAuthTokens>();
    try {
      const resource = await getJson(`${firstServer.baseUrl}/.well-known/oauth-protected-resource`);
      expect(resource.response.status).toBe(200);
      expect(resource.body).toMatchObject({
        resource: "https://mcp.example.org",
        authorization_servers: ["https://mcp.example.org"],
      });
      const discovery = await getJson(`${firstServer.baseUrl}/.well-known/oauth-authorization-server`);
      expect(discovery.response.status).toBe(200);
      expect(discovery.body).toMatchObject({
        issuer: "https://mcp.example.org",
        authorization_endpoint: "https://mcp.example.org/oauth/authorize",
        token_endpoint: "https://mcp.example.org/oauth/token",
      });

      for (const client of CLIENTS) {
        const tokens = await authorizeClient(firstServer.baseUrl, client);
        issued.set(client.key, tokens);
        await expectMcpJourney(firstServer.baseUrl, tokens.accessToken, client.name);
      }

      const missing = await postMcp(firstServer.baseUrl, undefined, {
        jsonrpc: "2.0",
        id: 90,
        method: "tools/list",
      });
      expect(missing.response.status).toBe(401);
      expect(missing.response.headers.get("mcp-session-id")).toBeNull();
    } finally {
      await firstServer.close();
      await firstRuntime.close();
    }

    const secondRuntime = releaseRuntime(config, fixture.worker, fixture.userId);
    const secondServer = await listen(config, secondRuntime);
    try {
      const refreshed = new Map<string, OAuthTokens>();
      for (const client of CLIENTS) {
        const original = issued.get(client.key);
        expect(original).toBeDefined();
        const rotated = await refreshClient(
          secondServer.baseUrl,
          client,
          original!.refreshToken,
        );
        expect(rotated.refreshToken).not.toBe(original!.refreshToken);
        refreshed.set(client.key, rotated);
        await expectMcpJourney(secondServer.baseUrl, rotated.accessToken, client.name);
      }

      const grants = await fixture.worker.execute({
        run: (database) => database.read((query) => query.all<{
          id: string;
          client_identifier: string;
        }>(`
          SELECT grant.id, client.client_identifier
          FROM oauth_grants grant
          JOIN oauth_clients client ON client.id = grant.client_id
          ORDER BY client.client_identifier
        `)),
      });
      expect(grants).toHaveLength(2);

      const access = accessRepository(fixture.worker);
      const codexGrant = grants.find(({ client_identifier }) =>
        client_identifier === CLIENTS[0].identifier
      );
      expect(codexGrant).toBeDefined();
      await expect(access.revokeGrant({
        viewer: { userId: fixture.userId, role: "user" },
        grantId: codexGrant!.id,
        correlationId: `req_${randomUUID()}`,
      })).resolves.toMatchObject({ revoked: true, grantsRevoked: 1 });

      const codexTokens = refreshed.get("codex")!;
      const deniedCodex = await postMcp(secondServer.baseUrl, codexTokens.accessToken, {
        jsonrpc: "2.0",
        id: 91,
        method: "tools/list",
      });
      expect(deniedCodex.response.status).toBe(401);
      const deniedRefresh = await refreshClientResponse(
        secondServer.baseUrl,
        CLIENTS[0],
        codexTokens.refreshToken,
      );
      expect(deniedRefresh.status).toBe(400);
      expect(JSON.parse(deniedRefresh.body)).toEqual({ error: "invalid_grant" });

      const chatgptTokens = refreshed.get("chatgpt")!;
      await expectMcpJourney(
        secondServer.baseUrl,
        chatgptTokens.accessToken,
        CLIENTS[1].name,
      );
      const chatgptGrant = grants.find(({ client_identifier }) =>
        client_identifier === CLIENTS[1].identifier
      );
      expect(chatgptGrant).toBeDefined();
      await expect(access.revokeGrant({
        viewer: { userId: fixture.userId, role: "user" },
        grantId: chatgptGrant!.id,
        correlationId: `req_${randomUUID()}`,
      })).resolves.toMatchObject({ revoked: true, grantsRevoked: 1 });
      const deniedChatgpt = await postMcp(
        secondServer.baseUrl,
        chatgptTokens.accessToken,
        {
          jsonrpc: "2.0",
          id: 92,
          method: "tools/list",
        },
      );
      expect(deniedChatgpt.response.status).toBe(401);
    } finally {
      await secondServer.close();
      await secondRuntime.close();
    }
  }, 30_000);
});

interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
}

async function createDatabaseIdentityFixture(): Promise<{
  worker: PersistenceWorker;
  userId: string;
}> {
  const databaseFile = join(
    mkdtempSync(join(tmpdir(), "secretsauce-release-clients-")),
    "control.sqlite",
  );
  const worker = PersistenceWorker.open({
    databaseFile,
    productVersion: "release-test",
  });
  workers.add(worker);
  const identities = new IdentityRepository(worker);
  const user = await identities.createLocalIdentity({
    profile: {
      email: "release-user@example.org",
      givenName: "Release",
      familyName: "User",
    },
    role: "user",
    status: "active",
  }, {
    actor: {
      type: "local_cli",
      label: "release-fixture",
      authenticationMethod: "host_terminal",
    },
    correlationId: `req_${randomUUID()}`,
    source: { category: "identity" },
  });
  const now = Date.now();
  await worker.execute({
    run: (database) => database.withOperationalTransaction((transaction) => {
      transaction.run(`
        UPDATE local_authenticator_states
        SET password_state = 'configured', totp_state = 'configured',
            version = version + 1, updated_at = ?
        WHERE user_id = ?
      `, [now, user.id]);
      transaction.run(`
        INSERT INTO services (
          id, slug, name, description, documentation_url, lifecycle,
          draft_digest, published_revision_id, published_digest,
          publication_generation, version, created_at, updated_at
        ) VALUES (?, 'release-api', 'Release API', NULL, NULL, 'published',
          ?, ?, ?, 1, 1, ?, ?)
      `, [
        SERVICE_ID,
        "a".repeat(64),
        REVISION_ID,
        "b".repeat(64),
        now,
        now,
      ]);
      transaction.run(`
        INSERT INTO runtime_service_snapshots (
          id, service_id, publication_generation, document_json, digest,
          created_at
        ) VALUES (?, ?, 1, '{}', ?, ?)
      `, [SNAPSHOT_ID, SERVICE_ID, "c".repeat(64), now]);
      transaction.run(`
        UPDATE runtime_activation
        SET state = 'active', activation_generation = 1,
            global_reference_epoch = 1, version = 2,
            activated_at = ?, updated_at = ?
        WHERE singleton = 1
      `, [now, now]);
      transaction.run(`
        INSERT INTO runtime_active_services (
          service_id, snapshot_id, publication_generation, activated_at
        ) VALUES (?, ?, 1, ?)
      `, [SERVICE_ID, SNAPSHOT_ID, now]);
      transaction.run(`
        INSERT INTO service_principal_assignments (
          id, service_id, selector_kind, group_id, user_id,
          assigned_by_user_id, created_at
        ) VALUES (?, ?, 'user', NULL, ?, ?, ?)
      `, [ASSIGNMENT_ID, SERVICE_ID, user.id, user.id, now]);
    }),
  });
  return { worker, userId: user.id };
}

function releaseConfig(userId: string): GatewayConfig {
  const config = validateConfig({
    server: {
      listen: "127.0.0.1:8080",
      mcp_path: "/mcp",
      resource: "https://mcp.example.org",
    },
    auth: {
      mode: "bearer",
      bearer: { token_env: "RELEASE_FIXTURE_TOKEN" },
    },
    services: {
      "release-api": {
        type: "http",
        name: "Release API",
        destinations: [{
          name: "primary",
          base_url: "https://api.example.org",
        }],
        no_auth: true,
        access: { users: [userId] },
      },
    },
  }, {
    RELEASE_FIXTURE_TOKEN: "synthetic-fixture-token",
  });
  config.auth = {
    mode: "builtin_oauth",
    builtinOAuth: {
      issuer: "https://mcp.example.org",
      identitySource: "database",
      accessTokenTtlMs: 5 * 60_000,
      authorizationCodeTtlMs: 5 * 60_000,
      refreshTokenIdleTtlMs: 30 * 86_400_000,
      refreshTokenMaxTtlMs: 90 * 86_400_000,
      allowedClients: CLIENTS.map(({ identifier }) => new URL(identifier).origin),
      requiredScopes: [
        "gateway.read",
        "gateway.references",
        "gateway.request",
      ],
      loginRateLimit: {
        windowMs: 15 * 60_000,
        perSource: 20,
        perAccount: 20,
        global: 40,
        initialLockoutMs: 15 * 60_000,
        maxLockoutMs: 60 * 60_000,
        maxEntries: 100,
      },
    },
  };
  return config;
}

function releaseRuntime(
  config: GatewayConfig,
  worker: PersistenceWorker,
  userId: string,
): GatewayRuntime {
  const hasher = new DatabaseOAuthTokenHasher(Buffer.from(TOKEN_KEY));
  const repository = new DatabaseOAuthRepository(worker, hasher, {
    accessTokenTtlMs: 5 * 60_000,
    authorizationCodeTtlMs: 5 * 60_000,
    refreshTokenIdleTtlMs: 30 * 86_400_000,
    refreshTokenMaxTtlMs: 90 * 86_400_000,
    maxAuthorizationCodes: 100,
    maxTokenRecords: 100,
  });
  let acceptedTotpStep = Math.floor(Date.now() / 30_000);
  const keyRing = new IdentityKeyRing("release", {
    release: Buffer.alloc(32, 108),
  });
  const intentState = new OAuthIntentStateCodec(Buffer.from(TOKEN_KEY));
  const services = {
    repository,
    localAuthentication: {
      verifyMcpProof: async () => ({
        userId,
        role: "user" as const,
        securityEpoch: 1,
        globalSecurityEpoch: 1,
        acceptedTotpStep: acceptedTotpStep++,
        verifiedAt: Date.now(),
        correlationId: `req_${randomUUID()}`,
      }),
      close: () => undefined,
    },
    keyRing,
    hasher,
    intentState,
  } as unknown as DatabaseBuiltinOAuthServices;
  const builtinOAuth = new BuiltinOAuthRuntime(config, {
    database: Promise.resolve(services),
  });
  return new GatewayRuntime(config, { builtinOAuth });
}

function accessRepository(worker: PersistenceWorker): AccessManagementRepository {
  const codec = new AccessCursorCodec(Buffer.alloc(32, 109));
  codecs.add(codec);
  return new AccessManagementRepository(
    worker,
    {
      adminAbsoluteMs: 12 * 3_600_000,
      adminInactivityMs: 15 * 60_000,
      userAbsoluteMs: 24 * 3_600_000,
      userInactivityMs: 60 * 60_000,
    },
    {
      accessTokenTtlMs: 5 * 60_000,
      refreshTokenIdleTtlMs: 30 * 86_400_000,
      refreshTokenMaxTtlMs: 90 * 86_400_000,
    },
    codec,
  );
}

async function authorizeClient(
  baseUrl: string,
  client: typeof CLIENTS[number],
): Promise<OAuthTokens> {
  const verifier = `${client.key}-release-verifier`.padEnd(43, "v");
  const authorize = await formRequest(`${baseUrl}/oauth/authorize`, {
    response_type: "code",
    client_id: client.identifier,
    redirect_uri: client.redirectUri,
    scope: "gateway.read gateway.references gateway.request",
    state: `${client.key}-state`,
    code_challenge_method: "S256",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    resource: "https://mcp.example.org",
    username: "release-user@example.org",
    password: "synthetic-password",
    totp: "123456",
  });
  expect(authorize.status).toBe(302);
  expect(authorize.headers["cache-control"]).toBe("no-store");
  const location = new URL(authorize.headers.location ?? "");
  expect(location.origin + location.pathname).toBe(client.redirectUri);
  expect(location.searchParams.get("state")).toBe(`${client.key}-state`);
  const code = location.searchParams.get("code");
  expect(code).toBeTruthy();

  const token = await formRequest(`${baseUrl}/oauth/token`, {
    grant_type: "authorization_code",
    code: code!,
    client_id: client.identifier,
    redirect_uri: client.redirectUri,
    code_verifier: verifier,
    resource: "https://mcp.example.org",
  });
  expect(token.status).toBe(200);
  expect(token.headers["cache-control"]).toBe("no-store");
  const body = JSON.parse(token.body) as {
    access_token: string;
    refresh_token: string;
    token_type: string;
  };
  expect(body.token_type).toBe("Bearer");
  return { accessToken: body.access_token, refreshToken: body.refresh_token };
}

async function refreshClient(
  baseUrl: string,
  client: typeof CLIENTS[number],
  refreshToken: string,
): Promise<OAuthTokens> {
  const response = await refreshClientResponse(baseUrl, client, refreshToken);
  expect(response.status).toBe(200);
  expect(response.headers["cache-control"]).toBe("no-store");
  const body = JSON.parse(response.body) as {
    access_token: string;
    refresh_token: string;
  };
  return { accessToken: body.access_token, refreshToken: body.refresh_token };
}

function refreshClientResponse(
  baseUrl: string,
  client: typeof CLIENTS[number],
  refreshToken: string,
) {
  return formRequest(`${baseUrl}/oauth/token`, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: client.identifier,
    resource: "https://mcp.example.org",
  });
}

async function expectMcpJourney(
  baseUrl: string,
  accessToken: string,
  clientName: string,
): Promise<void> {
  const initialize = await postMcp(baseUrl, accessToken, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: clientName, version: "release" },
    },
  });
  expect(initialize.response.status).toBe(200);
  expect(initialize.response.headers.get("mcp-session-id")).toBeNull();
  expect(initialize.body.result.serverInfo.name).toBe("secretsauce-mcp");

  const listed = await postMcp(baseUrl, accessToken, {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  });
  expect(listed.response.status).toBe(200);
  expect(listed.response.headers.get("mcp-session-id")).toBeNull();
  expect(listed.body.result.tools.map((tool: { name: string }) => tool.name))
    .toContain("list_services");

  const called = await postMcp(baseUrl, accessToken, {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "list_services", arguments: {} },
  });
  expect(called.response.status).toBe(200);
  expect(called.response.headers.get("mcp-session-id")).toBeNull();
  expect(called.body.result.isError).not.toBe(true);
  expect(called.body.result.structuredContent.services).toEqual([
    expect.objectContaining({ id: "release-api", name: "Release API" }),
  ]);
}

async function postMcp(
  baseUrl: string,
  accessToken: string | undefined,
  body: Record<string, unknown>,
) {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      ...(accessToken === undefined
        ? {}
        : { authorization: `Bearer ${accessToken}` }),
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });
  return {
    response,
    body: await response.json() as any,
  };
}

async function getJson(url: string) {
  const response = await fetch(url);
  return {
    response,
    body: await response.json() as Record<string, unknown>,
  };
}

function formRequest(
  urlText: string,
  values: Record<string, string>,
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  const url = new URL(urlText);
  const body = new URLSearchParams(values).toString();
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "content-length": Buffer.byteLength(body),
      },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      response.on("end", () => resolve({
        status: response.statusCode ?? 0,
        headers: Object.fromEntries(
          Object.entries(response.headers).map(([key, value]) => [
            key,
            Array.isArray(value) ? value[0] ?? "" : value ?? "",
          ]),
        ),
        body: Buffer.concat(chunks).toString("utf8"),
      }));
    });
    request.on("error", reject);
    request.end(body);
  });
}

async function listen(config: GatewayConfig, runtime: GatewayRuntime): Promise<{
  baseUrl: string;
  close(): Promise<void>;
}> {
  const server = createGatewayServer(config, {
    runtime,
    closeRuntimeOnServerClose: false,
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP address");
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => closeServer(server),
  };
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
