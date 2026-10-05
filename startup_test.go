package browser

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"
)

func TestBootFailureDiagnosticsStayFiniteAndQuarantined(t *testing.T) {
	const secret = "synthetic-private-path-and-credential"
	for _, item := range []struct {
		name, code string
		err        error
	}{
		{"raw-error", "initialization", errors.New(secret)},
		{"unknown-stage", "initialization", startupFailure(secret, ErrDenied)},
		{"storage", "storage-identity", startupFailure("storage-identity", errors.New(secret))},
		{"namespace", "chromium-namespace", chromeLaunchFailure(errors.New("Failed to move to new namespace: " + secret))},
		{"timeout", "chromium-launch-timeout", chromeLaunchFailure(context.DeadlineExceeded)},
		{"sandbox", "chromium-sandbox", startupFailure("chromium-launch", startupFailure("chromium-sandbox", ErrDenied))},
	} {
		t.Run(item.name, func(t *testing.T) {
			f := newBootFixture(t, context.Background())
			f.gate.create = func(context.Context, ObjectBootstrap) (*Worker, error) { f.calls.Add(1); return nil, item.err }
			token := bootToken(t, f)
			if bootPost(f.gate, context.Background(), token, f.raw).Code != http.StatusAccepted {
				t.Fatal("bootstrap not accepted")
			}
			awaitBoot(t, f.gate)
			status := bootStatus(t, f.gate)
			if status.State != "failed" || status.Failure != item.code {
				t.Fatal("incorrect failure category")
			}
			raw, _ := json.Marshal(status)
			if strings.Contains(string(raw), secret) {
				t.Fatal("private diagnostic leaked")
			}
			if bootPost(f.gate, context.Background(), token, f.raw).Code != http.StatusConflict || f.calls.Load() != 1 {
				t.Fatal("failed bootstrap retried")
			}
		})
	}
	if !errors.Is(startupFailure("profile-open", ErrUncertain), ErrUncertain) {
		t.Fatal("startup wrapper lost uncertainty")
	}
}
