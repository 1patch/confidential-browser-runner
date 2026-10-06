package browser

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/chromedp/cdproto/network"
)

func sessionCookie() *network.Cookie {
	return &network.Cookie{Name: "session", Value: "synthetic-login", Domain: "login.example.com", Path: "/", Session: true, Secure: true, HTTPOnly: true, SourceScheme: network.CookieSourceSchemeSecure, SourcePort: 443}
}

func TestSessionCookiePreservesScope(t *testing.T) {
	policy := NetworkPolicy{Origins: []string{"https://login.example.com", "https://other.example.net"}}
	c := sessionCookie()
	p, err := cookieParameters(c, policy)
	if err != nil || p.Domain != "" || p.URL != "https://login.example.com/" || !p.HTTPOnly || !p.Secure || p.Value != c.Value {
		t.Fatal("host-only cookie broadened or changed", err)
	}
	c.Domain = ".example.com"
	c.Path = "/account"
	c.PartitionKey = &network.CookiePartitionKey{TopLevelSite: "https://example.net", HasCrossSiteAncestor: true}
	p, err = cookieParameters(c, policy)
	if err != nil || p.Domain != ".example.com" || p.Path != "/account" || p.PartitionKey != c.PartitionKey {
		t.Fatal("domain or partition scope changed", err)
	}
}

func TestSessionCookieRejectsForeignOrMalformedScope(t *testing.T) {
	policy := NetworkPolicy{Origins: []string{"https://login.example.com"}}
	for _, mutate := range []func(*network.Cookie){
		func(c *network.Cookie) { c.Domain = "other.example.com" },
		func(c *network.Cookie) { c.Domain = ".attacker.example" },
		func(c *network.Cookie) { c.Domain = ".com" },
		func(c *network.Cookie) { c.Domain = "LOGIN.example.com" },
		func(c *network.Cookie) { c.Path = "relative" },
		func(c *network.Cookie) { c.Value = "header\r\ninjection" },
		func(c *network.Cookie) { c.Name = strings.Repeat("x", 257) },
		func(c *network.Cookie) { c.Session = false },
		func(c *network.Cookie) { c.SourceScheme = network.CookieSourceSchemeNonSecure },
		func(c *network.Cookie) { c.SourcePort = 8080 },
		func(c *network.Cookie) { c.PartitionKeyOpaque = true },
		func(c *network.Cookie) {
			c.PartitionKey = &network.CookiePartitionKey{TopLevelSite: "https://attacker.example"}
		},
		func(c *network.Cookie) {
			c.PartitionKey = &network.CookiePartitionKey{TopLevelSite: "http://example.com"}
		},
		func(c *network.Cookie) { c.PartitionKey = &network.CookiePartitionKey{TopLevelSite: "https://com"} },
		func(c *network.Cookie) {
			c.PartitionKey = &network.CookiePartitionKey{TopLevelSite: "https://login.example.com"}
		},
		func(c *network.Cookie) {
			c.PartitionKey = &network.CookiePartitionKey{TopLevelSite: "https://example.com/"}
		},
	} {
		c := sessionCookie()
		mutate(c)
		if _, err := cookieParameters(c, policy); err == nil {
			t.Fatal("unsafe session cookie accepted")
		}
	}
	if _, err := cookieParameters(nil, policy); err == nil {
		t.Fatal("nil cookie accepted")
	}
}

type sessionDriver struct {
	recordingDriver
	steps                           []string
	exportErr, closeErr, restoreErr error
	plaintext                       []byte
}

func (d *sessionDriver) exportSession(context.Context) ([]byte, error) {
	d.steps = append(d.steps, "capture")
	d.plaintext = []byte("synthetic-private-session")
	return d.plaintext, d.exportErr
}
func (d *sessionDriver) restoreSession(context.Context, []byte) error {
	d.steps = append(d.steps, "restore")
	return d.restoreErr
}
func (d *sessionDriver) Close(context.Context) error {
	d.steps = append(d.steps, "close")
	return d.closeErr
}

func TestSessionCheckpointOnlyAfterCaptureAndCleanClose(t *testing.T) {
	for _, fault := range []string{"none", "capture", "close", "save"} {
		t.Run(fault, func(t *testing.T) {
			d := &sessionDriver{}
			if fault == "capture" {
				d.exportErr = ErrUnavailable
			}
			if fault == "close" {
				d.closeErr = ErrUnavailable
			}
			w := &Worker{driver: d, checkpoint: func(_ context.Context, session []byte) error {
				d.steps = append(d.steps, "save")
				if string(session) != "synthetic-private-session" {
					t.Fatal("session was lost before encryption")
				}
				if fault == "save" {
					return ErrUnavailable
				}
				return nil
			}}
			err := w.Close(context.Background())
			if (err == nil) != (fault == "none") {
				t.Fatal("close result", err)
			}
			expected := "capture,close"
			if fault == "none" || fault == "save" {
				expected += ",save"
			}
			if strings.Join(d.steps, ",") != expected {
				t.Fatal("unsafe checkpoint order", d.steps)
			}
			for _, b := range d.plaintext {
				if b != 0 {
					t.Fatal("session scratch buffer retained")
				}
			}
			if again := w.Close(context.Background()); !errors.Is(again, err) || strings.Join(d.steps, ",") != expected {
				t.Fatal("close retried or changed outcome", again)
			}
		})
	}
}

func TestSessionRestoreFailureCannotStartWithoutLoginState(t *testing.T) {
	s, _, _ := testRemoteStore(t)
	d := &sessionDriver{restoreErr: ErrDenied}
	w := &Worker{Owner: "alice", Store: s, restoreSession: []byte("synthetic-private-session"), CreateDriver: func(context.Context) (Driver, error) { return d, nil }}
	if err := w.Initialize(context.Background()); err == nil {
		t.Fatal("failed restore accepted")
	}
	if err := w.Initialize(context.Background()); err == nil || strings.Join(d.steps, ",") != "restore,close" {
		t.Fatal("failed session restore bypassed", err, d.steps)
	}
	if !errors.Is(w.Close(context.Background()), ErrUncertain) {
		t.Fatal("failed restore marked clean")
	}
}
