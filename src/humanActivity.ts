import { PersistenceError } from "./persistence/errors.js";
import type { PersistenceTransaction } from "./persistence/transaction.js";
import { isUuidV7 } from "./persistence/uuidV7.js";
import type { PersistenceOwner } from "./persistence/worker.js";

const ACTIVITY_COALESCE_MS = 60_000;

export class HumanActivityRepository {
  constructor(
    private readonly owner: PersistenceOwner,
    private readonly now: () => number = Date.now,
  ) {}

  async record(userId: string): Promise<boolean> {
    if (!isUuidV7(userId)) throw new PersistenceError("database_unavailable");
    const now = safeNow(this.now);
    return this.owner.execute({
      run: (database) => database.withOperationalTransaction((transaction) =>
        recordQualifyingActivity(transaction, userId, now)),
    });
  }
}

export function recordQualifyingActivity(
  transaction: PersistenceTransaction,
  userId: string,
  now: number,
): boolean {
  const result = transaction.run(`
    UPDATE users
    SET last_qualifying_activity_at = ?
    WHERE id = ? AND status = 'active'
      AND (
        last_qualifying_activity_at IS NULL
        OR last_qualifying_activity_at <= ?
      )
  `, [now, userId, now - ACTIVITY_COALESCE_MS]);
  return result.changes === 1;
}

function safeNow(now: () => number): number {
  const value = Math.trunc(now());
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new PersistenceError("database_unavailable");
  }
  return value;
}
