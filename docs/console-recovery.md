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

Start replacement only after checking the exact preview and nominated archived Owner.
Maintenance stops new administration, OAuth and downstream admission before any
replacement. Already dispatched work drains under its existing finite request deadlines;
remote side effects may be uncertain and are never rolled back by this tool. An initialized
instance first creates and verifies an automatic encrypted pre-restore archive under the
same job lease. Keep its original independent material: the recovered instance uses the
uploaded archive's material, which may differ from prior retained archive key IDs.
The current host backup catalog and mount remain available after recovery. The imported
daily schedule stays disabled until its mount and policy are explicitly reviewed.

A separate protected, non-downloadable encrypted full prior installation retains factors
only for failed installation rollback. Atomic authenticated selection and completion
markers choose a coherent prior installation or complete restricted recovery after a crash.
Prior selection requires fresh login: old sessions, client grants, proofs and references
remain invalid. Cleanup moves the entire transaction into a cleanup-only namespace before
removing decision/source files. It cannot select old state after durable completion or
reset a later enrolled Owner. A failed rollback stays unavailable for protected host repair.
Never delete ownership leases or use ordinary configuration to bypass storage/audit failure.
Temporary rollback data is deleted after durable success or completed rollback.

Successful installation clears all prior password/factor/session/grant/proof authority.
The nominated archived Owner receives a single-use 30-minute continuation allowing only
recovery status and fresh password, authenticator and recovery-code enrollment. Its raw
value stays only in the authorized response and browser memory; it is excluded from
backups and browser persistent storage. If the response, seed or codes are lost, or the
continuation expires, stop the instance and issue a replacement in a protected terminal:

```sh
CONSOLE_STORAGE_DIR=/state CONSOLE_KEY_FILE=/keys/console.key \
  node dist/consoleSetup.js --recover-restore
```

The replacement invalidates the previous continuation and enrollment material. An archive,
old password or prior host proof cannot authorize fresh enrollment. Completed recovery
never automatically reverts because enrollment failed. Audit health gates enrollment and
activation. Uncertain activation completion remains restricted until protected durable
repair and fresh login; an existing diagnostic session never upgrades.

After fresh Owner login, the review checklist links People & Access, Services,
authentication/backups, clients and Activity. Each other user requires explicit Owner
review and a fresh bound enrollment link. All services start Disabled. Review current
credentials, destinations, policy and eligible access, then acknowledge the recovered
service review before enabling it individually. Unmapped legacy subjects remain visible
review data and can be removed or explicitly mapped; they do not grant fresh identity
access. The existing shared bearer principal may be deliberately assigned only under
reviewed bearer semantics. There is no bulk resume. One service can resume while other
services remain Disabled. External identity mappings and external OAuth/shared bearer
modes require explicit reactivation. Clients authorize again and acquire new references.
Externally issued JWT lifetime remains controlled by that issuer; the platform does not
invent issuer token revocation after explicit mapping/authentication reactivation.

Activity keeps the independent current-host management journal and gateway tail, including
newer events and failures. Imported archive domains are historical evidence with original
source instance, archive and protected chain identity. Original keys/redaction context stay
encrypted as provenance; display rows are rebuilt from verified source domains in a bounded
worker and excluded from portable snapshots. Overlap displays once, with newer local
completion outcomes taking precedence. Repeated recovery keeps flat bounded source
segments. Reviewed retention deletes only wholly expired resolved imported segments and
keeps a durable source/head deletion receipt; unresolved outcomes remain retained.

A clean replacement records the unavailable source-host interval from the last verified
archived evidence timestamp to the first durable local event of the installed recovery
state, excluding preflight proof/preview activity. An unavailable endpoint remains unknown;
clock skew is explicitly labeled instead of asserting impossible continuity. Activity and
evidence exports state recovery status and source provenance. Independently retained
external evidence remains necessary against host loss or hostile host alteration.
