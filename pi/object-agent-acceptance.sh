#!/bin/sh
set -eu
# Only this synthetic acceptance image includes the inference fixture/test binary.
export SURE_BROWSER_TEST_CHROME=/usr/bin/chromium
export SURE_BROWSER_MEMORY_PROOF=1
export SURE_BROWSER_DROPPED_ROOT_PROOF=1
export SURE_BROWSER_OBJECT_PI_PROOF=1
exec /usr/local/bin/browser.test "$@"
