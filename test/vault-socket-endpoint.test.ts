import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  sameVaultSocketEndpoint,
  validateVaultSocketEndpoint,
} from "../src/vault/socketEndpoint.js";

describe("vault Unix endpoint validation", () => {
  it("accepts an owned protected socket and detects endpoint replacement", async () => {
    const directory = secureDirectory();
    const path = join(directory, "vault.sock");
    const first = await listen(path);
    chmodSync(path, 0o600);
    try {
      const identity = validateVaultSocketEndpoint(path);
      expect(sameVaultSocketEndpoint(path, identity)).toBe(true);
      await close(first);
      const second = await listen(path);
      chmodSync(path, 0o600);
      try {
        expect(sameVaultSocketEndpoint(path, identity)).toBe(false);
      } finally {
        await close(second);
      }
    } finally {
      await close(first);
    }
  });

  it("rejects absent, non-socket, writable, and symlink-parent endpoints", async () => {
    const directory = secureDirectory();
    expect(() => validateVaultSocketEndpoint(join(directory, "absent.sock")))
      .toThrow();

    const file = join(directory, "file");
    writeFileSync(file, "not a socket", { mode: 0o600 });
    expect(() => validateVaultSocketEndpoint(file)).toThrow();

    const writablePath = join(directory, "writable.sock");
    const writable = await listen(writablePath);
    chmodSync(writablePath, 0o666);
    try {
      expect(() => validateVaultSocketEndpoint(writablePath)).toThrow();
    } finally {
      await close(writable);
    }

    const real = join(directory, "real");
    mkdirSync(real, { mode: 0o700 });
    const link = join(directory, "link");
    symlinkSync(real, link);
    const linkedPath = join(link, "linked.sock");
    const linked = await listen(join(real, "linked.sock"));
    chmodSync(join(real, "linked.sock"), 0o600);
    try {
      expect(() => validateVaultSocketEndpoint(linkedPath)).toThrow();
    } finally {
      await close(linked);
    }
  });
});

function secureDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "vault-endpoint-"));
  chmodSync(directory, 0o700);
  return directory;
}

function listen(path: string): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(path, () => resolve(server));
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => {
    if (!server.listening) {
      resolve();
      return;
    }
    server.close(() => resolve());
  });
}
