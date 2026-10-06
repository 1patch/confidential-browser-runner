# Confidential browser with Pi

This separate worker adds the trusted Pi agent to the generic Go, Chromium and
QuickJS-in-WASM browser. It accepts an explicit inference-bearing bootstrap only
after attested operator delivery. The browser-only image keeps its original
schema and does not accept inference credentials.

Pi session files live at `/workspace/profile/.sure-agent`, inside the same
owner-bound encrypted object checkpoint as the browser. A clean stop must wait
for every agent child to exit successfully before committing a reusable profile.
An uncertain child or unfinished turn leaves the profile quarantined.

The exported JavaScript bundle contains the trusted Sure Pi adapter and public
SDK code. Its manifest binds every generated module. Public runtime dependencies
are locked separately; the installed SDK receives the same verified dependency
repair used when building the bundle. No application source checkout, private
configuration, signing key, inference credential or user data belongs here.

`docker build --target acceptance .` builds the exact measured launcher plus a
synthetic inference fixture. The acceptance test drives real Chromium through
the packaged Pi SDK, checkpoints, removes the original local profile and checks
that a second Pi process recovers its conversation from encrypted storage.
This test does not establish real confidential hardware, live model inference,
Sure chat activation or 100 concurrent browser capacity.

The release target is `runtime`. It excludes the test binary and inference
fixture. Run the checked-in `build-pi-image.yml` from the public repository's
root `.github/workflows/`, with this export at `pi/`. Publication remains a
separate operator action. Measure an immutable image digest with the example
configuration, then independently verify the release before sending secrets.
