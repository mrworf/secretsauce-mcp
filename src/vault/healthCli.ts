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
    const state = await readVaultProvisioningStatus(socketPath);
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
