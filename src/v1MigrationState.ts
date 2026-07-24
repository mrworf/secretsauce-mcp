import type { PersistenceOwner } from "./persistence/worker.js";

export type V1MigrationPreflightCode =
  | "bootstrap_required"
  | "target_not_empty"
  | "runtime_active"
  | "already_completed"
  | "unavailable";

export class V1MigrationStateError extends Error {
  constructor(readonly code: V1MigrationPreflightCode) {
    super(code);
    this.name = "V1MigrationStateError";
  }
}

export interface V1MigrationPreflight {
  guardianSuperadminId: string;
  migrationStateVersion: number;
  activationVersion: number;
  activationGeneration: number;
  globalReferenceEpoch: number;
}

interface PreflightRow {
  migration_state: "pending" | "completed";
  migration_version: number;
  runtime_state: "inactive" | "active";
  activation_version: number;
  activation_generation: number;
  global_reference_epoch: number;
  service_count: number;
  active_runtime_count: number;
  guardian_superadmin_id: string | null;
}

export class V1MigrationStateRepository {
  constructor(private readonly owner: PersistenceOwner) {}

  async preflight(): Promise<V1MigrationPreflight> {
    try {
      const row = await this.owner.execute({
        run: (database) => database.read((query) => query.get<PreflightRow>(`
          SELECT
            migration.state AS migration_state,
            migration.version AS migration_version,
            activation.state AS runtime_state,
            activation.version AS activation_version,
            activation.activation_generation AS activation_generation,
            activation.global_reference_epoch AS global_reference_epoch,
            (SELECT count(*) FROM services) AS service_count,
            (SELECT count(*) FROM runtime_active_services)
              AS active_runtime_count,
            (
              SELECT id FROM users
              WHERE role = 'superadmin' AND status = 'active'
              ORDER BY id LIMIT 1
            ) AS guardian_superadmin_id
          FROM v1_migration_state AS migration
          JOIN runtime_activation AS activation
            ON activation.singleton = migration.singleton
          WHERE migration.singleton = 1
        `)),
      });
      if (row === undefined) throw new V1MigrationStateError("unavailable");
      if (row.migration_state === "completed") {
        throw new V1MigrationStateError("already_completed");
      }
      if (row.guardian_superadmin_id === null) {
        throw new V1MigrationStateError("bootstrap_required");
      }
      if (row.service_count !== 0 || row.active_runtime_count !== 0) {
        throw new V1MigrationStateError("target_not_empty");
      }
      if (row.runtime_state !== "inactive") {
        throw new V1MigrationStateError("runtime_active");
      }
      return {
        guardianSuperadminId: row.guardian_superadmin_id,
        migrationStateVersion: row.migration_version,
        activationVersion: row.activation_version,
        activationGeneration: row.activation_generation,
        globalReferenceEpoch: row.global_reference_epoch,
      };
    } catch (error) {
      if (error instanceof V1MigrationStateError) throw error;
      throw new V1MigrationStateError("unavailable");
    }
  }
}
