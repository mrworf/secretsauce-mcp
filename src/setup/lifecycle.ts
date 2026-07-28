import type { GatewayConfig } from "../types.js";
import {
  startSecretSauceApplication,
  type SecretSauceApplication,
} from "../application.js";
import { configuredAuditTextSanitizer } from "../runtime.js";
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

export async function startBrowserFirstApplication(
  config: GatewayConfig,
  environment: NodeJS.ProcessEnv = process.env,
  dependencies: {
    monitor?: SetupStatusMonitor;
    startSetup?: typeof startSetupOnlyApplication;
    startOperational?: typeof startSecretSauceApplication;
    openPersistence?: typeof PersistenceWorker.open;
  } = {},
): Promise<BrowserFirstApplication> {
  if (config.control === undefined || config.persistence === undefined) {
    throw new Error("Control and persistence configuration are required.");
  }
  const monitor = dependencies.monitor ?? vaultSetupStatusMonitor(environment);
  const startSetup = dependencies.startSetup ?? startSetupOnlyApplication;
  const startOperational =
    dependencies.startOperational ?? startSecretSauceApplication;
  const openPersistence = dependencies.openPersistence ?? PersistenceWorker.open;
  let setup: SetupOnlyApplication | undefined = await startSetup(
    config,
    () => monitor.current(),
  );
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
      await setup?.close();
      setup = undefined;
      let persistence: PersistenceWorker | undefined;
      try {
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
        const operational = userCount > 0;
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
        application = await startOperational(config, environment, {
          persistence,
          operational: () => operational,
          setupStatus: () => monitor.current(),
          startOrdinaryJobs: operational,
        });
        persistence = undefined;
        phase = operational ? "operational" : "enrollment";
        return phase;
      } catch {
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
