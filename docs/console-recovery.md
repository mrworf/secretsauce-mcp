# Whole-instance recovery

Owners open Settings → Backups & restore → Restore an instance archive. Confirm your
current password and a fresh authenticator code, then select the encrypted `.ssbackup`
file and independent backup material. That material is different from MFA recovery codes.
Validation does not replace the instance. Review source, recovery point, included counts,
current-state consequences, actual initiator and a recoverable archived Owner.

On a clean replacement, prepare the documented single-process protected application key,
application and complete audit mounts, deployment configuration and HTTPS console proxy.
Quiesce the process and use a protected interactive host terminal:

```sh
CONSOLE_STORAGE_DIR=/state CONSOLE_KEY_FILE=/keys/console.key CONFIG_PATH=/config/config.yaml \
  node dist/consoleSetup.js --restore-proof https://console.example.org
```

Start the instance through the managed launcher retaining app/audit leases. The clean-host
console offers only authorized restore validation. Supply the newly issued 30-minute
host proof and independent archive material; neither archive/material nor an old password
alone authorizes recovery. The proof has a ten-attempt bound and is sent only in a dedicated
same-origin upload header, checked before the archive body is admitted. Never log request
headers, form bodies or proof values in the application or reverse proxy. Host command
output belongs only in the protected interactive terminal, never container/general logs.

Archive input is a versioned authenticated semantic JSON envelope, without filesystem
extraction or archive-directed file paths. Decoded archive limit is 192 MiB; HTTP JSON
wire limit is 192 MiB plus 64 KiB for the fixed envelope quoting overhead, read deadline
30 seconds. Decryption and schema/integrity verification run in the existing bounded
worker. Unknown archive fields, unsupported versions, missing dependencies, unsafe
structures and archives lacking a recoverable Owner fail before replacement.

One validated review occupies the shared backup/restore slot for at most five minutes.
Only encrypted staging exists on disk, in the fixed non-downloadable protected file
`restore-preview.stage`. Cancel before installation releases authority and removes only
verified owned ciphertext. An interrupted or changed staging reservation is never adopted
or automatically deleted: stop the application, inspect the fixed staging and associated
`.pending` file, and remove only that interrupted output through protected host access
before retrying. A restart cannot accumulate another staging file behind that reservation.

The preview retains current deployment origin, bind address, MCP path, application key,
audit mounts and host storage paths. Business credentials and signing material belong to
the verified archive. The HTTPS proxy and external deployment inputs are operator-owned;
the Node gateway has no native TLS-listener certificate configuration. Supply those inputs
before recovery. Capacity reserves staged/new state, prior installation and pre-restore
protection, and must be checked again immediately before replacement.

This delivery slice provides validation and preview only. Safe installation, fresh
restricted enrollment and individual user/service reactivation follow in M17 slice 02.
