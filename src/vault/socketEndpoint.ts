import { lstatSync, type BigIntStats, type Stats } from "node:fs";
import { dirname, isAbsolute, parse, resolve } from "node:path";
import { vaultError } from "./errors.js";

export interface VaultSocketIdentity {
  device: bigint;
  inode: bigint;
  changeTimeNanoseconds: bigint;
  birthTimeNanoseconds: bigint;
  owner: number;
  mode: number;
}

export function validateVaultSocketEndpoint(
  socketPath: string,
  expectedOwnerUid?: number,
): VaultSocketIdentity {
  if (!isAbsolute(socketPath) || socketPath.includes("\0")) {
    throw vaultError("vault_store_unavailable");
  }
  const canonical = resolve(socketPath);
  validateParents(dirname(canonical), expectedOwnerUid);
  let metadata: BigIntStats;
  try {
    metadata = lstatSync(canonical, { bigint: true });
  } catch {
    throw vaultError("vault_store_unavailable");
  }
  const mode = Number(metadata.mode) & 0o777;
  const uid = Number(metadata.uid);
  if (
    !metadata.isSocket()
    || metadata.isSymbolicLink()
    || (
      expectedOwnerUid === undefined
        ? !isAllowedOwner(uid)
        : uid !== expectedOwnerUid
    )
    || (mode !== 0o600 && mode !== 0o660)
  ) throw vaultError("vault_store_unavailable");
  return {
    device: BigInt(metadata.dev),
    inode: BigInt(metadata.ino),
    changeTimeNanoseconds: metadata.ctimeNs,
    birthTimeNanoseconds: metadata.birthtimeNs,
    owner: uid,
    mode,
  };
}

export function sameVaultSocketEndpoint(
  socketPath: string,
  expected: VaultSocketIdentity,
  expectedOwnerUid?: number,
): boolean {
  try {
    const actual = validateVaultSocketEndpoint(socketPath, expectedOwnerUid);
    return actual.device === expected.device
      && actual.inode === expected.inode
      && actual.changeTimeNanoseconds === expected.changeTimeNanoseconds
      && actual.birthTimeNanoseconds === expected.birthTimeNanoseconds
      && actual.owner === expected.owner
      && actual.mode === expected.mode;
  } catch {
    return false;
  }
}

function validateParents(directory: string, expectedOwnerUid?: number): void {
  const root = parse(directory).root;
  const segments = directory.slice(root.length).split("/").filter(Boolean);
  let current = root;
  for (const segment of segments) {
    current = resolve(current, segment);
    let metadata: Stats;
    try {
      metadata = lstatSync(current);
    } catch {
      throw vaultError("vault_store_unavailable");
    }
    const mode = metadata.mode & 0o7777;
    const stickyRootDirectory =
      metadata.uid === 0
      && (mode & 0o1000) !== 0;
    if (
      !metadata.isDirectory()
      || metadata.isSymbolicLink()
      || !isAllowedOwner(metadata.uid, expectedOwnerUid)
      || ((mode & 0o022) !== 0 && !stickyRootDirectory)
    ) throw vaultError("vault_store_unavailable");
  }
}

function isAllowedOwner(uid: number, expectedOwnerUid?: number): boolean {
  const current = process.getuid?.();
  return current === undefined
    || uid === current
    || uid === 0
    || uid === expectedOwnerUid;
}
