import type { PersistenceOwner } from "./persistence/worker.js";
import type { TokenBroker } from "./tokens.js";
import { UuidV7Generator } from "./persistence/uuidV7.js";
import { persistRuntimeSnapshot } from "./runtimeSnapshots.js";

const INVALIDATION_BATCH = 200;

interface InvalidationEvent {
  id: string;
  stream: "identity" | "service" | "credential" | "policy";
  table:
    | "identity_invalidation_events"
    | "service_invalidation_events"
    | "assignment_invalidation_events"
    | "credential_invalidation_events"
    | "policy_invalidation_events";
  createdAt: number;
  subject?: string;
  serviceId?: string;
  credentialId?: string;
}

export class RuntimeInvalidationConsumer {
  #polling: Promise<number> | undefined;
  readonly #nextUuid: () => string;

  constructor(
    private readonly owner: PersistenceOwner,
    private readonly broker: TokenBroker,
    now: () => number = Date.now,
    uuid?: () => string,
  ) {
    const generator = new UuidV7Generator({ now });
    this.#nextUuid = uuid ?? (() => generator.next());
  }

  poll(): Promise<number> {
    this.#polling ??= this.pollOnce().finally(() => {
      this.#polling = undefined;
    });
    return this.#polling;
  }

  private async pollOnce(): Promise<number> {
    const events = await this.owner.execute({
      run: (database) => database.read((query) => [
        ...query.all<{
          id: string;
          user_id: string;
          created_at: number;
        }>(`
          SELECT id, user_id, created_at
          FROM identity_invalidation_events
          WHERE dispatched_at IS NULL
          ORDER BY created_at, id LIMIT ?
        `, [INVALIDATION_BATCH]).map((row): InvalidationEvent => ({
          id: row.id,
          stream: "identity",
          table: "identity_invalidation_events",
          createdAt: row.created_at,
          subject: row.user_id,
        })),
        ...query.all<{
          id: string;
          service_id: string;
          created_at: number;
        }>(`
          SELECT id, service_id, created_at
          FROM service_invalidation_events
          WHERE dispatched_at IS NULL
          ORDER BY created_at, id LIMIT ?
        `, [INVALIDATION_BATCH]).map((row): InvalidationEvent => ({
          id: row.id,
          stream: "service",
          table: "service_invalidation_events",
          createdAt: row.created_at,
          serviceId: row.service_id,
        })),
        ...query.all<{
          id: string;
          service_id: string;
          affected_user_id: string | null;
          created_at: number;
        }>(`
          SELECT id, service_id, affected_user_id, created_at
          FROM assignment_invalidation_events
          WHERE dispatched_at IS NULL
          ORDER BY created_at, id LIMIT ?
        `, [INVALIDATION_BATCH]).map((row): InvalidationEvent => ({
          id: row.id,
          stream: "service",
          table: "assignment_invalidation_events",
          createdAt: row.created_at,
          serviceId: row.service_id,
          ...(row.affected_user_id === null
            ? {}
            : { subject: row.affected_user_id }),
        })),
        ...query.all<{
          id: string;
          service_id: string;
          credential_id: string;
          affected_user_id: string | null;
          created_at: number;
        }>(`
          SELECT id, service_id, credential_id, affected_user_id, created_at
          FROM credential_invalidation_events
          WHERE dispatched_at IS NULL
          ORDER BY created_at, id LIMIT ?
        `, [INVALIDATION_BATCH]).map((row): InvalidationEvent => ({
          id: row.id,
          stream: "credential",
          table: "credential_invalidation_events",
          createdAt: row.created_at,
          serviceId: row.service_id,
          credentialId: row.credential_id,
          ...(row.affected_user_id === null
            ? {}
            : { subject: row.affected_user_id }),
        })),
        ...query.all<{
          id: string;
          service_id: string;
          affected_user_id: string | null;
          created_at: number;
        }>(`
          SELECT id, service_id, affected_user_id, created_at
          FROM policy_invalidation_events
          WHERE dispatched_at IS NULL
          ORDER BY created_at, id LIMIT ?
        `, [INVALIDATION_BATCH]).map((row): InvalidationEvent => ({
          id: row.id,
          stream: "policy",
          table: "policy_invalidation_events",
          createdAt: row.created_at,
          serviceId: row.service_id,
          ...(row.affected_user_id === null
            ? {}
            : { subject: row.affected_user_id }),
        })),
      ].sort((left, right) =>
        left.createdAt - right.createdAt || left.id.localeCompare(right.id))
        .slice(0, INVALIDATION_BATCH)),
    });
    for (const event of events) {
      if (event.stream !== "policy") {
        this.broker.invalidate({
          ...(event.subject === undefined ? {} : { subject: event.subject }),
          ...(event.serviceId === undefined ? {} : { serviceId: event.serviceId }),
          ...(event.credentialId === undefined
            ? {}
            : { credentialId: event.credentialId }),
        });
      }
    }
    if (events.length === 0) return 0;
    const dispatchedAt = Math.max(
      Date.now(),
      ...events.map(({ createdAt }) => createdAt),
    );
    await this.owner.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        const active = transaction.get<{ state: string }>(
          "SELECT state FROM runtime_activation WHERE singleton = 1",
        )?.state === "active";
        const refreshServices = new Set(events.flatMap((event) =>
          event.stream === "credential"
          || event.stream === "policy"
          || event.table === "assignment_invalidation_events"
            ? event.serviceId === undefined ? [] : [event.serviceId]
            : []));
        if (active) {
          for (const serviceId of refreshServices) {
            const service = transaction.get<{ lifecycle: string }>(
              "SELECT lifecycle FROM services WHERE id = ?",
              [serviceId],
            );
            if (service?.lifecycle === "published") {
              persistRuntimeSnapshot(
                transaction,
                serviceId,
                this.#nextUuid(),
              );
            }
          }
        }
        for (const event of events) {
          transaction.run(`
            UPDATE ${event.table}
            SET dispatched_at = ?, attempts = attempts + 1
            WHERE id = ? AND dispatched_at IS NULL
          `, [dispatchedAt, event.id]);
          transaction.run(`
            UPDATE runtime_invalidation_checkpoints
            SET last_created_at = ?, last_event_id = ?, updated_at = ?
            WHERE stream_name = ?
              AND (
                last_created_at < ?
                OR (last_created_at = ? AND coalesce(last_event_id, '') < ?)
              )
          `, [
            event.createdAt,
            event.id,
            dispatchedAt,
            event.stream,
            event.createdAt,
            event.createdAt,
            event.id,
          ]);
        }
      }),
    });
    return events.length;
  }
}
