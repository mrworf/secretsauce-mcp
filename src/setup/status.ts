import {
  readVaultProvisioningStatusDetails,
  type VaultProvisioningStatusDetails,
} from "../vault/client.js";
import { vaultError } from "../vault/errors.js";

export type PublicSetupState =
  | "preparing"
  | "enrollment"
  | "available"
  | "not_ready";

export interface PublicSetupStatus {
  state: PublicSetupState;
  message: string;
  retryPending: boolean;
}

export const PREPARING_STATUS: PublicSetupStatus = Object.freeze({
  state: "preparing",
  message: "SecretSauce is preparing this installation.",
  retryPending: false,
});

export function projectVaultSetupStatus(
  status: VaultProvisioningStatusDetails | undefined,
): PublicSetupStatus {
  if (status?.state === "ready") {
    return {
      state: "available",
      message: "SecretSauce setup prerequisites are available.",
      retryPending: false,
    };
  }
  if (status?.state === "preparing") {
    return {
      state: "preparing",
      message: "SecretSauce is preparing this installation.",
      retryPending: status.retryPending,
    };
  }
  return {
    state: "not_ready",
    message: "SecretSauce needs operator attention before setup can continue.",
    retryPending: false,
  };
}

export class SetupStatusMonitor {
  #status: PublicSetupStatus = PREPARING_STATUS;
  #inFlight: Promise<PublicSetupStatus> | undefined;

  constructor(
    private readonly read: () =>
      Promise<VaultProvisioningStatusDetails> = () => {
        throw vaultError("vault_config_invalid");
      },
  ) {}

  current(): PublicSetupStatus {
    return this.#status;
  }

  refresh(): Promise<PublicSetupStatus> {
    this.#inFlight ??= this.read()
      .then(projectVaultSetupStatus)
      .catch(() => projectVaultSetupStatus(undefined))
      .then((status) => {
        this.#status = Object.freeze({ ...status });
        return this.#status;
      })
      .finally(() => {
        this.#inFlight = undefined;
      });
    return this.#inFlight;
  }

  set(status: PublicSetupStatus): void {
    this.#status = Object.freeze(validatePublicStatus(status));
  }
}

const SETUP_POLL_DELAYS_MS = [250, 500, 1_000, 2_000, 5_000] as const;

export class SetupStatusPollingLoop {
  #stopped = true;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #attempt = 0;

  constructor(
    private readonly monitor: SetupStatusMonitor,
    private readonly publish: (status: PublicSetupStatus) => void,
    private readonly schedule: (
      callback: () => void,
      delayMs: number,
    ) => ReturnType<typeof setTimeout> = setTimeout,
    private readonly cancel: (
      timer: ReturnType<typeof setTimeout>,
    ) => void = clearTimeout,
  ) {}

  start(): void {
    if (!this.#stopped) throw vaultError("vault_operation_denied");
    this.#stopped = false;
    void this.#run();
  }

  stop(): void {
    this.#stopped = true;
    if (this.#timer !== undefined) this.cancel(this.#timer);
    this.#timer = undefined;
  }

  async #run(): Promise<void> {
    if (this.#stopped) return;
    const status = await this.monitor.refresh();
    if (this.#stopped) return;
    this.publish(status);
    const delay = SETUP_POLL_DELAYS_MS[
      Math.min(this.#attempt, SETUP_POLL_DELAYS_MS.length - 1)
    ]!;
    this.#attempt += 1;
    this.#timer = this.schedule(() => {
      this.#timer = undefined;
      void this.#run();
    }, delay);
  }
}

export function vaultSetupStatusMonitor(environment: NodeJS.ProcessEnv):
SetupStatusMonitor {
  const socketPath = environment.SECRETSAUCE_VAULT_STATUS_SOCKET;
  if (socketPath === undefined) throw vaultError("vault_config_invalid");
  const ownerUid = parseOwnerUid(environment.SECRETSAUCE_VAULT_OWNER_UID);
  const timeoutMs = parseTimeout(
    environment.SECRETSAUCE_SETUP_STATUS_TIMEOUT_MS,
  );
  return new SetupStatusMonitor(() => readVaultProvisioningStatusDetails(
    socketPath,
    {
      ...(ownerUid === undefined ? {} : { ownerUid }),
      timeoutMs,
    },
  ));
}

function validatePublicStatus(status: PublicSetupStatus): PublicSetupStatus {
  if (
    !["preparing", "enrollment", "available", "not_ready"]
      .includes(status.state)
    || typeof status.message !== "string"
    || status.message.length < 1
    || status.message.length > 160
    || typeof status.retryPending !== "boolean"
  ) throw vaultError("vault_config_invalid");
  return { ...status };
}

function parseOwnerUid(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!/^(0|[1-9][0-9]{0,9})$/.test(value)) {
    throw vaultError("vault_config_invalid");
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > 0x7fffffff) {
    throw vaultError("vault_config_invalid");
  }
  return parsed;
}

function parseTimeout(value: string | undefined): number {
  if (value === undefined) return 2_000;
  if (!/^[1-9][0-9]{2,3}$/.test(value)) {
    throw vaultError("vault_config_invalid");
  }
  const parsed = Number(value);
  if (parsed < 100 || parsed > 5_000) {
    throw vaultError("vault_config_invalid");
  }
  return parsed;
}
