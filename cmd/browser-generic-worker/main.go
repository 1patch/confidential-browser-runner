// This entrypoint contains only the generic Go/Chromium/WASM service. Persistent
// storage remains mandatory; public image packaging does not waive that gate.
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	browser "github.com/1patch/confidential-browser-runner"
)

func run() error {
	if browser.RequireUnprivileged() != nil {
		return browser.ErrDenied
	}
	raw := []byte(os.Getenv("BROWSER_BOOTSTRAP"))
	os.Unsetenv("BROWSER_BOOTSTRAP")
	config, err := browser.ParseBootstrap(raw)
	clear(raw)
	if err != nil || config.InferenceKey != "" {
		return browser.ErrDenied
	}
	const root = "/workspace"
	if browser.RequireEncryptedVolume(root) != nil {
		return browser.ErrDenied
	}
	unlock, err := browser.LockDirectory(root)
	if err != nil {
		return err
	}
	defer unlock()
	worker, err := browser.NewBrowserWorker(config, root, "/usr/bin/chromium")
	config.StorageKey = ""
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	return browser.ServeWorker(ctx, ":8080", worker)
}

func main() {
	if run() != nil {
		fmt.Fprintln(os.Stderr, "browser worker stopped; configuration or execution unavailable")
		os.Exit(1)
	}
}
