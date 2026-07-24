import type { ControlAuthenticationContext } from "./control/authentication.js";
import { PersistenceError } from "./persistence/errors.js";
import type { PersistenceQuery } from "./persistence/transaction.js";
import { isUuidV7 } from "./persistence/uuidV7.js";

interface ActiveApiKeyRow {
  api_role: "service" | "all_services" | "system";
  service_id: string | null;
  nickname: string;
  last_four: string;
  status: "active" | "expired" | "revoked";
  expires_at: number | null;
}

export function requireServiceApiKeyAuthority(
  query: Pick<PersistenceQuery, "get">,
  actor: ControlAuthenticationContext,
  serviceId: string,
  now: () => number = Date.now,
): boolean {
  if (actor.method !== "api_key") return false;
  if (!isUuidV7(serviceId) || actor.apiKey === undefined) deny();
  const row = currentApiKey(query, actor, now);
  if (
    row.api_role === "all_services" &&
    row.service_id === null &&
    actor.apiKey.serviceId === undefined
  ) return true;
  if (
    row.api_role === "service" &&
    row.service_id === serviceId &&
    actor.apiKey.serviceId === serviceId
  ) return true;
  deny();
}

export function requireAllServicesApiKeyAuthority(
  query: Pick<PersistenceQuery, "get">,
  actor: ControlAuthenticationContext,
  now: () => number = Date.now,
): boolean {
  if (actor.method !== "api_key") return false;
  const row = currentApiKey(query, actor, now);
  if (
    row.api_role === "all_services" &&
    row.service_id === null &&
    actor.apiKey?.serviceId === undefined
  ) return true;
  deny();
}

export function currentApiKey(
  query: Pick<PersistenceQuery, "get">,
  actor: ControlAuthenticationContext,
  now: () => number = Date.now,
): ActiveApiKeyRow {
  if (
    actor.method !== "api_key" ||
    actor.apiKey === undefined ||
    !isUuidV7(actor.principalId) ||
    !["service", "all_services", "system"].includes(actor.role)
  ) deny();
  const timestamp = Math.trunc(now());
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) deny();
  const row = query.get<ActiveApiKeyRow>(`
    SELECT api_role, service_id, nickname, last_four, status, expires_at
    FROM api_keys WHERE id = ?
  `, [actor.principalId]);
  if (
    row === undefined ||
    row.api_role !== actor.role ||
    row.nickname !== actor.apiKey.nickname ||
    row.last_four !== actor.apiKey.lastFour ||
    row.status !== "active" ||
    (row.expires_at !== null && row.expires_at <= timestamp) ||
    row.service_id !== (actor.apiKey.serviceId ?? null)
  ) deny();
  return row;
}

export function administrativeActorSnapshot(
  actor: ControlAuthenticationContext,
): {
  type: "browser_session" | "api_key";
  id: string;
  label: string;
  role: string;
  authenticationMethod: string;
} {
  return {
    type: actor.method === "api_key" ? "api_key" : "browser_session",
    id: actor.principalId,
    label: actor.method === "api_key"
      ? `api-key:${actor.principalId}`
      : `user:${actor.principalId}`,
    role: actor.role,
    authenticationMethod: actor.method,
  };
}

function deny(): never {
  throw new PersistenceError("authentication_failed");
}
