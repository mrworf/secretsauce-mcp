import {
  chmodSync,
  chownSync,
  existsSync,
} from "node:fs";
import { dirname } from "node:path";
import type {
  VaultProvisioner,
  VaultProvisioningResult,
} from "./provisioning.js";
import { vaultError } from "./errors.js";

export interface VaultPrivilegeDrop {
  (uid: number, gid: number, supplementaryGids: readonly number[]): void;
}

export class VaultSetupAuthority {
  #closed = false;

  constructor(
    private readonly provisioner: Pick<VaultProvisioner, "runOnce">,
    private readonly manifestFile: string,
    private readonly keyDirectories: readonly {
      path: string;
      gid: number;
    }[],
    private readonly runtimeUid: number,
    private readonly runtimeGid: number,
    private readonly sharedGid: number,
  ) {}

  runOnce(): VaultProvisioningResult {
    if (this.#closed) throw vaultError("vault_operation_denied");
    return this.provisioner.runOnce();
  }

  relinquish(drop: VaultPrivilegeDrop = dropProcessPrivileges): void {
    if (this.#closed) throw vaultError("vault_operation_denied");
    this.#closed = true;
    for (const directory of new Map(
      this.keyDirectories.map((value) => [value.path, value]),
    ).values()) {
      if (existsSync(directory.path)) {
        chownForRuntimeTraversal(directory.path, directory.gid);
      }
    }
    if (existsSync(this.manifestFile)) {
      chownSync(
        this.manifestFile,
        process.getuid?.() ?? this.runtimeUid,
        this.sharedGid,
      );
      chmodSync(this.manifestFile, 0o440);
      chownForRuntimeTraversal(dirname(this.manifestFile), this.sharedGid);
    }
    drop(this.runtimeUid, this.runtimeGid, [this.sharedGid]);
  }
}

export function dropProcessPrivileges(
  uid: number,
  gid: number,
  supplementaryGids: readonly number[],
): void {
  if (
    process.getuid === undefined
    || process.getgid === undefined
    || process.setuid === undefined
    || process.setgid === undefined
    || process.setgroups === undefined
    || process.getgroups === undefined
    || process.getuid() !== 0
  ) throw vaultError("vault_operation_denied");
  try {
    process.setgroups([...supplementaryGids]);
    process.setgid(gid);
    process.setuid(uid);
  } catch {
    throw vaultError("vault_operation_denied");
  }
  if (process.getuid() !== uid || process.getgid() !== gid) {
    throw vaultError("vault_operation_denied");
  }
  const actualGroups = process.getgroups();
  if (supplementaryGids.some((value) => !actualGroups.includes(value))) {
    throw vaultError("vault_operation_denied");
  }
  try {
    process.setuid(0);
    throw vaultError("vault_operation_denied");
  } catch (error) {
    if (
      error instanceof Error
      && error.name === "VaultError"
    ) throw error;
  }
}

function chownForRuntimeTraversal(directory: string, gid: number): void {
  chownSync(directory, process.getuid?.() ?? 0, gid);
  chmodSync(directory, 0o750);
}
