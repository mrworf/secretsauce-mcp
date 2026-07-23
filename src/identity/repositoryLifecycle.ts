import type { PersistenceTransaction } from "../persistence/transaction.js";
import { PersistenceError } from "../persistence/errors.js";
import type { IdentityRole, IdentityStatus } from "./contracts.js";
import { requireLastActiveSuperadmin } from "./lifecycle.js";
import type { UserRow } from "./repository.js";

export function removeActiveSuperadminError(
  transaction: PersistenceTransaction,
  current: Pick<UserRow, "role" | "status">,
  nextRole: IdentityRole,
  nextStatus: IdentityStatus,
): void {
  const count = transaction.get<{ count: number }>(`
    SELECT count(*) AS count
    FROM users
    WHERE role = 'superadmin' AND status = 'active'
  `)?.count;
  if (count === undefined) throw new PersistenceError("database_unavailable");
  try {
    requireLastActiveSuperadmin(
      count,
      current.role,
      current.status,
      nextRole,
      nextStatus,
    );
  } catch {
    throw new PersistenceError("last_active_superadmin");
  }
}
