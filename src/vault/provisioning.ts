import { lstatSync } from "node:fs";
import {
  configureManifest,
  createProvisioningManifest,
  initialProvisioningManifest,
  readProvisioningManifest,
  replaceProvisioningManifest,
  verifyManifestEntry,
  ProvisioningManifestError,
  type VaultProvisioningManifest,
} from "./provisioningManifest.js";
import type {
  RetainedStateInventoryAdapter,
  VaultProvisioningKeyAdapter,
} from "./provisioningAdapters.js";
import type {
  VaultProvisioningAdapterId,
  VaultProvisioningRegistryEntry,
} from "./provisioningRegistry.js";

export type ProvisioningErrorCategory =
  | "state_mismatch"
  | "storage_unavailable"
  | "invalid_configuration"
  | "unsupported_upgrade";

export type VaultProvisioningResult =
  | { state: "ready"; manifest: VaultProvisioningManifest }
  | {
    state: "preparing";
    retryPending: true;
    errorCategory: "storage_unavailable";
  }
  | {
    state: "configuration_error";
    retryPending: false;
    errorCategory: ProvisioningErrorCategory;
  };

export interface VaultProvisionerOptions {
  manifestFile: string;
  registry: readonly VaultProvisioningRegistryEntry[];
  keyAdapters: ReadonlyMap<
    VaultProvisioningAdapterId,
    VaultProvisioningKeyAdapter
  >;
  inventories: readonly RetainedStateInventoryAdapter[];
  adoptExistingKeys: boolean;
  installationId?: string;
}

export class VaultProvisioner {
  constructor(private readonly options: VaultProvisionerOptions) {}

  runOnce(): VaultProvisioningResult {
    try {
      validateClosedInputs(this.options);
      const inventories = this.options.inventories.map((adapter) =>
        adapter.classify()
      );
      if (inventories.includes("indeterminate")) {
        return fatal("storage_unavailable");
      }
      const manifestExists = exists(this.options.manifestFile);
      if (manifestExists) return this.#resumeExisting();
      const keyPresence = this.options.registry.map((entry) =>
        exists(entry.path)
      );
      const presentCount = keyPresence.filter(Boolean).length;
      if (presentCount === 0) {
        if (inventories.includes("present") || this.options.adoptExistingKeys) {
          return fatal("state_mismatch");
        }
        return this.#fresh();
      }
      if (presentCount !== this.options.registry.length) {
        return fatal("state_mismatch");
      }
      if (!this.options.adoptExistingKeys) return fatal("state_mismatch");
      return this.#adopt();
    } catch (error) {
      return fatal(
        error instanceof ProvisioningManifestError
          ? error.category
          : "invalid_configuration",
      );
    }
  }

  #fresh(): VaultProvisioningResult {
    let manifest = initialProvisioningManifest(
      this.options.registry,
      this.options.installationId,
    );
    try {
      createProvisioningManifest(this.options.manifestFile, manifest);
    } catch {
      return retryable();
    }
    return this.#converge(manifest);
  }

  #adopt(): VaultProvisioningResult {
    let manifest = initialProvisioningManifest(
      this.options.registry,
      this.options.installationId,
    );
    for (const entry of this.options.registry) {
      const adapter = this.options.keyAdapters.get(entry.adapter)!;
      manifest = verifyManifestEntry(
        manifest,
        entry.id,
        adapter.validate(entry),
      );
    }
    manifest = configureManifest(manifest);
    createProvisioningManifest(this.options.manifestFile, manifest);
    return { state: "ready", manifest };
  }

  #resumeExisting(): VaultProvisioningResult {
    const manifest = readProvisioningManifest(this.options.manifestFile);
    if (this.options.adoptExistingKeys && manifest.state === "configured") {
      // Deployment-only adoption becomes inert after configuration.
    }
    if (manifest.state === "configured") {
      for (const entry of this.options.registry) {
        const expected = manifest.entries.find((value) => value.id === entry.id)!;
        let actual: string;
        try {
          actual = this.options.keyAdapters.get(entry.adapter)!.validate(entry);
        } catch {
          return fatal("state_mismatch");
        }
        if (expected.fingerprint !== actual) return fatal("state_mismatch");
      }
      return { state: "ready", manifest };
    }
    return this.#converge(manifest);
  }

  #converge(
    startingManifest: VaultProvisioningManifest,
  ): VaultProvisioningResult {
    let manifest = startingManifest;
    for (const entry of this.options.registry) {
      const manifestEntry = manifest.entries.find((value) =>
        value.id === entry.id
      )!;
      const adapter = this.options.keyAdapters.get(entry.adapter)!;
      if (manifestEntry.status === "verified") {
        if (!exists(entry.path)) return fatal("state_mismatch");
        if (adapter.validate(entry) !== manifestEntry.fingerprint) {
          return fatal("state_mismatch");
        }
        continue;
      }
      if (!exists(entry.path)) {
        try {
          adapter.create(entry);
        } catch {
          return {
            state: "preparing",
            retryPending: true,
            errorCategory: "storage_unavailable",
          };
        }
      }
      let fingerprint: string;
      try {
        fingerprint = adapter.validate(entry);
      } catch {
        return fatal("state_mismatch");
      }
      manifest = verifyManifestEntry(manifest, entry.id, fingerprint);
      try {
        replaceProvisioningManifest(this.options.manifestFile, manifest);
      } catch {
        return retryable();
      }
    }
    manifest = configureManifest(manifest);
    try {
      replaceProvisioningManifest(this.options.manifestFile, manifest);
    } catch {
      return retryable();
    }
    return { state: "ready", manifest };
  }
}

function validateClosedInputs(options: VaultProvisionerOptions): void {
  if (
    options.registry.length !== 11
    || options.inventories.length < 1
    || new Set(options.inventories.map((value) => value.id)).size
      !== options.inventories.length
    || options.registry.some((entry) =>
      !options.keyAdapters.has(entry.adapter)
    )
  ) throw new Error("invalid");
}

function exists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function fatal(
  errorCategory: ProvisioningErrorCategory,
): VaultProvisioningResult {
  return {
    state: "configuration_error",
    retryPending: false,
    errorCategory,
  };
}

function retryable(): VaultProvisioningResult {
  return {
    state: "preparing",
    retryPending: true,
    errorCategory: "storage_unavailable",
  };
}
