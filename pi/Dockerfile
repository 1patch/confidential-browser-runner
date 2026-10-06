FROM golang:1.27.1-bookworm@sha256:69a7b9788769bec032d238959b61854e9ae87f57be9029ec04e9885fabf99195 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY *.go ./
COPY cmd/ ./cmd/
RUN go vet ./... && go test -race -count=1 -timeout=120s ./... \
 && CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/browser-attested-object-worker ./cmd/browser-attested-object-agent \
 && CGO_ENABLED=0 go test -trimpath -ldflags='-s -w' -c -o /out/browser.test .

FROM node:24.13.1-bookworm-slim@sha256:a81a03dd965b4052269a57fac857004022b522a4bf06e7a739e25e18bce45af2 AS pi-dependencies
WORKDIR /build
COPY package.json package-lock.json ./
COPY deploy/platform/fix-agent-dependencies.mjs deploy/platform/fix-agent-dependencies.mjs
RUN npm ci --omit=dev --no-audit --no-fund \
 && node deploy/platform/fix-agent-dependencies.mjs --check \
 && npm audit --omit=dev
COPY agent-bundle/ ./
RUN node --input-type=module -e 'import{readFileSync}from"node:fs";import{createHash}from"node:crypto";const m=JSON.parse(readFileSync("manifest.json"));if(m.version!==1||m.entry!=="confidential-object-agent-process.mjs"||!m.files[m.entry])throw Error("Invalid bundle");for(const [p,h]of Object.entries(m.files)){if(!/^[A-Za-z0-9_-]+\.mjs$/.test(p)||createHash("sha256").update(readFileSync(p)).digest("hex")!==h)throw Error("Bundle mismatch");}'

FROM debian:trixie-slim@sha256:a99cfc517144bc59b1978475ec53b46ecabec7e43635402ee5b77cc54cd1b20a AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium chromium-sandbox ca-certificates fonts-liberation util-linux \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --gid 10001 browser \
 && useradd --uid 10001 --gid 10001 --no-create-home --home-dir /workspace browser \
 && mkdir /workspace && chown 10001:10001 /workspace && chmod 0700 /workspace
COPY --from=build /out/browser-attested-object-worker /usr/local/bin/browser-attested-object-worker
COPY --from=pi-dependencies /usr/local/bin/node /usr/local/bin/node
COPY --from=pi-dependencies /build/ /opt/sure-agent/
COPY --chmod=0555 cvm-entrypoint.sh /usr/local/bin/browser-cvm-entrypoint
USER 0:0
EXPOSE 8080
STOPSIGNAL SIGTERM
ENTRYPOINT ["/usr/local/bin/browser-cvm-entrypoint"]

FROM runtime AS acceptance
COPY --from=build /out/browser.test /usr/local/bin/browser.test
COPY --chmod=0555 agent_wire_fixture.mjs /opt/acceptance/agent_wire_fixture.mjs
COPY --chmod=0555 object-agent-acceptance.sh /usr/local/bin/browser-attested-object-worker
