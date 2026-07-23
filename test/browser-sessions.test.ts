import { createHmac } from "node:crypto";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  BrowserSessionAuthenticator,
  BrowserSessionRepository,
} from "../src/identity/browserSessions.js";
import {
  LocalAuthenticationRepository,
  LocalAuthenticationService,
} from "../src/identity/localAuthentication.js";
import { hashPassword } from "../src/identity/password.js";
import {
  IdentityKeyRing,
  beginTotpEnrollment,
  parseTotpEnrollmentUri,
  totpCode,
} from "../src/identity/totp.js";
import { IdentityRepository, type IdentityAuditContext } from "../src/identity/repository.js";
import { createControlApplication, startControlServer } from "../src/control/server.js";
import { createLogger } from "../src/logger.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import type { GatewayConfig, IdentityConfig } from "../src/types.js";
import { registryConfig } from "./helpers.js";

const START = 1_785_000_000_000;
const REQUEST_ID = "req_12345678-1234-4234-8234-123456789abc";
const workers = new Set<PersistenceWorker>();
const closeables = new Set<{ close(): void | Promise<void> }>();

afterEach(async () => {
  await Promise.allSettled([...closeables].map((value) => value.close()));
  closeables.clear();
  await Promise.allSettled([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("durable browser sessions", () => {
  it("starts and restarts the production control runtime with stable identity key files", async () => {
    const directory = mkdtempSync(join(tmpdir(), "secretsauce-browser-runtime-"));
    const databaseFile = join(directory, "control.sqlite");
    const rootKeyFile = restrictedKey(directory, "identity-root.key", 61, 0o400);
    const sessionKeyFile = restrictedKey(directory, "session-hmac.key", 62, 0o400);
    const idempotencyKeyFile = restrictedKey(directory, "idempotency.key", 63, 0o600);
    const identity = identityConfig();
    identity.rootKeyFiles = { root: rootKeyFile };
    identity.sessionHmacKeyFile = sessionKeyFile;
    const config = controlConfig(databaseFile, identity);
    config.control = {
      ...config.control!,
      listen: "127.0.0.1:0",
      port: 0,
      idempotencyHmacKeyFile: idempotencyKeyFile,
    };

    const first = await startControlServer(config);
    closeables.add(first);
    const documented = await first.server.inject({
      method: "GET",
      url: "/api/v2/openapi.json",
      headers: { host: "control.example.org" },
    });
    expect(documented.statusCode).toBe(200);
    expect(documented.json().paths).toHaveProperty("/api/v2/auth/login");
    expect(documented.json().paths).toHaveProperty("/api/v2/auth/step-up");
    const health = await first.server.inject({
      method: "GET",
      url: "/api/v2/health",
      headers: { host: "control.example.org" },
    });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({
      data: { status: "ready", checks: { identity: "ready" } },
    });
    await first.close();
    await first.close();
    closeables.delete(first);

    const restarted = await startControlServer(config);
    closeables.add(restarted);
    expect(await restarted.persistence.execute({
      run: (database) => database.schemaVersion,
    })).toBe(6);
  });

  it("serves no-store login/session/logout with strict cookies and CSRF rotation", async () => {
    const fixture = await setup("http");
    const lines: string[] = [];
    const application = createControlApplication(controlConfig(fixture.databaseFile, fixture.config), {
      persistence: fixture.worker,
      logger: createLogger({ level: "debug" }, (line) => lines.push(line)),
      localIdentity: {
        authentication: fixture.authentication,
        browserSessions: fixture.authenticator,
      },
    });
    closeables.add(application);
    const code = totpCode(fixture.seed, fixture.now.value);
    const login = await application.inject({
      method: "POST",
      url: "/api/v2/auth/login",
      headers: { host: "control.example.org", "content-type": "application/json" },
      payload: {
        email: fixture.email,
        password: fixture.password,
        totp: code,
      },
    });
    expect(login.statusCode).toBe(200);
    expect(login.headers["cache-control"]).toBe("no-store");
    const setCookie = String(login.headers["set-cookie"]);
    expect(setCookie).toContain("__Host-secretsauce_session=");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Strict");
    const cookie = setCookie.split(";")[0] ?? "";
    const loginBody = login.json();
    const initialCsrf = loginBody.data.csrf_token as string;
    expect(initialCsrf).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const openApi = await application.inject({
      method: "GET",
      url: "/api/v2/openapi.json",
      headers: { host: "control.example.org" },
    });
    expect(openApi.json().paths).toMatchObject({
      "/api/v2/auth/login": { post: { operationId: "identity.login" } },
      "/api/v2/auth/session": { get: { operationId: "identity.current_session" } },
      "/api/v2/auth/logout": { post: { operationId: "identity.logout" } },
    });

    const current = await application.inject({
      method: "GET",
      url: "/api/v2/auth/session",
      headers: { host: "control.example.org", cookie },
    });
    expect(current.statusCode).toBe(200);
    const rotatedCsrf = current.json().data.csrf_token as string;
    expect(rotatedCsrf).not.toBe(initialCsrf);

    const altered = await application.inject({
      method: "GET",
      url: "/api/v2/auth/session",
      headers: { host: "control.example.org", cookie: `${cookie}x` },
    });
    expect(altered.statusCode).toBe(401);

    const staleCsrf = await application.inject({
      method: "POST",
      url: "/api/v2/auth/logout",
      headers: {
        host: "control.example.org",
        origin: "https://control.example.org",
        cookie,
        "x-csrf-token": initialCsrf,
      },
    });
    expect(staleCsrf.statusCode).toBe(403);

    const logout = await application.inject({
      method: "POST",
      url: "/api/v2/auth/logout",
      headers: {
        host: "control.example.org",
        origin: "https://control.example.org",
        cookie,
        "x-csrf-token": rotatedCsrf,
      },
    });
    expect(logout.statusCode).toBe(200);
    expect(String(logout.headers["set-cookie"])).toContain("__Host-secretsauce_session=;");

    const revoked = await application.inject({
      method: "GET",
      url: "/api/v2/auth/session",
      headers: { host: "control.example.org", cookie },
    });
    expect(revoked.statusCode).toBe(401);

    const observable = `${lines.join("\n")}\n${await auditText(fixture.worker)}`;
    for (const prohibited of [fixture.password, code, cookie, initialCsrf, rotatedCsrf]) {
      expect(observable).not.toContain(prohibited);
    }
    fixture.seed.fill(0);
  });

  it("applies reductions to existing sessions, never extends them, and invalidates every security epoch", async () => {
    const reduced = await setup("reduced");
    const reducedLogin = await login(reduced);
    const reducedHash = sessionHash(reduced.sessionKey, reducedLogin.sessionToken);
    reduced.config.sessions.adminInactivityMs = 5 * 60_000;
    reduced.now.value += 5 * 60_000;
    expect(await reduced.sessions.authenticate(reducedHash, reduced.config.sessions)).toBeUndefined();
    reduced.seed.fill(0);

    const absolute = await setup("absolute");
    const absoluteLogin = await login(absolute);
    const absoluteHash = sessionHash(absolute.sessionKey, absoluteLogin.sessionToken);
    absolute.config.sessions.adminAbsoluteMs = 60 * 60_000;
    absolute.now.value += 60 * 60_000;
    expect(await absolute.sessions.authenticate(absoluteHash, absolute.config.sessions)).toBeUndefined();
    absolute.seed.fill(0);

    const increased = await setup("increased");
    const increasedLogin = await login(increased);
    const increasedHash = sessionHash(increased.sessionKey, increasedLogin.sessionToken);
    increased.config.sessions.adminInactivityMs = 120 * 60_000;
    increased.now.value += 15 * 60_000;
    expect(await increased.sessions.authenticate(increasedHash, increased.config.sessions)).toBeUndefined();
    increased.seed.fill(0);

    const userEpoch = await setup("user-epoch");
    const epochLogin = await login(userEpoch);
    const epochHash = sessionHash(userEpoch.sessionKey, epochLogin.sessionToken);
    const identities = new IdentityRepository(userEpoch.worker, { now: () => userEpoch.now.value });
    const current = await identities.identity(userEpoch.userId);
    if (current === undefined) throw new Error("missing identity");
    await identities.updateProfile(userEpoch.userId, current.version, {
      email: userEpoch.email,
      givenName: "Changed",
      familyName: "User",
    }, audit());
    expect(await userEpoch.sessions.authenticate(epochHash, userEpoch.config.sessions)).toBeUndefined();
    userEpoch.seed.fill(0);

    const globalEpoch = await setup("global-epoch");
    const globalLogin = await login(globalEpoch);
    const globalHash = sessionHash(globalEpoch.sessionKey, globalLogin.sessionToken);
    await globalEpoch.worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(`
          UPDATE identity_security_state
          SET global_security_epoch = global_security_epoch + 1,
              version = version + 1, updated_at = ?
          WHERE singleton = 1
        `, [globalEpoch.now.value]);
      }),
    });
    expect(await globalEpoch.sessions.authenticate(globalHash, globalEpoch.config.sessions)).toBeUndefined();
    globalEpoch.seed.fill(0);
  });

  it("refreshes activity below the idle boundary and rejects inactive or incomplete identities", async () => {
    const fixture = await setup("activity");
    const result = await login(fixture);
    const hash = sessionHash(fixture.sessionKey, result.sessionToken);
    fixture.now.value += 14 * 60_000;
    expect(await fixture.sessions.authenticate(hash, fixture.config.sessions)).toMatchObject({
      userId: fixture.userId,
    });
    fixture.now.value += 14 * 60_000;
    expect(await fixture.sessions.authenticate(hash, fixture.config.sessions)).toMatchObject({
      userId: fixture.userId,
    });

    const identities = new IdentityRepository(fixture.worker, { now: () => fixture.now.value });
    const user = await identities.identity(fixture.userId);
    if (user === undefined) throw new Error("missing identity");
    await identities.changeStatus(fixture.userId, user.version, "suspended", audit());
    expect(await fixture.sessions.authenticate(hash, fixture.config.sessions)).toBeUndefined();
    fixture.seed.fill(0);

    const incomplete = await setup("incomplete");
    const incompleteLogin = await login(incomplete);
    const incompleteHash = sessionHash(incomplete.sessionKey, incompleteLogin.sessionToken);
    await incomplete.worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(`
          UPDATE local_authenticator_states
          SET totp_state = 'disabled', version = version + 1, updated_at = ?
          WHERE user_id = ?
        `, [incomplete.now.value, incomplete.userId]);
      }),
    });
    expect(await incomplete.sessions.authenticate(incompleteHash, incomplete.config.sessions)).toBeUndefined();
    incomplete.seed.fill(0);
  });

  it("keeps issued sessions valid across restart with stable keys and uses the user lifetime class", async () => {
    const fixture = await setup("restart-session", "user");
    const result = await login(fixture);
    expect(result).toMatchObject({
      role: "user",
      absoluteExpiresAt: START + 24 * 3_600_000,
    });
    const hash = sessionHash(fixture.sessionKey, result.sessionToken);
    await fixture.worker.close();
    workers.delete(fixture.worker);
    const restarted = PersistenceWorker.open({
      databaseFile: fixture.databaseFile,
      productVersion: "0.1.0-test",
      now: () => fixture.now.value,
    });
    workers.add(restarted);
    const sessions = new BrowserSessionRepository(restarted, () => fixture.now.value);
    expect(await sessions.authenticate(hash, fixture.config.sessions)).toMatchObject({
      userId: fixture.userId,
      role: "user",
    });
    fixture.seed.fill(0);
  });
});

