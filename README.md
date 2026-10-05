# Generic browser worker

Go operates a sandboxed Chromium browser through private CDP. Caller-provided
JavaScript runs in QuickJS WebAssembly and can only invoke bounded browser
actions. Each worker has one immutable owner. Signed capabilities authorize
execution; a separate operator key authorizes credential installation.

This source distribution contains no application agent, prompts, Node runtime,
inference credential or control-plane provisioning code. An external Pi agent
can drive `/v1/exec` through its authenticated coordinator. `/v1/agent` is denied.
The classifier is a policy stub, not a trained safety model or a security proof.

Build the managed-volume image with
`docker build --target runtime -t browser-worker .`, or the encrypted-object
image with `docker build --target object-runtime -t browser-object-worker .`.
The public-image boot path uses the `attested-object-runtime` build target.
All contain only generic Go and Chromium. The build runs generic worker, WASM,
storage and capability tests. The separate `acceptance` target runs the real
Chromium recovery test when supplied the restricted container profile.

All entrypoints require UID 10001, no-new-privileges and the documented
restricted capability profile. Managed-volume mode requires private
`BROWSER_BOOTSTRAP` delivery and an unlocked Tinfoil encrypted volume at
`/workspace`. The image contains no runtime credentials. Put the instance behind
attested TLS and verify its exact measured release before sending private data.
Never expose CDP or mount a Bash workspace into the browser worker.

Tinfoil v0.14.8's ordinary container schema rejects the namespace-related
capability additions used by the local Docker profile. Its public config instead
uses `cvm_admin` only for a short, measured launcher. CVM PID 1 also disables
unprivileged user namespaces. The launcher enables that kernel feature inside
the dedicated one-owner browser VM so Chromium can create its sandbox. Before
opening a listener, it executes `setpriv` to change to UID/GID 10001, clear supplementary groups,
drop all bounding/inheritable/ambient capabilities, set no-new-privileges and
clear inherited environment variables. The worker then rechecks those process
restrictions, RAM storage and swap before accepting bootstrap data. Chromium
must additionally report its own namespace/seccomp sandbox active. The launcher
and its VM-wide initial authority are part of the trusted code; this is a
distinct runtime profile that requires its own live confidential acceptance.
The `cvm-acceptance` image exercises this startup path with synthetic tests.
The manual image workflow runs that acceptance before pushing an image. After
pinning its digest and an operator-generated public key in `tinfoil-config.yml`,
the separate measurement workflow publishes evidence for an immutable Git tag.
Both workflows are inert until explicitly dispatched; never commit private keys
or runtime bootstrap values to this repository.

Object mode requires private `BROWSER_OBJECT_BOOTSTRAP` delivery, containing
`browser` (the existing owner-bound bootstrap) and `storage` (bucket, region and
explicit owner-scoped S3 credentials). `/workspace` must be a private tmpfs mount
with rw,nosuid,nodev,noexec and swap disabled. A trusted provisioner must create
the encrypted identity and initial profile head before worker startup; missing
state never means a fresh browser. This provisioning and attested key delivery
are external operator responsibilities.

The `attested-object-runtime` entrypoint instead boots without credentials. Its
only configuration input is `BROWSER_BOOTSTRAP_PUBLIC_KEY`, an Ed25519 public key
embedded inline in the measured configuration (see `tinfoil-config.yml.example`).
After verifying the exact enclave domain and immutable release, the operator
reads `GET /v1/bootstrap` and signs a two-minute-or-less grant binding that fresh
process nonce to the SHA256 of the exact private JSON body. One
`POST /v1/bootstrap` accepts it with HTTP 202 and starts restoration. The
signature uses the `browser-bootstrap/v1.` domain; execution and credential keys
must differ from this issuer. Requests remain unavailable until real Chromium
initialization completes. Boot status returns nonce, state, body digest and an
optional fixed failure-stage label. It never returns raw errors or private data.
A disconnect, failed start or repeated POST never resets or reassigns the worker.
On uncertain delivery, inspect status using the retained nonce and digest; never
resubmit automatically. This service supplies the receiving boundary; the
attestation-verifying sender remains outside the public image. Profile
provisioning and production S3 credential renewal remain external requirements.

Before cloud power-off, the same operator signs a distinct `browser-drain/v1.`
grant binding the current nonce and bootstrap digest, and sends an empty
`POST /v1/drain`. Execution and credential keys cannot drain a worker. One claim
rejects new work, closes Chromium and publishes its encrypted checkpoint while
the VM still has network access. Retain a durable drain intent before sending;
resolve lost replies through the existing read-only status endpoint. A successful
drain reports `stopped`; a checkpoint failure reports `failed` and stays claimed.
Confirm the authenticated storage head is closed before invoking cloud stop.
Do not rely on a cloud stop request to deliver a graceful process shutdown.

The object backend uploads only owner-bound authenticated ciphertext and uses
conditional S3 writes to reserve actions and acquire a profile exclusively.
After a clean browser shutdown, it saves a bounded profile archive and private
session cookies. Host-only, domain and partition cookie scopes are preserved.
An unclean stop or incomplete save quarantines the profile for operator recovery;
the worker never silently restores an older checkpoint. Finished checkpoints
restore into a fresh local directory. They preserve profile data and logins;
open tabs and in-flight pages are not resumed. S3 is trusted for freshness and
availability; encryption alone does not prevent a storage administrator rollback.
Session cookies are captured immediately before browser shutdown. This is not
an atomic transaction across a website's background activity and its profile
databases; applications must reconcile outstanding work after reconnecting.

Real Chromium plus an encrypted object fixture verifies local-storage and login
recovery across fresh filesystems. A separate operator proof also tested actual
S3/IAM isolation, conditional writes, lost acknowledgments and browser recovery
using two synthetic owners' private buckets and temporary credentials. That
provisioning script is outside this generic distribution. Production credential
renewal, confidential stop/wake and 100 concurrent browsers still require live
acceptance. The prior public release passed actual hardware verification,
private bootstrap, real browser navigation/screenshots and capability denials
on Tinfoil; its direct cloud-stop test did not save a reusable checkpoint.
