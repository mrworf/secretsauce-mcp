import { parentPort, workerData } from 'node:worker_threads';
import { resolveDestinationTarget } from './urlValidation.js';
import { evaluatePolicy } from './policy.js';
import type { ServiceConfig } from './types.js';
try {
  const { service, input } = workerData as { service: ServiceConfig; input: { destination?: string; method: string; path?: string; url?: string } };
  for (const d of service.destinations) for (const h of d.hosts) if (h.type === 'regex') h.regex = new RegExp(h.value);
  const target = resolveDestinationTarget(service, input.destination, input);
  const decision = evaluatePolicy(service, target, input.method);
  const rule = service.policy.rules.find(r => r.id === decision.matchedRule);
  // Query and fragment are never rendered: they may contain caller-supplied secrets.
  parentPort!.postMessage({ ...decision, canonicalTarget: target.url.origin + target.methodPath,
    destination: target.destination.id, protection: { tls: target.tls.verify, secretlint: rule?.secretlint ?? 'Inherited from Settings',
      sensitiveNames: 'Inherited from Settings', binaryResponse: rule?.binaryResponse ?? { scan: true, maxBytes: 102400 } } });
} catch { parentPort!.postMessage({ error: 'destination: Check selected destination and canonical path/URL. Userinfo, forbidden routing encodings and unsupported destinations are rejected.' }); }
