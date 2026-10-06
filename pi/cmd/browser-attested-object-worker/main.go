package main

import (
	"context"
	"crypto/ed25519"
	"encoding/base64"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	browser "github.com/1patch/confidential-browser-runner/pi"
)

func run() error {
	const root = "/workspace"
	if browser.RequireUnprivileged() != nil || browser.RequireMemoryVolume(root) != nil {
		return browser.ErrDenied
	}
	// Only this public key is measured into the image configuration. Runtime
	// credentials arrive later through operator-verified, attested TLS.
	encoded := os.Getenv("BROWSER_BOOTSTRAP_PUBLIC_KEY")
	key, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(key) != ed25519.PublicKeySize || base64.StdEncoding.EncodeToString(key) != encoded || os.Getenv("BROWSER_OBJECT_BOOTSTRAP") != "" || os.Getenv("BROWSER_BOOTSTRAP") != "" {
		return browser.ErrDenied
	}
	unlock, err := browser.LockDirectory(root)
	if err != nil {
		return err
	}
	defer unlock()
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	gate, err := browser.NewObjectBootGate(ctx, ed25519.PublicKey(key), root, "/usr/bin/chromium")
	if err != nil {
		return err
	}
	return browser.ServeObjectBootGate(ctx, ":8080", gate)
}

func main() {
	if run() != nil {
		fmt.Fprintln(os.Stderr, "browser startup or encrypted checkpoint unavailable")
		os.Exit(1)
	}
}
