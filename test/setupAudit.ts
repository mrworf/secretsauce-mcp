import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll } from 'vitest';
// Explicit isolation for the production default persistent audit path; no fail-open test mode.
const directory = mkdtempSync(join(tmpdir(), 'gateway-audit-suite-'));
process.env.AUDIT_STORAGE_DIR = directory;
afterAll(() => rmSync(directory, { recursive: true, force: true }));
