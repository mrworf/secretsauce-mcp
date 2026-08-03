import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { validateConfig } from "../src/config.js";
import { startBrowserFirstApplication } from "../src/setup/lifecycle.js";
import { SetupStatusMonitor } from "../src/setup/status.js";
import { createLogger } from "../src/logger.js";

describe("browser-first application lifecycle", () => {
  it("defers the operational composition import until after entrypoint evaluation", () => {
    const source = readFileSync("src/setup/lifecycle.ts", "utf8");
    expect(source).toContain(
      'import type { SecretSauceApplication } from "../application.js";',
    );
    expect(source).toContain('await import("../application.js")');
    expect(source).not.toMatch(
      /import\s*\{[^}]*startSecretSauceApplication[^}]*\}\s*from\s*"\.\.\/application\.js"/s,
    );
  });

  it.each([
    {
      users: 0,
      expectedPhase: "enrollment",
      expectedOperational: false,
      expectedJobs: false,
    },
    {
      users: 1,
      expectedPhase: "operational",
      expectedOperational: true,
      expectedJobs: true,
    },
  ] as const)(
    "opens durable state only after vault readiness and selects $expectedPhase",
    async ({
      users,
      expectedPhase,
      expectedOperational,
      expectedJobs,
    }) => {
      const monitor = dormantMonitor();
      const setupClose = vi.fn(async () => undefined);
      const applicationClose = vi.fn(async () => undefined);
      const persistenceClose = vi.fn(async () => undefined);
      const calls: string[] = [];
      const logLines: string[] = [];
      const validateOperationalConfig = vi.fn(() => {
        calls.push("validate");
      });
      const openPersistence = vi.fn(() => {
        calls.push("persistence");
        return {
          readiness: {
            database: "ready",
            schema: "ready",
            administrativeAudit: "ready",
          },
          execute: vi.fn(async () => users),
          close: persistenceClose,
        };
      });
      const startOperational = vi.fn(async (
        _config,
        _environment,
        options,
      ) => ({
        gateway: {},
        close: applicationClose,
        options,
      }));
      const config = lifecycleConfig();
      const lifecycle = await startBrowserFirstApplication(
        config,
        {},
        {
          monitor,
          startSetup: vi.fn(async () => ({
            controlServer: {},
            gatewayServer: {},
            close: setupClose,
          })) as never,
          openPersistence: openPersistence as never,
          startOperational: startOperational as never,
          validateOperationalConfig,
          logger: createLogger(
            config.logging,
            (line) => logLines.push(line),
          ),
        },
      );
      try {
        expect(lifecycle.phase()).toBe("setup");
        expect(await lifecycle.transition()).toBe("setup");
        expect(openPersistence).not.toHaveBeenCalled();
        expect(startOperational).not.toHaveBeenCalled();

        monitor.set({
          state: "available",
          message: "SecretSauce setup prerequisites are available.",
          retryPending: false,
        });
        await expect(lifecycle.transition()).resolves.toBe(expectedPhase);
        expect(setupClose).toHaveBeenCalledTimes(1);
        expect(validateOperationalConfig).toHaveBeenCalledTimes(1);
        expect(openPersistence).toHaveBeenCalledTimes(1);
        expect(calls).toEqual(["validate", "persistence"]);
        const options = startOperational.mock.calls[0]![2];
        expect(options.operational()).toBe(expectedOperational);
        expect(options.startOrdinaryJobs).toBe(expectedJobs);
        expect(lifecycle.status().state).toBe(expectedPhase === "operational"
          ? "available"
          : "enrollment");
        const events = logLines.map(logEvent);
        expect(events.map(({ event }) => event)).toEqual([
          "setup.lifecycle_started",
          "setup.vault_handoff_started",
          "setup.vault_handoff_completed",
          expectedPhase === "operational"
            ? "setup.operational_ready"
            : "setup.enrollment_available",
        ]);
        expect(events[2]).toMatchObject({ phase: expectedPhase });
        expect(JSON.stringify(events)).not.toMatch(
          /path|socket|credential|token|secret|password|response|body/i,
        );
      } finally {
        await lifecycle.close();
      }
      expect(applicationClose).toHaveBeenCalledTimes(1);
      expect(persistenceClose).not.toHaveBeenCalled();
    },
  );

  it("returns to a bounded setup-only failure state when handoff fails", async () => {
    const monitor = dormantMonitor();
    monitor.set({
      state: "available",
      message: "SecretSauce setup prerequisites are available.",
      retryPending: false,
    });
    const setupClose = vi.fn(async () => undefined);
    const startSetup = vi.fn(async () => ({
      controlServer: {},
      gatewayServer: {},
      close: setupClose,
    }));
    const persistenceClose = vi.fn(async () => undefined);
    const logLines: string[] = [];
    const config = lifecycleConfig();
    const lifecycle = await startBrowserFirstApplication(
      config,
      {},
      {
        monitor,
        startSetup: startSetup as never,
        openPersistence: (() => ({
          readiness: {
            database: "ready",
            schema: "ready",
            administrativeAudit: "ready",
          },
          execute: async () => 0,
          close: persistenceClose,
        })) as never,
        startOperational: (async () => {
          throw new Error("private startup detail");
        }) as never,
        logger: createLogger(config.logging, (line) => logLines.push(line)),
      },
    );
    try {
      await expect(lifecycle.transition()).resolves.toBe("not_ready");
      expect(lifecycle.status()).toEqual({
        state: "not_ready",
        message:
          "SecretSauce needs operator attention before setup can continue.",
        retryPending: false,
      });
      expect(persistenceClose).toHaveBeenCalledTimes(1);
      expect(startSetup).toHaveBeenCalledTimes(2);
      expect(logLines.map(logEvent).at(-1)).toMatchObject({
        level: "error",
        event: "setup.vault_handoff_failed",
        failure_category: "operational_startup",
      });
      expect(logLines.join("\n")).not.toContain("private startup detail");
    } finally {
      await lifecycle.close();
    }
  });

  it("does not open durable state when provisioned key validation fails", async () => {
    const monitor = dormantMonitor();
    monitor.set({
      state: "available",
      message: "SecretSauce setup prerequisites are available.",
      retryPending: false,
    });
    const startSetup = vi.fn(async () => ({
      controlServer: {},
      gatewayServer: {},
      close: async () => undefined,
    }));
    const openPersistence = vi.fn();
    const startOperational = vi.fn();
    const logLines: string[] = [];
    const config = lifecycleConfig();
    const lifecycle = await startBrowserFirstApplication(
      config,
      {},
      {
        monitor,
        startSetup: startSetup as never,
        openPersistence: openPersistence as never,
        startOperational: startOperational as never,
        validateOperationalConfig: () => {
          throw new Error("private validation detail");
        },
        logger: createLogger(config.logging, (line) => logLines.push(line)),
      },
    );
    try {
      await expect(lifecycle.transition()).resolves.toBe("not_ready");
      expect(lifecycle.status()).toEqual({
        state: "not_ready",
        message:
          "SecretSauce needs operator attention before setup can continue.",
        retryPending: false,
      });
      expect(openPersistence).not.toHaveBeenCalled();
      expect(startOperational).not.toHaveBeenCalled();
      expect(startSetup).toHaveBeenCalledTimes(2);
      expect(logLines.map(logEvent).at(-1)).toMatchObject({
        level: "error",
        event: "setup.vault_handoff_failed",
        failure_category: "key_validation",
      });
      expect(logLines.join("\n")).not.toContain("private validation detail");
    } finally {
      await lifecycle.close();
    }
  });
});

