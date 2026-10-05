FROM golang:1.27.1-bookworm@sha256:69a7b9788769bec032d238959b61854e9ae87f57be9029ec04e9885fabf99195 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY *.go ./
COPY cmd/browser-generic-worker/ ./cmd/browser-generic-worker/
COPY cmd/browser-object-worker/ ./cmd/browser-object-worker/
COPY cmd/browser-attested-object-worker/ ./cmd/browser-attested-object-worker/
RUN go vet ./... && go test -count=1 -timeout=120s ./... \
 && CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/browser-worker ./cmd/browser-generic-worker \
 && CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/browser-object-worker ./cmd/browser-object-worker \
 && CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/browser-attested-object-worker ./cmd/browser-attested-object-worker

FROM debian:trixie-slim@sha256:a99cfc517144bc59b1978475ec53b46ecabec7e43635402ee5b77cc54cd1b20a AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium chromium-sandbox ca-certificates fonts-liberation util-linux \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --gid 10001 browser \
 && useradd --uid 10001 --gid 10001 --no-create-home --home-dir /workspace browser \
 && mkdir /workspace && chown 10001:10001 /workspace && chmod 0700 /workspace
COPY --from=build /out/ /usr/local/bin/
COPY --chmod=0555 cvm-entrypoint.sh /usr/local/bin/browser-cvm-entrypoint
USER 10001:10001
ENV HOME=/workspace
EXPOSE 8080
STOPSIGNAL SIGTERM
ENTRYPOINT ["/usr/local/bin/browser-worker"]

FROM runtime AS object-runtime
ENTRYPOINT ["/usr/local/bin/browser-object-worker"]

FROM runtime AS attested-object-runtime
ENTRYPOINT ["/usr/local/bin/browser-attested-object-worker"]

FROM build AS test-build
RUN CGO_ENABLED=0 go test -trimpath -ldflags='-s -w' -c -o /out/browser.test .

FROM runtime AS acceptance
COPY --from=test-build /out/browser.test /usr/local/bin/browser.test
ENV SURE_BROWSER_TEST_CHROME=/usr/bin/chromium
ENV SURE_BROWSER_MEMORY_PROOF=1
ENTRYPOINT ["/usr/local/bin/browser.test"]

FROM acceptance AS cvm-acceptance
COPY --chmod=0555 cvm-acceptance.sh /usr/local/bin/browser-attested-object-worker
USER 0:0
ENTRYPOINT ["/usr/local/bin/browser-cvm-entrypoint"]
