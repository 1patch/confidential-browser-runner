package main

import (
	"context"
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
	raw := []byte(os.Getenv("BROWSER_OBJECT_BOOTSTRAP"))
	os.Unsetenv("BROWSER_OBJECT_BOOTSTRAP")
	c, err := browser.ParseObjectBootstrap(raw)
	clear(raw)
	if err != nil {
		return err
	}
	unlock, err := browser.LockDirectory(root)
	if err != nil {
		return err
	}
	defer unlock()
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	w, err := browser.NewObjectWorker(ctx, c, root, "/usr/bin/chromium")
	c = browser.ObjectBootstrap{}
	if err != nil {
		return err
	}
	return browser.ServeWorker(ctx, ":8080", w)
}

func main() {
	if run() != nil {
		fmt.Fprintln(os.Stderr, "browser object worker stopped; configuration, storage or recovery unavailable")
		os.Exit(1)
	}
}
