package browser

import (
	"context"
	"encoding/json"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func agentFixture(t *testing.T) (*AgentBroker, Principal, AgentStep, *atomic.Int32) {
	t.Helper()
	store := testStore(t)
	a := &AgentBroker{Owner: "alice", Audience: "worker", InferenceKey: "synthetic-private-inference-key", Store: store}
	p := Principal{Owner: "alice", Audience: "worker", Scope: "agent", ID: "run-one", Expires: time.Now().Add(time.Minute).Unix()}
	start := json.RawMessage(`{"tenantId":"alice","sessionId":"chat","prompt":"Synthetic task","role":"concierge","tools":[],"memory":{},"inference":"tinfoil","sandbox":false}`)
	launches := &atomic.Int32{}
	a.launch = func(ctx context.Context, raw json.RawMessage) (*agentProcess, error) {
		launches.Add(1)
		var bootstrap struct {
			Bound struct {
				InferenceKey string `json:"inferenceKey"`
			} `json:"bound"`
		}
		if json.Unmarshal(raw, &bootstrap) != nil || bootstrap.Bound.InferenceKey != a.InferenceKey {
			t.Fatal("missing private bootstrap")
		}
		events := make(chan json.RawMessage, 2)
		done := make(chan error, 1)
		events <- json.RawMessage(`{"tool":{"id":"1","operation":"browser.exec","args":{"code":"return browser.snapshot();"},"callId":"synthetic"}}`)
		return &agentProcess{events: events, done: done, stop: func() {}, send: func(v any) error {
			b, _ := json.Marshal(v)
			var message struct {
				Result struct {
					ID    string          `json:"id"`
					Value json.RawMessage `json:"value"`
				} `json:"toolResult"`
			}
			if json.Unmarshal(b, &message) != nil || message.Result.ID != "1" || string(message.Result.Value) != `{"ok":true}` {
				return ErrDenied
			}
			events <- json.RawMessage(`{"boundResult":{"text":"Synthetic result","toolCalls":1,"continue":false}}`)
			done <- nil
			return nil
		}}, nil
	}
	t.Cleanup(a.Close)
	return a, p, AgentStep{ID: p.ID, Start: start}, launches
}

func verifyPackagedPiTurn(t *testing.T, ctx context.Context, a *AgentBroker, p Principal, start AgentStep, driver Driver, turn string) {
	t.Helper()
	start.ID = "packaged-" + strings.ToLower(turn)
	p.ID = start.ID
	start.Start = json.RawMessage(`{"tenantId":"alice","sessionId":"container-proof","prompt":"` + turn + ` acceptance turn","role":"concierge","tools":[{"name":"browser.exec","description":"Read the current browser page with JavaScript; return await browser.snapshot();","parameters":{"type":"object","properties":{"code":{"type":"string"}},"required":["code"],"additionalProperties":false}}],"memory":{},"inference":"tinfoil","sandbox":false}`)
	step := start
	finished := false
	tools := 0
	for count := 0; count < 12; count++ {
		event, err := a.Step(ctx, p, step)
		if err != nil {
			t.Fatal("packaged Pi step", err)
		}
		step = AgentStep{ID: p.ID, Ack: event.Sequence}
		var message struct {
			Tool *struct {
				ID        string `json:"id"`
				Operation string `json:"operation"`
				Args      struct {
					Code string `json:"code"`
				} `json:"args"`
			} `json:"tool"`
			Result json.RawMessage `json:"boundResult"`
			Error  string          `json:"error"`
		}
		if json.Unmarshal(event.Message, &message) != nil || message.Error != "" {
			t.Fatal("packaged Pi failed")
		}
		if message.Tool != nil {
			tools++
			if tools > 1 || message.Tool.Operation != "browser.exec" {
				t.Fatal("unexpected packaged tool")
			}
			result, err := (&Sandbox{Safety: StubSafety{Policy: NetworkPolicy{Origins: []string{"https://fixture.test"}}}}).Execute(ctx, "alice", message.Tool.Args.Code, driver)
			if err != nil {
				t.Fatal("packaged browser action", err)
			}
			step.Reply, _ = json.Marshal(map[string]any{"id": message.Tool.ID, "value": result})
		}
		if len(message.Result) > 0 {
			if !strings.Contains(string(message.Result), "Synthetic browser answer") || tools != 1 {
				t.Fatal("packaged Pi result unavailable")
			}
			finished = true
			break
		}
	}
	if !finished {
		t.Fatal("packaged Pi did not complete")
	}
}
