package browser

import (
	"context"
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
)

// NewObjectAgentBootGate belongs only in the separate Pi-enabled image. Its
// browser-only counterpart does not accept or launch application agent code.
func NewObjectAgentBootGate(ctx context.Context, issuer ed25519.PublicKey, root, executable string) (*ObjectBootGate, error) {
	if root != "/workspace" {
		return nil, ErrDenied
	}
	gate, err := NewObjectBootGate(ctx, issuer, root, executable)
	if err != nil {
		return nil, err
	}
	gate.parse = ParseObjectAgentBootstrap
	gate.create = func(ctx context.Context, c ObjectBootstrap) (*Worker, error) {
		return NewObjectAgentWorker(ctx, c, root, executable)
	}
	return gate, nil
}

func NewObjectAgentWorker(ctx context.Context, c ObjectBootstrap, root, executable string) (*Worker, error) {
	if root != "/workspace" {
		return nil, ErrDenied
	}
	raw, _ := json.Marshal(c)
	_, err := ParseObjectAgentBootstrap(raw)
	clear(raw)
	if err != nil {
		return nil, err
	}
	key, _ := base64.StdEncoding.DecodeString(c.Browser.StorageKey)
	defer clear(key)
	store, err := NewS3SealedStore(ctx, c.Storage, c.Browser.Owner, c.Browser.Audience, key, false)
	if err != nil {
		return nil, startupFailure("storage-identity", err)
	}
	return newObjectAgentWorker(ctx, c.Browser, root, executable, store)
}

func newObjectAgentWorker(ctx context.Context, c Bootstrap, root, executable string, store *SealedStore) (*Worker, error) {
	if c.InferenceKey == "" {
		return nil, ErrDenied
	}
	key := c.InferenceKey
	c.InferenceKey = ""
	w, err := newObjectWorker(ctx, c, root, executable, store)
	if err != nil {
		return nil, err
	}
	// The trusted Pi entrypoint uses profile/.sure-agent. This directory is in
	// the existing owner-bound encrypted archive, never a separate plaintext disk.
	w.Agent = &AgentBroker{Owner: c.Owner, Audience: c.Audience, Store: store, InferenceKey: key, checkpoint: true, launch: launchObjectAgent}
	return w, nil
}