function dormantMonitor(): SetupStatusMonitor {
  return new SetupStatusMonitor(
    () => new Promise(() => undefined),
  );
}

function logEvent(line: string): Record<string, unknown> {
  return JSON.parse(line) as Record<string, unknown>;
}

function lifecycleConfig() {
  const directory = mkdtempSync(join(tmpdir(), "setup-lifecycle-"));
  const keyFile = join(directory, "idempotency.key");
  writeFileSync(
    keyFile,
    `${Buffer.alloc(32, 8).toString("base64url")}\n`,
    { mode: 0o600 },
  );
  chmodSync(keyFile, 0o600);
  return validateConfig({
    server: {
      listen: "127.0.0.1:8080",
      mcp_path: "/mcp",
      resource: "https://mcp.example.org",
    },
    control: {
      listen: "127.0.0.1:8081",
      public_origin: "https://control.example.org",
      idempotency_hmac_key_file: keyFile,
    },
    persistence: {
      database_file: join(directory, "control.sqlite"),
    },
    auth: {
      mode: "bearer",
      bearer: { token_env: "TEST_GATEWAY_TOKEN" },
    },
    services: {
      demo: {
        type: "http",
        name: "Demo",
        no_auth: true,
        destinations: [{
          name: "primary",
          base_url: "https://api.example.org",
        }],
      },
    },
  }, { TEST_GATEWAY_TOKEN: "test-token" });
}