async function setup(name: string, role: "admin" | "user" = "admin"): Promise<{
  databaseFile: string;
  worker: PersistenceWorker;
  authentication: LocalAuthenticationService;
  authenticator: BrowserSessionAuthenticator;
  sessions: BrowserSessionRepository;
  config: IdentityConfig;
  now: { value: number };
  userId: string;
  email: string;
  password: string;
  seed: Buffer;
  sessionKey: Buffer;
}> {
  const now = { value: START };
  const databaseFile = join(mkdtempSync(join(tmpdir(), `secretsauce-browser-${name}-`)), "control.sqlite");
  const worker = PersistenceWorker.open({
    databaseFile,
    productVersion: "0.1.0-test",
    now: () => now.value,
  });
  workers.add(worker);
  const email = `${name}@example.org`;
  const identities = new IdentityRepository(worker, { now: () => now.value });
  const user = await identities.createLocalIdentity({
    profile: { email, givenName: "Test", familyName: "User" },
    role,
    status: "active",
  }, audit());
  const password = `Correct-${name}-2026`;
  const encodedHash = await hashPassword(Buffer.from(password, "utf8"));
  const rootKey = Buffer.alloc(32, 51);
  const sessionKey = Buffer.alloc(32, 52);
  const keyRing = new IdentityKeyRing("root", { root: rootKey });
  const enrollment = beginTotpEnrollment({
    authenticatorId: "018f1f2e-7b3c-7a10-8000-000000000020",
    userId: user.id,
    issuer: "SecretSauce",
    label: email,
    keyRing,
  });
  const seed = parseTotpEnrollmentUri(enrollment.uri).seed;
  const repository = new LocalAuthenticationRepository(worker, { now: () => now.value });
  await repository.provisionConfiguredAuthenticator({
    userId: user.id,
    encodedHash,
    envelope: enrollment.envelope,
  }, audit());
  const config = identityConfig();
  const authentication = await LocalAuthenticationService.create({
    repository,
    config,
    keyRing,
    sessionHmacKey: sessionKey,
    now: () => now.value,
  });
  const sessions = new BrowserSessionRepository(worker, () => now.value);
  const authenticator = new BrowserSessionAuthenticator(
    sessions,
    config.sessions,
    sessionKey,
  );
  closeables.add(authentication);
  closeables.add(authenticator);
  closeables.add({ close: () => keyRing.destroy() });
  closeables.add({ close: () => sessionKey.fill(0) });
  rootKey.fill(0);
  return {
    databaseFile,
    worker,
    authentication,
    authenticator,
    sessions,
    config,
    now,
    userId: user.id,
    email,
    password,
    seed,
    sessionKey,
  };
}

