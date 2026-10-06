package browser

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net"
	"os"
	"os/exec"
	"regexp"
	"sync"
	"syscall"
	"time"
)

type agentRecord struct {
	Hash  string `json:"hash"`
	State string `json:"state"`
}
type agentProcess struct {
	events  <-chan json.RawMessage
	done    <-chan error
	exited  <-chan struct{}
	exitErr error // written before exited is closed
	send    func(any) error
	stop    func()
}
type agentRun struct {
	id       string
	hash     string
	sequence uint64
	pending  json.RawMessage
	process  *agentProcess
	expiry   *time.Timer
}

// AgentBroker supervises trusted Pi image code. Its IPC and inference key are
// never exposed as model tools. There is one active Pi turn per owner VM.
// The existing browser action path retains its independent WASM/action bounds.
type AgentBroker struct {
	Owner        string
	Audience     string
	InferenceKey string
	Store        *SealedStore
	mu           sync.Mutex
	active       *agentRun
	processes    []*agentProcess
	checkpoint   bool
	closed       bool
	launch       func(context.Context, json.RawMessage) (*agentProcess, error) // tests only
}

func (a *AgentBroker) Close() {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.closed = true
	if a.active != nil {
		a.active.expiry.Stop()
		a.active.process.stop()
	}
}

// Quiesce confirms every launched child has exited before persistent state is
// archived. A cancelled/expired turn may have detached from active already.
func (a *AgentBroker) Quiesce(ctx context.Context) error {
	a.Close()
	a.mu.Lock()
	processes := append([]*agentProcess(nil), a.processes...)
	interrupted := a.active != nil
	a.mu.Unlock()
	for _, process := range processes {
		process.stop()
	}
	for _, process := range processes {
		if process.exited == nil {
			return ErrUncertain
		}
		select {
		case <-process.exited:
			if process.exitErr != nil {
				interrupted = true
			}
		case <-ctx.Done():
			return ErrUncertain
		}
	}
	if interrupted {
		return ErrUncertain
	}
	return nil
}

func (a *AgentBroker) start(p Principal, req AgentStep) error {
	if len(req.Start) == 0 || len(req.Start) > 1<<20 || req.Ack != 0 || len(req.Reply) != 0 || req.Cancel || req.Heartbeat || a.active != nil {
		return ErrDenied
	}
	if a.checkpoint {
		for _, process := range a.processes {
			if process.exited == nil {
				return ErrUncertain
			}
			select {
			case <-process.exited:
				if process.exitErr != nil {
					return ErrUncertain
				}
			default:
				return ErrUnavailable
			}
		}
		a.processes = nil
	}
	var bound map[string]json.RawMessage
	if json.Unmarshal(req.Start, &bound) != nil {
		return ErrInvalid
	}
	allowed := map[string]bool{"tenantId": true, "sessionId": true, "prompt": true, "role": true, "tools": true, "memory": true, "inference": true, "sandbox": true, "projectCheckout": true, "continuation": true, "notification": true, "diagnostics": true, "messageContext": true}
	for key := range bound {
		if !allowed[key] {
			return ErrDenied
		}
	}
	var tenant, session, prompt, role, inference string
	if json.Unmarshal(bound["tenantId"], &tenant) != nil || tenant != a.Owner ||
		json.Unmarshal(bound["sessionId"], &session) != nil || !regexp.MustCompile(`^[a-z0-9-]{1,100}$`).MatchString(session) ||
		json.Unmarshal(bound["prompt"], &prompt) != nil || len(prompt) == 0 || len(prompt) > 64000 ||
		json.Unmarshal(bound["role"], &role) != nil || (role != "concierge" && role != "worker") ||
		json.Unmarshal(bound["inference"], &inference) != nil || inference != "tinfoil" {
		return ErrDenied
	}
	if _, e := a.Store.Get(a.Owner, "agent-run", req.ID); !errors.Is(e, os.ErrNotExist) {
		return ErrUncertain
	}
	sum := sha256.Sum256(req.Start)
	hash := hex.EncodeToString(sum[:])
	marker, _ := json.Marshal(agentRecord{Hash: hash, State: "pending"})
	if a.Store.Put(a.Owner, "agent-run", req.ID, marker) != nil {
		return ErrUnavailable
	}
	bound["inferenceKey"], _ = json.Marshal(a.InferenceKey)
	raw, _ := json.Marshal(map[string]any{"bound": bound})
	// The browser is already warm. Cover an eight-minute worker slice plus
	// one eleven-minute cold start of its separately isolated Bash machine.
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
	launch := a.launch
	if launch == nil {
		launch = launchAgent
	}
	process, err := launch(ctx, raw)
	clear(raw)
	if err != nil {
		cancel()
		return ErrUncertain
	}
	stop := process.stop
	process.stop = func() { cancel(); stop() }
	if a.checkpoint {
		a.processes = append(a.processes, process)
		if process.exited == nil {
			process.stop()
			return ErrUncertain
		}
	}
	run := &agentRun{id: req.ID, hash: hash, process: process}
	a.active = run
	run.expiry = time.AfterFunc(time.Until(time.Unix(p.Expires, 0)), func() {
		process.stop()
		a.mu.Lock()
		defer a.mu.Unlock()
		if a.active == run {
			a.active = nil
		}
	})
	return nil
}

