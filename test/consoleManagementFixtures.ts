import { vi } from 'vitest';
import { fixture, setup } from './consoleFixtures.js';
import { totp } from '../src/consoleCrypto.js';
import { ConsoleServices } from '../src/consoleServices.js';
import { validateConfig } from '../src/config.js';
const draft = () => ({ name: 'Baseline', no_auth: true, destinations: [{ id: 'primary', base_url: 'https://api.example.org' }], credentials: [], access: { users: [] }, policy: { mode: 'allow' as const, rules: [] } });
export function managedFixture(transform?: (config: ReturnType<typeof validateConfig>) => void) {
  const now = 1800000030000; const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
  const cfg = validateConfig({ auth: { mode: 'bearer', bearer: { token_env: 'SYNTHETIC' } }, services: { baseline: draft() } }, { SYNTHETIC: 'synthetic-bearer' });
  transform?.(cfg);
  const f = fixture({ config: cfg }); const e = setup(f, now - 30000);
  const login = f.store.login('owner@example.org', 'A novel lengthy passphrase 2026', totp(e.seed, now));
  const session = f.store.session(login.token)!; const manager = new ConsoleServices(f.store, cfg);
  return { ...f, cfg, manager, session, clock, close() { clock.mockRestore(); f.close(); } };
}
