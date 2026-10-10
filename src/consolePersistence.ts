import { closeSync, fsyncSync, openSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
export function atomicFile(path: string, value: string, fault?: (phase?: string) => void): void {
    const temp = path + '.pending';
    let fd: number | undefined;
    try {
        fault?.('before-write');
        fd = openSync(temp, 'w', 0o600);
        writeFileSync(fd, value);
        fsyncSync(fd);
        fault?.('after-file-sync');
        closeSync(fd);
        fd = undefined;
        fault?.('before-rename');
        renameSync(temp, path);
        fault?.('after-rename');
        const directory = openSync(dirname(path), 'r');
        try {
            fsyncSync(directory);
            fault?.('after-directory-sync');
        }
        finally {
            closeSync(directory);
        }
    }
    finally {
        if (fd !== undefined)
            closeSync(fd);
    }
}
