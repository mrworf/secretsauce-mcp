import { isUuidV7 } from "./uuidV7.js";
import { PersistenceError } from "./errors.js";

export const IDEMPOTENCY_RETENTION_MS = 24 * 60 * 60 * 1000;
export const IDEMPOTENCY_PRUNE_LIMIT = 500;

export interface IdempotencyExecutionInput {
  keyHash: string;
  principalId: string;
  routeId: string;
  requestDigest: string;
}

export interface IdempotencyMutationResult<T> {
  value: T;
  resultReference: string;
  responseStatus: number;
}

export type IdempotencyExecutionResult<T> =
  | ({ kind: "executed" } & IdempotencyMutationResult<T>)
  | {
    kind: "replayed";
    resultReference: string;
    responseStatus: number;
  };

export interface StoredIdempotencyRecord {
  key_hash: string;
  principal_id: string;
  route_id: string;
  request_digest: string;
  result_reference: string;
  response_status: number;
  expires_at: number;
}

const digestPattern = /^[a-f0-9]{64}$/;
const routeIdPattern = /^[a-z][a-z0-9_.-]{0,127}$/;

export function validateIdempotencyExecutionInput(
  input: IdempotencyExecutionInput,
): IdempotencyExecutionInput {
  if (
    !digestPattern.test(input.keyHash) ||
    !isUuidV7(input.principalId) ||
    !routeIdPattern.test(input.routeId) ||
    !digestPattern.test(input.requestDigest)
  ) {
    throw new PersistenceError("invalid_idempotency_record");
  }
  return input;
}

export function validateIdempotencyMutationResult<T>(
  input: IdempotencyMutationResult<T>,
): IdempotencyMutationResult<T> {
  if (
    !isUuidV7(input.resultReference) ||
    !Number.isSafeInteger(input.responseStatus) ||
    input.responseStatus < 200 ||
    input.responseStatus > 299
  ) {
    throw new PersistenceError("invalid_idempotency_record");
  }
  return input;
}
