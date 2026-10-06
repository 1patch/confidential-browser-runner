package browser

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestBrowserOnlyWorkerKeepsAuthorityWithoutPrivateAgent(t *testing.T) {
	pub, key, _ := ed25519.GenerateKey(rand.Reader)
	operator, _, _ := ed25519.GenerateKey(rand.Reader)
	storageKey := make([]byte, 32)
	rand.Read(storageKey)
	c := Bootstrap{Version: 1, Owner: "alice", Audience: "worker", ExecutePublicKey: base64.StdEncoding.EncodeToString(pub),
		SecretsPublicKey: base64.StdEncoding.EncodeToString(operator), StorageKey: base64.StdEncoding.EncodeToString(storageKey), Origins: []string{"https://example.com"}}
	root := filepath.Join(t.TempDir(), "worker")
	wrong := c
	wrong.InferenceKey = "synthetic-inference-key"
	if _, err := NewBrowserWorker(wrong, root, "unused"); err == nil {
		t.Fatal("generic service accepted an inference credential")
	}
	if _, err := os.Stat(root); !os.IsNotExist(err) {
		t.Fatal("rejected bootstrap touched storage")
	}
	w, err := NewBrowserWorker(c, root, "unused")
	if err != nil || w.Agent != nil {
		t.Fatal("browser-only initialization", err)
	}
	d := &recordingDriver{}
	w.CreateDriver = func(context.Context) (Driver, error) { return d, nil }
	call := func(owner, scope, path string) *httptest.ResponseRecorder {
		p := Principal{Owner: owner, Audience: c.Audience, Scope: scope, ID: "request", Expires: time.Now().Add(time.Minute).Unix()}
		token, _ := SignCapability(key, p)
		r := httptest.NewRequest("POST", path, strings.NewReader(`{"id":"request","code":"return await browser.snapshot();"}`))
		r.Header.Set("Authorization", "Bearer "+token)
		out := httptest.NewRecorder()
		w.ServeHTTP(out, r)
		return out
	}
	if out := call("bob", "execute", "/v1/exec"); out.Code != 403 || len(d.actions) != 0 {
		t.Fatal("foreign owner reached browser")
	}
	if out := call("alice", "agent", "/v1/agent"); out.Code != 403 || len(d.actions) != 0 {
		t.Fatal("generic service accepted the private agent route", out.Code)
	}
	if out := call("alice", "execute", "/v1/exec"); out.Code != 200 || len(d.actions) != 1 {
		t.Fatal("authorized WASM execution failed", out.Code)
	}
	if out := call("alice", "execute", "/v1/exec"); out.Code != 200 || len(d.actions) != 1 {
		t.Fatal("duplicate request replayed effects")
	}
	w.Close(context.Background())
	restored, err := NewBrowserWorker(c, root, "unused")
	if err != nil {
		t.Fatal("same owner cannot reopen durable state", err)
	}
	restored.CreateDriver = func(context.Context) (Driver, error) {
		t.Fatal("completed request launched a fresh browser")
		return nil, ErrUnavailable
	}
	w = restored
	if out := call("alice", "execute", "/v1/exec"); out.Code != 200 {
		t.Fatal("durable result unavailable after restart", out.Code)
	}
	c.Owner = "bob"
	if _, err := NewBrowserWorker(c, root, "unused"); err == nil {
		t.Fatal("another owner reused the profile")
	}
}
