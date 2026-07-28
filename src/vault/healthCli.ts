import { isAbsolute } from "node:path";
import { readVaultProvisioningStatus } from "./client.js";

export async function runVaultHealthCli(
  environment: NodeJS.ProcessEnv,
  write: (value: string) => void,
): Promise<number> {
  try {
    const socketPath = environment.SECRETSAUCE_VAULT_STATUS_SOCKET;
    if (
      socketPath === undefined
      || !isAbsolute(socketPath)
      || socketPath.includes("\0")
    ) throw new Error("not configured");
    const ownerValue = environment.SECRETSAUCE_VAULT_OWNER_UID;
    const ownerUid = ownerValue === undefined
      ? undefined
      : /^(0|[1-9][0-9]{0,9})$/.test(ownerValue)
        ? Number(ownerValue)
        : Number.NaN;
    if (
      ownerUid !== undefined
      && (
        !Number.isSafeInteger(ownerUid)
        || ownerUid < 0
        || ownerUid > 0x7fffffff
      )
    ) {
      throw new Error("invalid owner");
    }
    const state = await readVaultProvisioningStatus(socketPath, ownerUid);
    const status = state === "ready" ? "ready" : "unavailable";
    write(`${JSON.stringify({ status })}\n`);
    return status === "ready" ? 0 : 1;
  } catch {
    write('{"status":"unavailable"}\n');
    return 1;
  }
}

if (process.argv[1]?.endsWith("/vault/healthCli.js")) {
  process.exitCode = await runVaultHealthCli(process.env, (value) => process.stdout.write(value));
}
