import { createDataVaultReadiness } from "./readiness.js";

export async function runVaultHealthCli(
  environment: NodeJS.ProcessEnv,
  write: (value: string) => void,
): Promise<number> {
  try {
    const readiness = createDataVaultReadiness(environment);
    if (readiness === undefined) throw new Error("not configured");
    try {
      const status = await readiness.readiness();
      write(`${JSON.stringify({ status })}\n`);
      return status === "ready" ? 0 : 1;
    } finally {
      readiness.close();
    }
  } catch {
    write('{"status":"unavailable"}\n');
    return 1;
  }
}

if (process.argv[1]?.endsWith("/vault/healthCli.js")) {
  process.exitCode = await runVaultHealthCli(process.env, (value) => process.stdout.write(value));
}
