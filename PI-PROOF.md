# Confidential Pi browser proof — October 5, 2026

[Pi release 3](https://github.com/1patch/confidential-browser-runner/releases/tag/browser-pi-proof-20261005-3)
uses image source `dd616ad81146da66919bcd61a0d63d707b231a0e` and immutable
configuration source `4142d1c1be2e5aec553610814bebf95509775efb`.

```
ghcr.io/1patch/confidential-browser-runner@sha256:2248673250eeffc0bbf81452a43f86d01102114bf7ab813512479133ee68ef57
```

The [image workflow](https://github.com/1patch/confidential-browser-runner/actions/runs/37401515514)
passed standalone Go vet/race, real Chromium under the measured privilege-dropping
launcher, encrypted Pi checkpoint/recovery, nested screenshots delivered as image
content on the actual Pi SDK wire, and a subsequent turn with no tools granted.
Inference is synthetic in this container test.

The [measurement workflow](https://github.com/1patch/confidential-browser-runner/actions/runs/37401874317)
produced this independently verified manifest:

```
sha256:6231645e536faaef8d008b0fe428c27467e3b83131f8fcedcbf393e014e9b9d9
```

Anonymous registry access, exact image/configuration bytes, source/tag, hosted
signing workflow, SNP/TDX predicate and 2-CPU/8-GiB/zero-GPU VM shape matched.
An actual confidential Tinfoil VM passed hardware attestation, wrong-pin rejection,
unsigned-bootstrap denial and closed application routes before runtime delivery.
The operator's signing keys remain local.

Live Pi and Chromium inside this release used attested Tinfoil inference to open
example.com, read the page and return a nested screenshot: one program, one
screenshot, 16.411 seconds. Authenticated drain saved a verified 3,019,776-byte
closed encrypted archive containing the Pi conversation and browser session.
The archive contained none of the runtime inference, storage or encryption keys.
The operator then confirmed the VM was stopped and redeployed the same release.
Fresh hardware verification passed and the one-use bootstrap nonce changed.
The restored Pi recalled the exact random 32-character code from its earlier
conversation in 4.106 seconds. Its new prompt did not contain the code, and no
tools were granted or called. The first browser turn was not replayed. Browser
profile recovery does not automatically reopen tabs.

The restored worker rejected four signed boundary probes with HTTP 403: another
owner's agent/browser requests, and its own execution authority trying to access
credentials or drain the worker. Final authenticated drain saved a different,
verified 3,052,544-byte closed checkpoint containing both completed assistant
turns and the browser session, with runtime keys again absent. The dedicated
proof VM is confirmed stopped after the final checkpoint.

## Previously corrected failures

Release `browser-pi-proof-20261005-4` fixes the standard release-workflow layout
required by Tinfoil's create validation. Its
[preparation](https://github.com/1patch/confidential-browser-runner/actions/runs/37404248835)
and [publication](https://github.com/1patch/confidential-browser-runner/actions/runs/37404266104)
passed at source `cad624110f92431909fdd7127a56f4d8cfc71db3`. Independent signature
verification binds the exact source/tag and hosted `tinfoil-release-publish.yml`.
The image, configuration bytes and measured manifest are identical to release 3.
Actual Tinfoil create preflight now returns HTTP 200, valid, and no errors.
That read-only check created no instance; the hardware/recall proof above remains
the release-3 run. Existing tags are never overwritten by the release workflow.

The first live Pi release returned its screenshot nested inside an observation.
The adapter now promotes bounded nested screenshots into image content and keeps
those pixels out of saved Pi transcripts. A later recall attempt with no current
tool authority exposed the SDK's empty tool-list compatibility behavior. Tinfoil
returned HTTP 400 for `tools: []` with earlier tool history. Omitting only the empty
field returned HTTP 200 and exact recall with zero tool calls in an isolated live
inference diagnostic. Existing nonempty tool declarations remain unchanged.

The failed VM is stopped and its profile stays quarantined; its previous verified
archive remains intact. No failed browser action or agent turn was replayed.
These proofs do not establish customer activation, initialized fleet-controller
operation, production retention, or 100 concurrent browsers. Website text and
screenshots remain untrusted input; secrets can still be revealed by a trusted
website that renders them into observations.
