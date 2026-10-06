package browser

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/chromedp/chromedp"
)

func TestRealChromiumObjectAgentCheckpoint(t *testing.T) {
	if os.Getenv("SURE_BROWSER_OBJECT_PI_PROOF") != "1" {
		t.Skip("requires the separate packaged Pi acceptance image")
	}
	const root = "/workspace"
	if RequireUnprivileged() != nil || RequireMemoryVolume(root) != nil {
		t.Fatal("Pi proof requires private RAM and dropped privileges")
	}
	if _, e := os.Lstat(filepath.Join(root, "profile")); !os.IsNotExist(e) {
		t.Fatal("proof profile must start absent")
	}
	site := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		w.Write([]byte("<html><body>persistent proof</body></html>"))
	}))
	defer site.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	store, backing, key := profileFixture(t)
	c := testBootstrap(t, "alice")
	c.Audience = "worker"
	c.InferenceKey = "synthetic-private-inference-key"
	c.StorageKey = base64.StdEncoding.EncodeToString(key)
	c.Origins = []string{"https://fixture.test"}
	c.CredentialOrigins = c.Origins
	var firstSession []byte
	var sessionPath string
	for _, turn := range []string{"First", "Second"} {
		w, e := newObjectAgentWorker(ctx, c, root, "/usr/bin/chromium", store)
		if e != nil {
			t.Fatal(e)
		}
		w.CreateDriver = func(lifetime context.Context) (Driver, error) {
			return NewChrome(lifetime, ChromeConfig{Executable: "/usr/bin/chromium", ProfileDirectory: filepath.Join(root, "profile"), Policy: NetworkPolicy{Origins: c.Origins}, testOptions: []chromedp.ExecAllocatorOption{chromedp.Flag("proxy-server", false), chromedp.Flag("ignore-certificate-errors", true), chromedp.Flag("host-resolver-rules", "MAP fixture.test "+strings.TrimPrefix(site.URL, "https://"))}})
		}
		if turn == "Second" {
			got, e := os.ReadFile(sessionPath)
			if e != nil || !bytes.Equal(got, firstSession) {
				t.Fatal("Pi session did not recover exactly", e)
			}
		}
		if e = w.Initialize(ctx); e != nil {
			t.Fatal(e)
		}
		if _, e = w.Sandbox.Execute(ctx, "alice", `return await browser.navigate({url:"https://fixture.test"});`, w.driver); e != nil {
			t.Fatal(e)
		}
		a := w.Agent.(*AgentBroker)
		a.launch = func(ctx context.Context, raw json.RawMessage) (*agentProcess, error) {
			cmd := exec.CommandContext(ctx, "/usr/local/bin/node", "--import", "/opt/acceptance/agent_wire_fixture.mjs", "/opt/sure-agent/confidential-object-agent-process.mjs")
			cmd.Dir = "/opt/sure-agent"
			cmd.Env = []string{"PATH=", "HOME=/workspace/profile/.sure-agent", "NODE_ENV=production", "PI_PACKAGE_DIR=/opt/sure-agent/node_modules/@earendil-works/pi-coding-agent"}
			return launchAgentProcess(ctx, raw, cmd)
		}
		p := Principal{Owner: "alice", Audience: "worker", Scope: "agent", Expires: time.Now().Add(time.Minute).Unix()}
		verifyPackagedPiTurn(t, ctx, a, p, AgentStep{}, w.driver, turn)
		if e = w.Close(ctx); e != nil {
			t.Fatal("Pi/browser checkpoint failed", e)
		}
		if turn == "First" {
			if e = filepath.WalkDir(filepath.Join(root, "profile", ".sure-agent"), func(path string, d os.DirEntry, e error) error {
				if e != nil {
					return e
				}
				if !d.IsDir() && strings.HasSuffix(path, ".jsonl") {
					if sessionPath != "" {
						t.Fatal("multiple proof sessions")
					}
					sessionPath = path
					firstSession, e = os.ReadFile(path)
				}
				return e
			}); e != nil || len(firstSession) == 0 {
				t.Fatal("packaged Pi did not save a session", e)
			}
			for _, blob := range backing.objects {
				if bytes.Contains(blob.data, []byte("Synthetic browser answer")) || bytes.Contains(blob.data, []byte(c.InferenceKey)) {
					t.Fatal("private agent state outside encryption")
				}
			}
			if e = os.Rename(filepath.Join(root, "profile"), filepath.Join(root, "verified-prior-profile")); e != nil {
				t.Fatal(e)
			}
			store = reopenProfileStore(t, backing, key)
		}
	}
}