async function login(fixture: Awaited<ReturnType<typeof setup>>) {
  return fixture.authentication.login({
    email: fixture.email,
    password: fixture.password,
    totp: totpCode(fixture.seed, fixture.now.value),
    source: "127.0.0.1",
    correlationId: REQUEST_ID,
  });
}

function identityConfig(): IdentityConfig {
  return {
    activeRootKeyId: "root",
    rootKeyFiles: { root: "/unused" },
    sessionHmacKeyFile: "/unused",
    temporaryPasswordTtlMs: 72 * 3_600_000,
    restrictedSessionTtlMs: 15 * 60_000,
    password: { minimumLength: 12 },
    sessions: {
      adminAbsoluteMs: 12 * 3_600_000,
      adminInactivityMs: 15 * 60_000,
      userAbsoluteMs: 24 * 3_600_000,
      userInactivityMs: 60 * 60_000,
    },
    stepUpMode: "five_minutes",
    limits: {
      loginAttempts: 10,
      loginWindowMs: 15 * 60_000,
      passwordAttempts: 10,
      passwordWindowMs: 15 * 60_000,
      totpAttempts: 5,
      totpWindowMs: 5 * 60_000,
      maxPasswordVerifications: 2,
      maxPasswordVerificationsPerSource: 1,
      maxTotpVerifications: 8,
      maxTotpVerificationsPerSource: 2,
    },
  };
}

