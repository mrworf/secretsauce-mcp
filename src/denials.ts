import { GatewayError } from "./errors.js";
import { createRequestId } from "./requestId.js";

export interface DenialRecord {
  request_id: string;
  subject: string;
  reason: string;
  matched_rule?: string;
  policy_mode: "allow" | "deny";
  suggestion?: string;
}

export class DenialStore {
  private readonly records = new Map<string, DenialRecord & { expiresAt: number }>();

  constructor(
    private capacity = 1000,
    private ttlMs = 15 * 60_000,
    private readonly now: () => number = () => Date.now(),
  ) {}

  private loweredBelowUsage=false;
  updateLimits(capacity:number,ttlMs:number){if(!Number.isInteger(capacity)||capacity<1||!Number.isInteger(ttlMs)||ttlMs<1)throw new Error('Invalid denial limits');this.capacity=capacity;this.ttlMs=ttlMs;this.loweredBelowUsage=this.records.size>=capacity;}
  stats(){return {records:this.records.size};}
  record(input: Omit<DenialRecord, "request_id">, requestId = createRequestId()): DenialRecord {
    this.sweep(this.now());
    if(this.loweredBelowUsage){if(this.records.size>=this.capacity)throw new GatewayError("capacity_exceeded","Denial record capacity reached; wait for expiry.");this.loweredBelowUsage=false;}
    if (this.records.size >= this.capacity) {
      const oldest = this.records.keys().next().value as string | undefined;
      if (oldest !== undefined) this.records.delete(oldest);
    }
    const record: DenialRecord & { expiresAt: number } = {
      request_id: requestId,
      subject: input.subject,
      reason: input.reason,
      policy_mode: input.policy_mode,
      ...(input.matched_rule === undefined ? {} : { matched_rule: input.matched_rule }),
      ...(input.suggestion === undefined ? {} : { suggestion: input.suggestion }),
      expiresAt: this.now() + this.ttlMs,
    };
    this.records.set(requestId, record);
    return record;
  }

  get(requestId: string): DenialRecord | undefined {
    const record = this.records.get(requestId);
    if (record === undefined) return undefined;
    if (record.expiresAt <= this.now()) {
      this.records.delete(requestId);
      return undefined;
    }
    this.records.delete(requestId);
    this.records.set(requestId, record);
    const { expiresAt: _expiresAt, ...result } = record;
    return result;
  }

  sweep(now = this.now()): void {
    for (const [requestId, record] of this.records) if (record.expiresAt <= now) this.records.delete(requestId);
  }
}

export interface DenialExplanation {
  request_id: string;
  reason: string;
  matched_rule?: string;
  policy_mode: "allow" | "deny";
  suggestion?: string;
}

export function explainDenial(store: DenialStore, auth: { subject: string }, requestId: string): DenialExplanation | undefined {
  const record = store.get(requestId);
  if (!record) return undefined;
  if (record.subject !== auth.subject) return undefined;
  return {
    request_id: record.request_id,
    reason: record.reason,
    ...(record.matched_rule === undefined ? {} : { matched_rule: record.matched_rule }),
    policy_mode: record.policy_mode,
    ...(record.suggestion === undefined ? {} : { suggestion: record.suggestion }),
  };
}
