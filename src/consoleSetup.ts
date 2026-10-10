import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { ConsoleStore } from './consoleStore.js';
import { loadConfig } from './config.js';
// Deliberate host-local command; never run from a web route or normal startup.
if (import.meta.url === `file://${process.argv[1]}`) {
    const directory = process.env.CONSOLE_STORAGE_DIR, keyFile = process.env.CONSOLE_KEY_FILE, configPath = process.env.CONFIG_PATH, origin = process.argv[2];
    if (!directory || !keyFile || !configPath || !origin || !process.stdout.isTTY) {
        console.error('Run setup in a protected host terminal with CONSOLE_STORAGE_DIR, CONSOLE_KEY_FILE, CONFIG_PATH and a trusted HTTPS origin.');
        process.exitCode = 1;
    }
    else {
        let store: ConsoleStore | undefined;
        try {
            mkdirSync(join(keyFile, '..'), { recursive: true, mode: 0o700 });
            if (!existsSync(keyFile))
                writeFileSync(keyFile, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 });
            store = new ConsoleStore(directory, keyFile, { config: loadConfig(configPath) });
            const proof = store.issueProof(origin);
            process.stdout.write(`One-time setup proof (expires in 30 minutes):\n${proof}\n`);
        }
        catch {
            console.error('Host setup unavailable. Stop the running instance and check protected storage/key/configuration.');
            process.exitCode = 1;
        }
        finally {
            store?.close();
        }
    }
}
