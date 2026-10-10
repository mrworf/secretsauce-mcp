#!/bin/sh
set -eu
# Stable kernel leases protect shared mount ownership across PID namespaces.
[ "$#" -ge 2 ] && [ "$1" = node ] || { echo 'Supported Node application invocation required.' >&2; exit 78; }
# Preserve established unmanaged/YAML gateway invocation without a console mount.
if [ -z "${CONSOLE_STORAGE_DIR:-}" ] && [ -z "${CONSOLE_KEY_FILE:-}" ]; then
    exec "$@"
fi
: "${CONSOLE_STORAGE_DIR:?Stable console mount required}"
: "${AUDIT_STORAGE_DIR:?Stable audit mount required}"
[ -d "$CONSOLE_STORAGE_DIR" ] && [ -d "$AUDIT_STORAGE_DIR" ] || { echo 'Stable writable mounts required.' >&2; exit 78; }
exec 9>"$CONSOLE_STORAGE_DIR/container.lease"
flock -n 9 || { echo 'One active application instance required.' >&2; exit 78; }
exec 8>"$AUDIT_STORAGE_DIR/container.lease"
flock -n 8 || { echo 'One active audit writer required.' >&2; exit 78; }
exec node /app/scripts/docker-launcher.mjs "$@"
