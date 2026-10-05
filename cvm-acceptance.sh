#!/bin/sh
set -eu
# Only the acceptance image replaces the fixed post-drop executable with this
# script. The public runtime image never contains it or the test binary.
export SURE_BROWSER_TEST_CHROME=/usr/bin/chromium
export SURE_BROWSER_MEMORY_PROOF=1
export SURE_BROWSER_DROPPED_ROOT_PROOF=1
exec /usr/local/bin/browser.test "$@"
