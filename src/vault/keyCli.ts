import { createVaultKeyFile, readVaultKeyFile } from "./keyFile.js";

export interface VaultKeyCliIo {
  stdout: (value: string) => void;
  stderr: (value: string) => void;
}

export function runVaultKeyCli(args: readonly string[], io: VaultKeyCliIo): number {
  try {
    if (args.length !== 3 || args[1] !== (args[0] === "generate" ? "--output" : "--file")) {
      io.stderr('{"error":{"code":"invalid_arguments"}}\n');
      return 2;
    }
    if (args[0] === "generate") {
      createVaultKeyFile(args[2]!);
      io.stdout('{"status":"created"}\n');
      return 0;
    }
    if (args[0] === "status") {
      const key = readVaultKeyFile(args[2]!);
      key.fill(0);
      io.stdout('{"status":"valid"}\n');
      return 0;
    }
    io.stderr('{"error":{"code":"invalid_arguments"}}\n');
    return 2;
  } catch {
    io.stderr('{"error":{"code":"key_operation_failed"}}\n');
    return 1;
  }
}

if (process.argv[1]?.endsWith("/vault/keyCli.js")) {
  process.exitCode = runVaultKeyCli(process.argv.slice(2), {
    stdout: (value) => process.stdout.write(value),
    stderr: (value) => process.stderr.write(value),
  });
}
