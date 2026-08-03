import type { GatewayConfig } from "../types.js";
import type { SecretSauceApplication } from "../application.js";
import { validateProvisionedKeyFiles } from "../config.js";
import { configuredAuditTextSanitizer } from "../runtime.js";
import { createLogger, type Logger } from "../logger.js";
import { PersistenceWorker } from "../persistence/worker.js";
import { PACKAGE_VERSION } from "../version.js";
import {
  startSetupOnlyApplication,
  type SetupOnlyApplication,
} from "./server.js";
import {
  SetupStatusPollingLoop,
  vaultSetupStatusMonitor,
  type PublicSetupStatus,
  type SetupStatusMonitor,
} from "./status.js";

export type ApplicationLifecyclePhase =
  | "setup"
  | "enrollment"
  | "operational"
  | "not_ready"
  | "closed";

export interface BrowserFirstApplication {
  phase(): ApplicationLifecyclePhase;
  status(): PublicSetupStatus;
  transition(): Promise<ApplicationLifecyclePhase>;
  close(): Promise<void>;
}

type StartOperational =
  typeof import("../application.js").startSecretSauceApplication;

export async function startBrowserFirstApplication(
  config: GatewayConfig,
  environment: NodeJS.ProcessEnv = process.env,
  dependencies: {
    monitor?: SetupStatusMonitor;
    startSetup?: typeof startSetupOnlyApplication;
    startOperational?: StartOperational;
    openPersistence?: typeof PersistenceWorker.open;
    validateOperationalConfig?: typeof validateProvisionedKeyFiles;
    logger?: Logger;
  } = {},
): Promise<BrowserFirstApplication> {
  if (config.control === undefined || config.persistence === undefined) {
    throw new Error("Control and persistence configuration are required.");
  }
  const monitor = dependencies.monitor ?? vaultSetupStatusMonitor(environment);
  const startSetup = dependencies.startSetup ?? startSetupOnlyApplication;
  const startOperational: StartOperational =
    dependencies.startOperational
    ?? (async (...args) =>
      (await import("../application.js"))
        .startSecretSauceApplication(...args));
  const openPersistence = dependencies.openPersistence ?? PersistenceWorker.open;
  const validateOperationalConfig =
    dependencies.validateOperationalConfig ?? validateProvisionedKeyFiles;
  const logger = dependencies.logger ?? createLogger(config.logging);
  let setup: SetupOnlyApplication | undefined = await startSetup(
    config,
    () => monitor.current(),
  );
  logger.info("setup.lifecycle_started");
  let application: SecretSauceApplication | undefined;
  let phase: ApplicationLifecyclePhase = "setup";
  let transitionPromise: Promise<ApplicationLifecyclePhase> | undefined;
  let closed = false;
  const polling = new SetupStatusPollingLoop(monitor, (status) => {
    if (status.state === "available") void transition();
  });

  const transition = (): Promise<ApplicationLifecyclePhase> => {
    if (monitor.current().state !== "available") {
      return Promise.resolve(phase);
    }
    transitionPromise ??= (async () => {
      if (closed) return "closed";
      polling.stop();
      logger.info("setup.vault_handoff_started");
      await setup?.close();
      setup = undefined;
      let persistence: PersistenceWorker | undefined;
      let failureCategory:
        | "key_validation"
        | "persistence_initialization"
        | "operational_startup" = "key_validation";
      try {
        validateOperationalConfig(config);
        failureCategory = "persistence_initialization";
        persistence = openPersistence({
          databaseFile: config.persistence!.databaseFile,
          productVersion: PACKAGE_VERSION,
          sanitizeAuditText: configuredAuditTextSanitizer(config),
        });
        const userCount = await persistence.execute({
          run: (database) =>
            database.read((query) =>
              query.get<{ count: number }>(
                "SELECT count(*) AS count FROM users",
              )?.count ?? 0
            ),
        });
        let operational = userCount > 0;
        monitor.set(operational
          ? {
              state: "available",
              message: "SecretSauce is available.",
              retryPending: false,
            }
          : {
              state: "enrollment",
              message: "SecretSauce is ready for secure enrollment.",
              retryPending: false,
            });
        failureCategory = "operational_startup";
        application = await startOperational(config, environment, {
          persistence,
          operational: () => operational,
          setupStatus: () => monitor.current(),
          startOrdinaryJobs: operational,
          onInitialEnrollmentComplete: () => {
            operational = true;
            phase = "operational";
            monitor.set({
              state: "available",
              message: "SecretSauce is available.",
              retryPending: false,
            });
            logger.info("setup.operational_ready", {
              transition: "enrollment_complete",
            });
          },
        });
        persistence = undefined;
        phase = operational ? "operational" : "enrollment";
        logger.info("setup.vault_handoff_completed", { phase });
        logger.info(
          operational
            ? "setup.operational_ready"
            : "setup.enrollment_available",
          { transition: "startup" },
        );
        return phase;
      } catch {
        logger.error("setup.vault_handoff_failed", {
          failure_category: failureCategory,
        });
        await persistence?.close().catch(() => undefined);
        monitor.set({
          state: "not_ready",
          message:
            "SecretSauce needs operator attention before setup can continue.",
          retryPending: false,
        });
        phase = "not_ready";
        if (!closed) {
          setup = await startSetup(config, () => monitor.current());
        }
        return phase;
      }
    })();
    return transitionPromise;
  };

  polling.start();
  return {
    phase: () => phase,
    status: () => monitor.current(),
    transition,
    close: async () => {
      if (closed) return;
      closed = true;
      phase = "closed";
      polling.stop();
      await Promise.allSettled([
        setup?.close(),
        application?.close(),
        transitionPromise,
      ]);
    },
  };
}