// Step requires fresh signed authority for every poll and tool response. A lost
// response is never retried automatically: the durable marker prevents restarting
// a turn whose model/tool effects may already have happened.
func (a *AgentBroker) Step(ctx context.Context, p Principal, req AgentStep) (AgentEvent, error) {
	var zero AgentEvent
	if p.Owner != a.Owner || p.Audience != a.Audience || p.Scope != "agent" || p.ID != req.ID || !identifier.MatchString(req.ID) || p.Expires <= time.Now().Unix() || a.Store == nil || a.InferenceKey == "" {
		return zero, ErrDenied
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.closed || ctx.Err() != nil || p.Expires <= time.Now().Unix() {
		return zero, ErrDenied
	}
	if len(req.Start) > 0 {
		if e := a.start(p, req); e != nil {
			return zero, e
		}
	}
	r := a.active
	if r == nil || r.id != req.ID {
		return zero, ErrUncertain
	}
	if req.Cancel {
		r.expiry.Stop()
		r.process.stop()
		a.active = nil
		return AgentEvent{Sequence: r.sequence, Message: json.RawMessage(`{"error":"Agent cancelled; prior effects may have completed"}`)}, nil
	}
	if req.Ack != r.sequence {
		return zero, ErrDenied
	}
	r.expiry.Reset(time.Until(time.Unix(p.Expires, 0)))
	if req.Heartbeat {
		if len(req.Start) != 0 || len(req.Reply) != 0 {
			return zero, ErrDenied
		}
		return AgentEvent{Sequence: r.sequence, Message: json.RawMessage(`null`)}, nil
	}
	if len(r.pending) > 0 {
		var pending struct {
			Tool *struct {
				ID string `json:"id"`
			} `json:"tool"`
		}
		if json.Unmarshal(r.pending, &pending) != nil {
			return zero, ErrUncertain
		}
		if pending.Tool != nil {
			var reply struct {
				ID    string          `json:"id"`
				Value json.RawMessage `json:"value,omitempty"`
				Error string          `json:"error,omitempty"`
			}
			dec := json.NewDecoder(bytes.NewReader(req.Reply))
			dec.DisallowUnknownFields()
			if len(req.Reply) > MaxAgentMessage || dec.Decode(&reply) != nil || dec.Decode(new(any)) != io.EOF || reply.ID != pending.Tool.ID || (len(reply.Value) == 0 && reply.Error == "") || len(reply.Error) > 500 {
				return zero, ErrDenied
			}
			if r.process.send(map[string]any{"toolResult": reply}) != nil {
				return zero, ErrUncertain
			}
		} else if len(req.Reply) > 0 {
			return zero, ErrDenied
		}
		r.pending = nil
	} else if len(req.Reply) > 0 {
		return zero, ErrDenied
	}
	timer := time.NewTimer(20 * time.Second)
	defer timer.Stop()
	select {
	case message, ok := <-r.process.events:
		if !ok {
			r.expiry.Stop()
			r.process.stop()
			a.active = nil
			return zero, ErrUncertain
		}
		if p.Expires <= time.Now().Unix() {
			return zero, ErrDenied
		}
		r.sequence++
		r.pending = message
		var terminal struct {
			Result json.RawMessage `json:"boundResult"`
			Error  string          `json:"error"`
		}
		if json.Unmarshal(message, &terminal) != nil {
			return zero, ErrUncertain
		}
		if len(terminal.Result) > 0 || terminal.Error != "" {
			select {
			case err := <-r.process.done:
				if err != nil && len(terminal.Result) > 0 {
					return zero, ErrUncertain
				}
			case <-ctx.Done():
				return zero, ErrUncertain
			case <-time.After(5 * time.Second):
				r.process.stop()
				return zero, ErrUncertain
			}
			r.expiry.Stop()
			r.process.stop()
			a.active = nil
			marker, _ := json.Marshal(agentRecord{Hash: r.hash, State: "complete"})
			if a.Store.Put(a.Owner, "agent-run", req.ID, marker) != nil {
				return zero, ErrUncertain
			}
		}
		return AgentEvent{Sequence: r.sequence, Message: message}, nil
	case <-ctx.Done():
		return zero, ErrUncertain
	case <-timer.C:
		return AgentEvent{Sequence: r.sequence, Message: json.RawMessage(`null`)}, nil
	}
}

// Node's ordinary JSON IPC channel is a private Unix socket. The executable,
// bundle and environment are fixed; no model source is passed to Node or a shell.
func launchAgent(ctx context.Context, bootstrap json.RawMessage) (*agentProcess, error) {
	cmd := exec.CommandContext(ctx, "/usr/local/bin/node", "/opt/sure-agent/confidential-agent-process.mjs")
	cmd.Dir = "/opt/sure-agent"
	cmd.Env = []string{"HOME=/workspace/pi", "PATH=", "NODE_ENV=production", "PI_PACKAGE_DIR=/opt/sure-agent/node_modules/@earendil-works/pi-coding-agent"}
	return launchAgentProcess(ctx, bootstrap, cmd)
}

func launchObjectAgent(ctx context.Context, bootstrap json.RawMessage) (*agentProcess, error) {
	cmd := exec.CommandContext(ctx, "/usr/local/bin/node", "/opt/sure-agent/confidential-object-agent-process.mjs")
	cmd.Dir = "/opt/sure-agent"
	cmd.Env = []string{"HOME=/workspace/profile/.sure-agent", "PATH=", "NODE_ENV=production", "PI_PACKAGE_DIR=/opt/sure-agent/node_modules/@earendil-works/pi-coding-agent"}
	return launchAgentProcess(ctx, bootstrap, cmd)
}

func launchAgentProcess(ctx context.Context, bootstrap json.RawMessage, cmd *exec.Cmd) (*agentProcess, error) {
	fds, err := syscall.Socketpair(syscall.AF_UNIX, syscall.SOCK_STREAM, 0)
	if err != nil {
		return nil, ErrUnavailable
	}
	syscall.CloseOnExec(fds[0])
	syscall.CloseOnExec(fds[1])
	parent := os.NewFile(uintptr(fds[0]), "pi-parent")
	child := os.NewFile(uintptr(fds[1]), "pi-child")
	defer parent.Close()
	defer child.Close()
	conn, err := net.FileConn(parent)
	if err != nil {
		return nil, ErrUnavailable
	}
	cmd.Env = append(cmd.Env, "NODE_CHANNEL_FD=3", "NODE_CHANNEL_SERIALIZATION_MODE=json")
	cmd.ExtraFiles = []*os.File{child}
	cmd.Stdout = io.Discard
	cmd.Stderr = io.Discard
	if cmd.Start() != nil {
		conn.Close()
		return nil, ErrUnavailable
	}
	events := make(chan json.RawMessage, 1)
	done := make(chan error, 1)
	exited := make(chan struct{})
	var stopOnce sync.Once
	stop := func() { stopOnce.Do(func() { conn.Close(); _ = cmd.Process.Kill() }) }
	var writeMu sync.Mutex
	send := func(v any) error {
		writeMu.Lock()
		defer writeMu.Unlock()
		conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
		return json.NewEncoder(conn).Encode(v)
	}
	if send(bootstrap) != nil {
		stop()
		_ = cmd.Wait()
		return nil, ErrUnavailable
	}
	process := &agentProcess{events: events, done: done, exited: exited, send: send, stop: stop}
	go func() {
		defer close(events)
		scanner := bufio.NewScanner(conn)
		scanner.Buffer(make([]byte, 4096), MaxAgentMessage+1)
		total := 0
		count := 0
		for scanner.Scan() {
			raw := append(json.RawMessage(nil), scanner.Bytes()...)
			total += len(raw)
			count++
			if total > 64<<20 || count > 2048 || !json.Valid(raw) {
				stop()
				break
			}
			select {
			case events <- raw:
			case <-ctx.Done():
				stop()
			}
		}
		// Wait only after draining IPC; the child's final process.send callback exits.
		err := cmd.Wait()
		conn.Close()
		process.exitErr = err
		close(exited)
		done <- err
	}()
	return process, nil
}
