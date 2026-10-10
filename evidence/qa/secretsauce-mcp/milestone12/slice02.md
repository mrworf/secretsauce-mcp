# Recovery slice evidence

17 focused tests passed (people/recovery/auth), build passed. Recovery tests cover Owner channel verification/restriction/session invalidation and stale issuer, password reset retaining MFA and immediate assistance restriction, self-assistance denial, password-plus-code public restricted recovery and serialized code races, harmless host preview and parallel completion, expiry/wrong purpose/security generation/reissue, malformed and stale recent proof, target throttling, audit outage, and committed-state invalidation despite uncertain completion audit.

Protected host CLI requires existing key/storage and interactive terminal with exclusive writer lock; gateway audit is attached and checked before host mutation. Manual fallback does not disclose public reset proof. Public reset response never waits for variable delivery, and audit readiness is checked uniformly for known and unknown contacts. SMTP bounded delivery follows in slice 03.