function controlConfig(databaseFile: string, identity: IdentityConfig): GatewayConfig {
  const base = registryConfig();
  return {
    ...base,
    control: {
      listen: "127.0.0.1:8081",
      host: "127.0.0.1",
      port: 8081,
      publicOrigin: "https://control.example.org",
      publicAuthority: "control.example.org",
      idempotencyHmacKeyFile: "/unused",
    },
    persistence: { databaseFile },
    identity,
  };
}

function sessionHash(key: Buffer, token: string): string {
  return createHmac("sha256", key)
    .update("secretsauce.browser-session.v1")
    .update("\0")
    .update(token)
    .digest("hex");
}

async function auditText(worker: PersistenceWorker): Promise<string> {
  return worker.execute({
    run: (database) => database.read((query) => query.get<{ events: string }>(`
      SELECT group_concat(
        action || ':' || actor_label_snapshot || ':' || target_label_snapshot || ':' || changes_json
      ) AS events
      FROM administrative_audit_events
    `)?.events ?? ""),
  });
}

function audit(): IdentityAuditContext {
  return {
    actor: {
      type: "local_cli",
      label: "test-operator",
      authenticationMethod: "host_terminal",
    },
    correlationId: REQUEST_ID,
    source: { category: "identity" },
  };
}

function restrictedKey(
  directory: string,
  name: string,
  fill: number,
  mode: number,
): string {
  const file = join(directory, name);
  writeFileSync(file, `${Buffer.alloc(32, fill).toString("base64url")}\n`, { mode });
  chmodSync(file, mode);
  return file;
}
