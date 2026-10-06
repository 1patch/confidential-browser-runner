package browser

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"syscall"
	"testing"
	"time"

	"github.com/chromedp/chromedp"
)

func TestRealChromiumObjectCheckpoint(t *testing.T) {
	s, backing, key := profileFixture(t)
	testRealChromiumObjectCheckpoint(t, s, key, func() *SealedStore { return reopenProfileStore(t, backing, key) }, "worker")
}

func testRealChromiumObjectCheckpoint(t *testing.T, s *SealedStore, key []byte, reopen func() *SealedStore, audience string) {
	executable := os.Getenv("SURE_BROWSER_TEST_CHROME")
	if executable == "" {
		t.Skip("set SURE_BROWSER_TEST_CHROME for real object-profile recovery")
	}
	var sessionSeen, persistentSeen, operatorSeen atomic.Bool
	site := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/login" {
			http.SetCookie(w, &http.Cookie{Name: "site-session", Value: "synthetic-site-session", Path: "/", HttpOnly: true, Secure: true, SameSite: http.SameSiteStrictMode})
			http.SetCookie(w, &http.Cookie{Name: "site-persistent", Value: "synthetic-site-persistent", Path: "/", MaxAge: 86400, HttpOnly: true, Secure: true, SameSite: http.SameSiteStrictMode})
		}
		if c, e := r.Cookie("site-session"); e == nil && c.Value == "synthetic-site-session" {
			sessionSeen.Store(true)
		}
		if c, e := r.Cookie("site-persistent"); e == nil && c.Value == "synthetic-site-persistent" {
			persistentSeen.Store(true)
		}
		if c, e := r.Cookie("__Host-operator"); e == nil && c.Value == "synthetic-operator-secret" {
			operatorSeen.Store(true)
		}
		w.Header().Set("Content-Type", "text/html")
		w.Write([]byte(`<html><body><input id="name"><button id="save" onclick="localStorage.setItem('name',document.querySelector('#name').value);document.querySelector('#result').textContent=localStorage.getItem('name')">Save</button><div id="result"></div><script>document.querySelector('#result').textContent=localStorage.getItem('name')||'empty';</script></body></html>`))
	}))
	defer site.Close()
	c := testBootstrap(t, "alice")
	c.Audience = audience
	c.StorageKey = base64.StdEncoding.EncodeToString(key)
	c.Origins = []string{"https://fixture.test"}
	c.CredentialOrigins = c.Origins
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	open := func(store *SealedStore, root string) *Worker {
		w, err := newObjectWorker(ctx, c, root, executable, store)
		if err != nil {
			t.Fatal(err)
		}
		var diagnostics diagnosticBuffer
		w.CreateDriver = func(lifetime context.Context) (Driver, error) {
			return NewChrome(lifetime, ChromeConfig{Executable: executable, ProfileDirectory: filepath.Join(root, "profile"), Policy: NetworkPolicy{Origins: c.Origins}, testOptions: []chromedp.ExecAllocatorOption{
				chromedp.CombinedOutput(&diagnostics), chromedp.Flag("proxy-server", false), chromedp.Flag("ignore-certificate-errors", true), chromedp.Flag("host-resolver-rules", "MAP fixture.test "+strings.TrimPrefix(site.URL, "https://")),
			}})
		}
		if err = w.Initialize(ctx); err != nil {
			t.Fatal("Chromium initialization", err, diagnostics.String())
		}
		checkpoint := w.checkpoint
		w.checkpoint = func(ctx context.Context, session []byte) error {
			err := checkpoint(ctx, session)
			if err != nil {
				// Only this synthetic test profile is inspected; no file contents,
				// cookies, real owner profiles or symlink targets are logged.
				filepath.WalkDir(filepath.Join(root, "profile"), func(path string, entry fs.DirEntry, walkErr error) error {
					if walkErr != nil {
						return walkErr
					}
					info, statErr := entry.Info()
					if statErr != nil {
						return statErr
					}
					links := uint64(0)
					if stat, ok := info.Sys().(*syscall.Stat_t); ok {
						links = uint64(stat.Nlink)
					}
					if !(info.IsDir() || info.Mode().IsRegular()) || info.Mode().IsRegular() && links != 1 {
						rel, _ := filepath.Rel(root, path)
						t.Log("unsupported synthetic profile entry", rel, info.Mode().Type(), links)
					}
					return nil
				})
			}
			return err
		}
		return w
	}
	first := open(s, privateProfileRoot(t))
	defer first.Close(context.Background())
	var run [16]byte
	if _, err := rand.Read(run[:]); err != nil {
		t.Fatal("proof run identity")
	}
	id := hex.EncodeToString(run[:])
	savedText := "object-checkpoint-" + id
	op := Principal{Owner: "alice", Audience: audience, Scope: "credential.write", ID: "operator-" + id, Expires: time.Now().Add(time.Minute).Unix()}
	if err := first.putCredential(ctx, op, CookieCredential{Name: "operator", Origin: "https://fixture.test", CookieName: "__Host-operator", Value: "synthetic-operator-secret"}); err != nil {
		t.Fatal(err)
	}
	p, req := remoteRequest()
	p.Audience = audience
	p.ID = "profile-" + id
	req.ID = p.ID
	req.Code = `await browser.navigate({url:"https://fixture.test/login"});await browser.fill({selector:"#name",text:"` + savedText + `"});return await browser.click({selector:"#save"});`
	result, err := first.Execute(ctx, p, req)
	if err != nil || !strings.Contains(string(result.Value), savedText) {
		t.Fatal("first browser task", err)
	}
	probe, err := first.driver.(privateBrowserSession).exportSession(ctx)
	clear(probe)
	if err != nil {
		t.Fatal("private session capture", err)
	}
	if err = first.Close(ctx); err != nil {
		t.Fatal("clean browser checkpoint", err)
	}
	sessionSeen.Store(false)
	persistentSeen.Store(false)
	operatorSeen.Store(false)
	second := open(reopen(), privateProfileRoot(t))
	defer second.Close(context.Background())
	p.ID += "-restart"
	req = ExecuteRequest{ID: p.ID, Code: `return await browser.navigate({url:"https://fixture.test/"});`}
	result, err = second.Execute(ctx, p, req)
	if err != nil || !strings.Contains(string(result.Value), savedText) || strings.Contains(string(result.Value), "synthetic-site-") || strings.Contains(string(result.Value), "synthetic-operator-secret") {
		t.Fatal("browser profile recovery", err)
	}
	if !sessionSeen.Load() || !persistentSeen.Load() || !operatorSeen.Load() {
		t.Fatal("authentication state not recovered", sessionSeen.Load(), persistentSeen.Load(), operatorSeen.Load())
	}
	if err = second.Close(ctx); err != nil {
		t.Fatal("second checkpoint", err)
	}
}
