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
# Advance before Node creates worker threads: a retained application PID can
# otherwise collide with a fresh launcher thread even after child advancement.
# This only allocates/reaps our own children; stale metadata remains untouched.
writer_max=0
writer_count=0
for writer_file in "$CONSOLE_STORAGE_DIR/writer.lock" "$AUDIT_STORAGE_DIR"/*.writer; do
    [ -e "$writer_file" ] || continue
    writer_count=$((writer_count + 1))
    [ "$writer_count" -le 129 ] && [ -f "$writer_file" ] && [ ! -L "$writer_file" ] || { echo 'Protected writer metadata required.' >&2; exit 78; }
    writer_pid=$(head -c 17 "$writer_file")
    case "$writer_pid" in ''|0*|*[!0-9]*) echo 'Invalid writer ownership metadata.' >&2; exit 78;; esac
    [ "${#writer_pid}" -le 16 ] && [ "$writer_pid" -gt 1 ] && [ "$writer_pid" -le 4096 ] && [ "$writer_pid" -ne "$$" ] || { echo 'Writer PID requires quiesced host repair.' >&2; exit 78; }
    [ "$writer_pid" -le "$writer_max" ] || writer_max=$writer_pid
done
writer_advance=0
while [ "$writer_max" -gt 0 ]; do
    writer_advance=$((writer_advance + 1))
    [ "$writer_advance" -le 4096 ] || { echo 'Bounded writer PID recovery exhausted.' >&2; exit 78; }
    /bin/sh -c 'exit 0' &
    writer_child=$!
    wait "$writer_child"
    [ "$writer_child" -le "$writer_max" ] || break
done
exec node /app/scripts/docker-launcher.mjs "$@"
