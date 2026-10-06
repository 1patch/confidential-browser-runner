package browser

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

func objectAgentFixture(t *testing.T) (*Worker, *AgentBroker, *testBlobBackend, []byte, string, Bootstrap) {
	t.Helper()
	store, backing, key := profileFixture(t)
	root := privateProfileRoot(t)
	c := testBootstrap(t, "alice")
	c.Audience = "worker"
	c.StorageKey = base64.StdEncoding.EncodeToString(key)
	c.InferenceKey = "synthetic-private-inference"
	w, e := newObjectAgentWorker(context.Background(), c, root, "unused", store)
	if e != nil {
		t.Fatal(e)
	}
	w.CreateDriver = func(ctx context.Context) (Driver, error) {
		return &objectAgentFixtureDriver{lifetime: ctx}, nil
	}
	if e = w.Initialize(context.Background()); e != nil {
		t.Fatal(e)
	}
	return w, w.Agent.(*AgentBroker), backing, key, root, c
}

func TestObjectAgentRealChildCheckpointSurvivesLocalLossWithoutReplay(t *testing.T) {
	node, e := exec.LookPath("node")
	if e != nil {
		t.Skip("Node required")
	}
	w, a, backing, key, root, c := objectAgentFixture(t)
	path := filepath.Join(root, "profile", ".sure-agent", "session.jsonl")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	a.launch = func(ctx context.Context, raw json.RawMessage) (*agentProcess, error) {
		cmd := exec.CommandContext(ctx, node, "--input-type=module", "-e", `import{mkdirSync,writeFileSync}from'node:fs';import{dirname}from'node:path';process.once('message',m=>{if(m.bound.inferenceKey!=='synthetic-private-inference')process.exit(2);mkdirSync(dirname(process.argv[1]),{recursive:true,mode:448});writeFileSync(process.argv[1],'synthetic saved Pi session\n',{mode:384});process.send({boundResult:{text:'done'}},()=>process.exit(0));});`, path)
		cmd.Env = []string{"PATH="}
		return launchAgentProcess(ctx, raw, cmd)
	}
	p := Principal{Owner: "alice", Audience: "worker", Scope: "agent", ID: "complete-agent-turn", Expires: time.Now().Add(time.Minute).Unix()}
	start := AgentStep{ID: p.ID, Start: json.RawMessage(`{"tenantId":"alice","sessionId":"chat","prompt":"Synthetic task","role":"concierge","tools":[],"memory":{},"inference":"tinfoil","sandbox":false}`)}
	if _, e = a.Step(ctx, p, start); e != nil {
		t.Fatal(e)
	}
	if e = w.Close(ctx); e != nil {
		t.Fatal("confirmed child could not checkpoint", e)
	}
	for _, blob := range backing.objects {
		if bytes.Contains(blob.data, []byte("synthetic saved Pi session")) || bytes.Contains(blob.data, []byte(c.InferenceKey)) {
			t.Fatal("Pi plaintext outside encryption")
		}
	}
	store := reopenProfileStore(t, backing, key)
	freshRoot := privateProfileRoot(t)
	fresh, e := newObjectAgentWorker(ctx, c, freshRoot, "unused", store)
	if e != nil {
		t.Fatal(e)
	}
	raw, e := os.ReadFile(filepath.Join(freshRoot, "profile", ".sure-agent", "session.jsonl"))
	if e != nil || string(raw) != "synthetic saved Pi session\n" {
		t.Fatal("session was not recovered", e)
	}
	next := fresh.Agent.(*AgentBroker)
	next.launch = func(context.Context, json.RawMessage) (*agentProcess, error) {
		t.Fatal("replayed completed Pi turn")
		return nil, ErrDenied
	}
	if _, e = next.Step(ctx, p, start); !errors.Is(e, ErrUncertain) {
		t.Fatal("saved turn did not prevent replay", e)
	}
	next.Close()
}

func TestObjectAgentUnconfirmedExitNeverPublishesCheckpoint(t *testing.T) {
	w, a, backing, key, _, _ := objectAgentFixture(t)
	exited := make(chan struct{})
	stopped := make(chan struct{})
	var once sync.Once
	a.processes = []*agentProcess{{exited: exited, stop: func() { once.Do(func() { close(stopped) }) }}}
	ctx, cancel := context.WithCancel(context.Background())
	closed := make(chan error, 1)
	go func() { closed <- w.Close(ctx) }()
	<-stopped
	select {
	case <-closed:
		t.Fatal("checkpoint did not await child exit")
	default:
	}
	cancel()
	if e := <-closed; !errors.Is(e, ErrUncertain) {
		t.Fatal("unknown child exit was reusable", e)
	}
	close(exited)
	store := reopenProfileStore(t, backing, key)
	if _, e := openProfile(context.Background(), store, "alice", privateProfileRoot(t)); !errors.Is(e, ErrUncertain) {
		t.Fatal("uncertain profile was recovered", e)
	}
}

func TestObjectAgentCancelledChildBlocksAnotherTurnAndCheckpoint(t *testing.T) {
	a, p, start, _ := agentFixture(t)
	a.checkpoint = true
	exited := make(chan struct{})
	events := make(chan json.RawMessage, 1)
	events <- json.RawMessage(`{"tool":{"id":"1"}}`)
	process := &agentProcess{events: events, done: make(chan error), exited: exited, stop: func() {}, send: func(any) error { return nil }}
	a.launch = func(context.Context, json.RawMessage) (*agentProcess, error) { return process, nil }
	if _, e := a.Step(context.Background(), p, start); e != nil {
		t.Fatal(e)
	}
	if _, e := a.Step(context.Background(), p, AgentStep{ID: p.ID, Cancel: true}); e != nil {
		t.Fatal(e)
	}
	p.ID = "new-turn"
	start.ID = p.ID
	if _, e := a.Step(context.Background(), p, start); !errors.Is(e, ErrUnavailable) {
		t.Fatal("started before prior child exited", e)
	}
	process.exitErr = ErrUncertain
	close(exited)
	if _, e := a.Step(context.Background(), p, start); !errors.Is(e, ErrUncertain) {
		t.Fatal("restarted after abnormal child exit", e)
	}
	if e := a.Quiesce(context.Background()); !errors.Is(e, ErrUncertain) {
		t.Fatal("abnormal child made reusable checkpoint", e)
	}
}

type objectAgentFixtureDriver struct{ lifetime context.Context }

func (d *objectAgentFixtureDriver) CurrentURL(context.Context, string) (string, error) {
	return "https://example.com", nil
}
func (d *objectAgentFixtureDriver) Do(context.Context, Action) (Observation, error) {
	return Observation{URL: "https://example.com"}, nil
}
func (d *objectAgentFixtureDriver) Close(context.Context) error {
	if d.lifetime.Err() != nil {
		return ErrUncertain
	}
	return nil
}
func (d *objectAgentFixtureDriver) exportSession(context.Context) ([]byte, error) {
	if d.lifetime.Err() != nil {
		return nil, ErrUncertain
	}
	return nil, nil
}
func (d *objectAgentFixtureDriver) restoreSession(context.Context, []byte) error { return nil }
