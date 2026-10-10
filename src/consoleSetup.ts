import { existsSync, mkdirSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { atomicFile } from './consolePersistence.js';
import { consolePeople } from './consolePeople.js';
import {consoleRestore} from './consoleRestore.js';
import { ConsoleStore } from './consoleStore.js';
import { AuditSink } from './audit.js';
import { loadConfig } from './config.js';
export function prepareConsoleKey(directory: string, keyFile: string, statusMode = false): void {
    if (existsSync(keyFile))
        return;
    if (statusMode || existsSync(join(directory, 'managed')))
        throw new Error('Encryption material missing');
    mkdirSync(dirname(keyFile), { recursive: true, mode: 0o700 });
    const lock = keyFile + '.initializing';
    const fd = openSync(lock, 'wx', 0o600);
    try {
        if (!existsSync(keyFile))
            atomicFile(keyFile, randomBytes(32).toString('hex'));
    }
    finally {
        closeSync(fd);
        unlinkSync(lock);
    }
}
// Deliberate host-local command, never a web route or normal startup log.
if (import.meta.url === `file://${process.argv[1]}`) {
    const directory = process.env.CONSOLE_STORAGE_DIR, keyFile = process.env.CONSOLE_KEY_FILE, configPath = process.env.CONFIG_PATH, arg = process.argv[2], operation = process.argv[3];
    const statusMode = arg === '--status';
    const recoveryMode = arg === '--recover-owner';
    const restoreMode = arg === '--restore-proof';
    const continuationMode=arg==='--recover-restore';
    if (!directory || !keyFile || !arg || !process.stdout.isTTY || (!statusMode && !configPath && !existsSync(join(directory, 'managed')))) {
        console.error('Run setup in a protected host terminal with CONSOLE_STORAGE_DIR, CONSOLE_KEY_FILE and an explicit initial CONFIG_PATH; supply a trusted HTTPS origin or --status <operation>.');
        process.exitCode = 1;
    }
    else {
        let store: ConsoleStore | undefined, sink: AuditSink | undefined;
        try {
            if (statusMode && (!operation || !/^[A-Za-z0-9_-]{1,80}$/.test(operation)))
                throw new Error('Invalid operation');
            prepareConsoleKey(directory, keyFile, statusMode || recoveryMode || continuationMode);
            store = new ConsoleStore(directory, keyFile, { ...(!existsSync(join(directory, 'managed')) && configPath ? { config: loadConfig(configPath) } : {}) });
            if(continuationMode){if(!store.state.config)throw Error('Managed recovery configuration required');sink=new AuditSink(store.state.config);sink.bindConsole(store);const r=consoleRestore(store).hostContinuation();process.stdout.write('One-time nominated Owner recovery link (30 minutes; keep private):\n'+store.state.origin+'/console#'+new URLSearchParams({purpose:'restore',target:r.operation,proof:r.continuation}).toString()+'\n');}
            else if(restoreMode){if(!operation||!store.state.config)throw new Error('Trusted origin and deployment configuration required');sink=new AuditSink(store.state.config);sink.bindConsole(store);const proof=consoleRestore(store).issueHostProof(operation);process.stdout.write('One-time clean-host restore proof (30 minutes; keep private):\n'+proof+'\n');}
            else if(recoveryMode){if(!store.state.config)throw new Error('Managed configuration required');sink=new AuditSink(store.state.config);sink.bindConsole(store);if(sink.degraded)throw new Error('Repair audit storage first');if(!operation){store.commit('host','identity.host_owner_list','instance',()=>{});process.stdout.write('Select an existing Owner ID for --recover-owner <id>:\n'+store.state.users.filter(u=>u.role==='Owner'&&u.password!=='').slice(0,1000).map(u=>u.id+'  '+u.email+'  '+(u.enrolled===false?'Restricted':'Enrolled')+'  '+(u.active?'Active':'Disabled')).join('\n')+'\n');}else{const result=consolePeople(store).hostRecovery(operation);process.stdout.write('One-time Owner reenrollment link (30 minutes; keep private):\n'+result.link+'\n');}}
            else if (statusMode) {
                let status = store.journal.status(operation!);
                if (status === 'unknown' && store.state.config) {
                    sink = new AuditSink(store.state.config);
                    status = sink.operationStatus(operation!);
                }
                process.stdout.write(JSON.stringify({ operation, status, initialized: store.state.initialized, audit: store.journal.degraded || sink?.degraded ? 'degraded' : 'ready' }) + '\n');
            }
            else {
                const proof = store.issueProof(arg);
                process.stdout.write('One-time setup proof (expires in 30 minutes):\n' + proof + '\n');
            }
        }
        catch {
            console.error('Host setup/status unavailable. Stop the instance and check protected storage/key/configuration.');
            process.exitCode = 1;
        }
        finally {
            sink?.close();
            store?.close();
        }
    }
}
