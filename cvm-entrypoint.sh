#!/bin/sh
set -eu
# Tinfoil's cvm_admin profile permits Chromium's namespace syscalls. Its root
# startup is used only to irreversibly drop privileges before the HTTP listener,
# S3 client or browser exists. No runtime secret is an environment variable.
test "$(/usr/bin/id -u)" = 0
exec /usr/bin/setpriv \
  --reuid=10001 --regid=10001 --clear-groups \
  --bounding-set=-all --inh-caps=-all --ambient-caps=-all --no-new-privs \
  /usr/bin/env -i HOME=/workspace PATH=/usr/local/bin:/usr/bin:/bin \
  BROWSER_BOOTSTRAP_PUBLIC_KEY="${BROWSER_BOOTSTRAP_PUBLIC_KEY:-}" \
  /usr/local/bin/browser-attested-object-worker "$@"
