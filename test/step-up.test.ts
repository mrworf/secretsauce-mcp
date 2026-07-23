import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createControlApplication } from "../src/control/server.js";
import { defineControlRoute } from "../src/control/routeRegistry.js";
import { z } from "../src/control/zod.js";
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
  BrowserStepUpAuthorization,
  StepUpRepository,
  StepUpService,
} from "../src/identity/stepUp.js";
import {
  IdentityKeyRing,
  beginTotpEnrollment,
  parseTotpEnrollmentUri,
  totpCode,
} from "../src/identity/totp.js";
import { IdentityRepository, type IdentityAuditContext } from "../src/identity/repository.js";
import { PersistenceError } from "../src/persistence/errors.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import type { GatewayConfig, IdentityConfig } from "../src/types.js";
import { registryConfig } from "./helpers.js";

const START = 1_785_000_000_000;
const TARGET_ID = "018f1f2e-7b3c-7a10-8000-000000000077";
const SECOND_TARGET_ID = "018f1f2e-7b3c-7a10-8000-000000000079";
const REQUEST_ID = "req_12345678-1234-4234-8234-123456789abc";
const IDEMPOTENCY_KEY = "step-up-test-key";
const closeables = new Set<{ close(): void | Promise<void> }>();
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.allSettled([...closeables].map((value) => value.close()));
  closeables.clear();
  await Promise.allSettled([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("transaction-bound browser step-up", () => {
  it("elevates a browser session for exactly five minutes with a fresh TOTP step", async () => {
    const fixture = await setup("five_minutes", "five");
    const login = await httpLogin(fixture);
    const denied = await protectedRequest(fixture, login, {});
    expect(denied.statusCode).toBe(403);
    expect(denied.json().error.code).toBe("step_up_required");

    fixture.now.value += 30_000;
    const code = totpCode(fixture.seed, fixture.now.value);
    const wrongPassword = await rawStepUpRequest(fixture, login, {
      password: "Wrong-Password-2026",
      totp: code,
    });
    expect(wrongPassword.statusCode).toBe(401);
    const wrongCode = `${code[0] === "0" ? "1" : "0"}${code.slice(1)}`;
    expect((await rawStepUpRequest(fixture, login, {
      password: fixture.password,
      totp: wrongCode,
    })).statusCode).toBe(401);
    const elevated = await stepUpRequest(fixture, login, code);
    expect(elevated.statusCode).toBe(200);
    expect(elevated.json().data).toMatchObject({
      mode: "five_minutes",
      expires_at: fixture.now.value + 5 * 60_000,
    });
    expect(elevated.json().data.proof).toBeUndefined();

    const replay = await stepUpRequest(fixture, login, code);
    expect(replay.statusCode).toBe(401);
    expect(await protectedRequest(fixture, login, {})).toMatchObject({ statusCode: 200 });
    fixture.now.value += 5 * 60_000;
    expect((await protectedRequest(fixture, login, {})).statusCode).toBe(403);

    fixture.now.value += 30_000;
    const exactOperation = await stepUpRequest(
      fixture,
      login,
      totpCode(fixture.seed, fixture.now.value),
      operationInput({ value: "route-forced-always" }),
    );
    expect(exactOperation.statusCode).toBe(200);
    expect(exactOperation.json().data).toMatchObject({ mode: "always" });
    expect(exactOperation.json().data.proof).toMatch(/^[A-Za-z0-9_-]{43}$/);
    fixture.seed.fill(0);
  });

  it("binds an always proof to one exact operation and consumes it atomically", async () => {
    const fixture = await setup("always", "always-binding");
    const login = await httpLogin(fixture);
    fixture.now.value += 30_000;
    const operation = operationInput({ value: "changed" });
    const issued = await stepUpRequest(
      fixture,
      login,
      totpCode(fixture.seed, fixture.now.value),
      operation,
    );
    expect(issued.statusCode).toBe(200);
    const proof = issued.json().data.proof as string;
    expect(proof).toMatch(/^[A-Za-z0-9_-]{43}$/);

    for (const changed of [
      { targetId: "018f1f2e-7b3c-7a10-8000-000000000078" },
      { body: { value: "different" } },
      { version: 2 },
      { idempotencyKey: "different-step-key" },
    ]) {
      const response = await protectedRequest(fixture, login, {
        proof,
        ...changed,
      });
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe("step_up_required");
    }
    expect(await mutationCount(fixture.worker)).toBe(0);

    const accepted = await protectedRequest(fixture, login, { proof });
    expect(accepted.statusCode).toBe(200);
    expect(await mutationCount(fixture.worker)).toBe(1);
    const replay = await protectedRequest(fixture, login, { proof });
    expect(replay.statusCode).toBe(403);
    expect(await mutationCount(fixture.worker)).toBe(1);

    fixture.now.value += 30_000;
    const wrongMethod = await issueCustomProof(fixture, login, {
      ...operationInput({ value: "method" }),
      method: "POST",
    });
    expect((await protectedRequest(fixture, login, {
      proof: wrongMethod,
      body: { value: "method" },
    })).statusCode).toBe(403);

    fixture.now.value += 30_000;
    const wrongRoute = await issueCustomProof(fixture, login, {
      ...operationInput({ value: "route" }),
      route_id: "test.other_mutation",
    });
    expect((await protectedRequest(fixture, login, {
      proof: wrongRoute,
      body: { value: "route" },
    })).statusCode).toBe(403);

    fixture.now.value += 30_000;
    const batchBody = { value: "batch", target_ids: [SECOND_TARGET_ID] };
    const batchProof = await issueCustomProof(fixture, login, {
      ...operationInput(batchBody),
      target_ids: [TARGET_ID, SECOND_TARGET_ID],
    });
    expect((await protectedRequest(fixture, login, {
      proof: batchProof,
      body: batchBody,
    })).statusCode).toBe(200);
    expect(await mutationCount(fixture.worker)).toBe(2);

    const audit = await auditEvents(fixture.worker);
    expect(audit).not.toContain(fixture.password);
    expect(audit).not.toContain(proof);
    expect(audit).not.toContain("batch");
    fixture.seed.fill(0);
  });

  it("rejects missing consumption, rolls failed mutations back, and permits retry of an unconsumed proof", async () => {
    const fixture = await setup("always", "always-rollback");
    const login = await httpLogin(fixture);

    fixture.now.value += 30_000;
    fixture.behavior.value = "skip";
    const skipBody = { value: "skip" };
    const skippedProof = await issueProof(fixture, login, skipBody);
    const skipped = await protectedRequest(fixture, login, {
      proof: skippedProof,
      body: skipBody,
    });
    expect(skipped.statusCode).toBe(500);
    expect(await mutationCount(fixture.worker)).toBe(0);
    expect(await unconsumedProofCount(fixture.worker)).toBe(1);

    fixture.now.value += 30_000;
    fixture.behavior.value = "fail_once";
    const rollbackBody = { value: "rollback" };
    const rollbackProof = await issueProof(fixture, login, rollbackBody);
    const failed = await protectedRequest(fixture, login, {
      proof: rollbackProof,
      body: rollbackBody,
    });
    expect(failed.statusCode).toBe(500);
    expect(await mutationCount(fixture.worker)).toBe(0);

    const retried = await protectedRequest(fixture, login, {
      proof: rollbackProof,
      body: rollbackBody,
    });
    expect(retried.statusCode).toBe(200);
    expect(await mutationCount(fixture.worker)).toBe(1);
    fixture.seed.fill(0);
  });

  it("rejects expired, stolen-session, and epoch-invalidated always proofs", async () => {
    const expired = await setup("always", "always-expired");
    const expiredLogin = await httpLogin(expired);
    expired.now.value += 30_000;
    const expiredProof = await issueProof(expired, expiredLogin, { value: "expired" });
    expired.now.value += 5 * 60_000;
    expect((await protectedRequest(expired, expiredLogin, {
      proof: expiredProof,
      body: { value: "expired" },
    })).statusCode).toBe(403);
    expired.seed.fill(0);

    const stolen = await setup("always", "always-stolen");
    const first = await httpLogin(stolen);
    stolen.now.value += 30_000;
    const second = await httpLogin(stolen);
    stolen.now.value += 30_000;
    const stolenProof = await issueProof(stolen, first, { value: "bound" });
    expect((await protectedRequest(stolen, second, {
      proof: stolenProof,
      body: { value: "bound" },
    })).statusCode).toBe(403);
    stolen.seed.fill(0);

    const epoch = await setup("always", "always-epoch");
    const epochLogin = await httpLogin(epoch);
    epoch.now.value += 30_000;
    const epochProof = await issueProof(epoch, epochLogin, { value: "epoch" });
    const identities = new IdentityRepository(epoch.worker, { now: () => epoch.now.value });
    const user = await identities.identity(epoch.userId);
    if (user === undefined) throw new Error("missing identity");
    await identities.updateProfile(epoch.userId, user.version, {
      email: epoch.email,
      givenName: "Epoch",
      familyName: "Changed",
    }, audit());
    expect((await protectedRequest(epoch, epochLogin, {
      proof: epochProof,
      body: { value: "epoch" },
    })).statusCode).toBe(401);
    epoch.seed.fill(0);
  });
});

interface Fixture {
  worker: PersistenceWorker;
  application: ReturnType<typeof createControlApplication>;
  stepUps: StepUpRepository;
  now: { value: number };
  behavior: { value: "normal" | "skip" | "fail_once" };
  userId: string;
  email: string;
  password: string;
  seed: Buffer;
}

async function setup(mode: IdentityConfig["stepUpMode"], name: string): Promise<Fixture> {
  const now = { value: START };
  const databaseFile = join(mkdtempSync(join(tmpdir(), `secretsauce-step-up-${name}-`)), "control.sqlite");
  const worker = PersistenceWorker.open({
    databaseFile,
    productVersion: "0.1.0-test",
    now: () => now.value,
  });
  workers.add(worker);
  const email = `${name}@example.org`;
  const identities = new IdentityRepository(worker, { now: () => now.value });
  const user = await identities.createLocalIdentity({
    profile: { email, givenName: "Step", familyName: "Up" },
    role: "superadmin",
    status: "active",
  }, audit());
  const password = `Correct-${name}-2026`;
  const encodedHash = await hashPassword(Buffer.from(password, "utf8"));
  const rootKey = Buffer.alloc(32, 71);
  const sessionKey = Buffer.alloc(32, 72);
  const keyRing = new IdentityKeyRing("root", { root: rootKey });
  rootKey.fill(0);
  const enrollment = beginTotpEnrollment({
    authenticatorId: "018f1f2e-7b3c-7a10-8000-000000000030",
    userId: user.id,
    issuer: "SecretSauce",
    label: email,
    keyRing,
  });
  const seed = parseTotpEnrollmentUri(enrollment.uri).seed;
  const authenticationRepository = new LocalAuthenticationRepository(worker, { now: () => now.value });
  await authenticationRepository.provisionConfiguredAuthenticator({
    userId: user.id,
    encodedHash,
    envelope: enrollment.envelope,
  }, audit());
  const config = identityConfig(mode);
  const authentication = await LocalAuthenticationService.create({
    repository: authenticationRepository,
    config,
    keyRing,
    sessionHmacKey: sessionKey,
    now: () => now.value,
  });
  const sessions = new BrowserSessionRepository(worker, () => now.value);
  const browser = new BrowserSessionAuthenticator(sessions, config.sessions, sessionKey);
  const stepUps = new StepUpRepository(worker, () => now.value);
  const stepUp = new StepUpService({
    authenticationRepository,
    repository: stepUps,
    config,
    keyRing,
    sessionHmacKey: sessionKey,
    now: () => now.value,
  });
  const authorization = new BrowserStepUpAuthorization(browser, stepUps, mode, sessionKey);
  sessionKey.fill(0);
  const behavior = { value: "normal" as "normal" | "skip" | "fail_once" };
  await worker.execute({
    run: (database) => database.withOperationalTransaction((transaction) => {
      transaction.run(`
        CREATE TABLE step_up_test_mutations (
          id INTEGER PRIMARY KEY,
          target_id TEXT NOT NULL,
          value TEXT NOT NULL
        ) STRICT
      `);
    }),
  });
  const application = createControlApplication(controlConfig(databaseFile, config), {
    persistence: worker,
    localIdentity: {
      authentication,
      browserSessions: browser,
      stepUp,
      authorization,
    },
    registerControlRoutes: (registry) => {
      registry.register(defineControlRoute({
        id: "test.step_mutation",
        method: "PATCH",
        path: "/api/v2/test/targets/{target_id}",
        summary: "Exercise transaction-bound step-up",
        tags: ["Test"],
        authentication: ["browser_session"],
        permission: "manage_global_settings",
        stepUp: mode === "always" ? "always" : "five_minutes",
        schemas: {
          params: z.object({ target_id: z.string().uuid() }).strict(),
          body: z.object({
            value: z.string().min(1).max(64),
            target_ids: z.array(z.string().uuid()).max(10).optional(),
          }).strict(),
          response: z.object({ changed: z.literal(true) }).strict(),
        },
        rateLimit: "management",
        auditAction: "test.step_mutation",
        secretFields: [],
        cache: "no-store",
        concurrency: "if-match",
        idempotency: "required",
        handler: async ({ body, params, authentication: context, stepUpProof }) => {
          if (behavior.value === "skip") {
            return { data: { changed: true as const } };
          }
          if (mode === "always" && stepUpProof === undefined) throw new Error("missing proof handle");
          const mutate = (transaction: Parameters<Parameters<StepUpRepository["withConsumedProof"]>[2]>[0]) => {
            transaction.run(
              "INSERT INTO step_up_test_mutations (target_id, value) VALUES (?, ?)",
              [params.target_id, body.value],
            );
            if (behavior.value === "fail_once") {
              behavior.value = "normal";
              throw new PersistenceError("database_unavailable");
            }
            return true;
          };
          if (mode === "always") {
            await stepUps.withConsumedProof(
              stepUpProof!,
              mutationAudit(user.id, context?.role ?? "superadmin"),
              mutate,
            );
          } else {
            await worker.execute({
              run: (database) => database.withOperationalTransaction(mutate),
            });
          }
          return { data: { changed: true as const } };
        },
      }));
    },
  });
  closeables.add(application);
  closeables.add(authentication);
  closeables.add(browser);
  closeables.add(stepUp);
  closeables.add(authorization);
  closeables.add({ close: () => keyRing.destroy() });
  return {
    worker,
    application,
    stepUps,
    now,
    behavior,
    userId: user.id,
    email,
    password,
    seed,
  };
}

async function httpLogin(fixture: Fixture): Promise<{ cookie: string; csrf: string }> {
  const response = await fixture.application.inject({
    method: "POST",
    url: "/api/v2/auth/login",
    headers: { host: "control.example.org", "content-type": "application/json" },
    payload: {
      email: fixture.email,
      password: fixture.password,
      totp: totpCode(fixture.seed, fixture.now.value),
    },
  });
  expect(response.statusCode).toBe(200);
  return {
    cookie: String(response.headers["set-cookie"]).split(";")[0] ?? "",
    csrf: response.json().data.csrf_token as string,
  };
}

function stepUpRequest(
  fixture: Fixture,
  login: { cookie: string; csrf: string },
  code: string,
  operation?: ReturnType<typeof operationInput>,
) {
  return fixture.application.inject({
    method: "POST",
    url: "/api/v2/auth/step-up",
    headers: {
      host: "control.example.org",
      origin: "https://control.example.org",
      cookie: login.cookie,
      "x-csrf-token": login.csrf,
      "content-type": "application/json",
    },
    payload: {
      password: fixture.password,
      totp: code,
      ...(operation === undefined ? {} : { operation }),
    },
  });
}

function rawStepUpRequest(
  fixture: Fixture,
  login: { cookie: string; csrf: string },
  payload: Record<string, unknown>,
) {
  return fixture.application.inject({
    method: "POST",
    url: "/api/v2/auth/step-up",
    headers: {
      host: "control.example.org",
      origin: "https://control.example.org",
      cookie: login.cookie,
      "x-csrf-token": login.csrf,
      "content-type": "application/json",
    },
    payload,
  });
}

async function issueProof(
  fixture: Fixture,
  login: { cookie: string; csrf: string },
  body: { value: string },
): Promise<string> {
  const response = await stepUpRequest(
    fixture,
    login,
    totpCode(fixture.seed, fixture.now.value),
    operationInput(body),
  );
  expect(response.statusCode).toBe(200);
  return response.json().data.proof as string;
}

async function issueCustomProof(
  fixture: Fixture,
  login: { cookie: string; csrf: string },
  operation: {
    method: "POST" | "PUT" | "PATCH" | "DELETE";
    route_id: string;
    target_ids: string[];
    expected_version: number;
    idempotency_key: string;
    body: { value: string; target_ids?: string[] };
  },
): Promise<string> {
  const response = await stepUpRequest(
    fixture,
    login,
    totpCode(fixture.seed, fixture.now.value),
    operation,
  );
  expect(response.statusCode).toBe(200);
  return response.json().data.proof as string;
}

function protectedRequest(
  fixture: Fixture,
  login: { cookie: string; csrf: string },
  options: {
    proof?: string;
    targetId?: string;
    body?: { value: string; target_ids?: string[] };
    version?: number;
    idempotencyKey?: string;
  },
) {
  return fixture.application.inject({
    method: "PATCH",
    url: `/api/v2/test/targets/${options.targetId ?? TARGET_ID}`,
    headers: {
      host: "control.example.org",
      origin: "https://control.example.org",
      cookie: login.cookie,
      "x-csrf-token": login.csrf,
      "if-match": `"${options.version ?? 1}"`,
      "idempotency-key": options.idempotencyKey ?? IDEMPOTENCY_KEY,
      ...(options.proof === undefined ? {} : { "x-step-up-proof": options.proof }),
      "content-type": "application/json",
    },
    payload: options.body ?? { value: "changed" },
  });
}

function operationInput(body: { value: string; target_ids?: string[] }) {
  return {
    method: "PATCH" as const,
    route_id: "test.step_mutation",
    target_ids: [TARGET_ID],
    expected_version: 1,
    idempotency_key: IDEMPOTENCY_KEY,
    body,
  };
}

function identityConfig(mode: IdentityConfig["stepUpMode"]): IdentityConfig {
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
    stepUpMode: mode,
    limits: {
      loginAttempts: 20,
      loginWindowMs: 15 * 60_000,
      passwordAttempts: 20,
      passwordWindowMs: 15 * 60_000,
      totpAttempts: 10,
      totpWindowMs: 5 * 60_000,
      maxPasswordVerifications: 2,
      maxPasswordVerificationsPerSource: 1,
      maxTotpVerifications: 8,
      maxTotpVerificationsPerSource: 2,
    },
  };
}

function controlConfig(databaseFile: string, identity: IdentityConfig): GatewayConfig {
  return {
    ...registryConfig(),
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

async function mutationCount(worker: PersistenceWorker): Promise<number> {
  return worker.execute({
    run: (database) => database.read((query) =>
      query.get<{ count: number }>("SELECT count(*) AS count FROM step_up_test_mutations")?.count ?? 0),
  });
}

async function unconsumedProofCount(worker: PersistenceWorker): Promise<number> {
  return worker.execute({
    run: (database) => database.read((query) =>
      query.get<{ count: number }>(`
        SELECT count(*) AS count FROM identity_step_up_proofs WHERE consumed_at IS NULL
      `)?.count ?? 0),
  });
}

async function auditEvents(worker: PersistenceWorker): Promise<string> {
  return worker.execute({
    run: (database) => database.read((query) => query.get<{ events: string }>(`
      SELECT group_concat(
        action || ':' || target_label_snapshot || ':' || changes_json || ':' || source_json
      ) AS events
      FROM administrative_audit_events
    `)?.events ?? ""),
  });
}

function mutationAudit(
  userId: string,
  role: "superadmin" | "admin" | "user" | "service" | "all_services" | "system",
) {
  return {
    actor: {
      type: "browser_session" as const,
      id: userId,
      label: `user:${userId}`,
      role,
      authenticationMethod: "browser_session",
    },
    action: "test.step_mutation",
    result: "allow" as const,
    target: { type: "fixture", id: TARGET_ID, label: `fixture:${TARGET_ID}` },
    changes: [{ field: "fixture", after: "changed" }],
    correlationId: REQUEST_ID,
    source: { category: "control" },
  };
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
