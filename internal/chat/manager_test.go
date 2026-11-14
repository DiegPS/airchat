package chat

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

type recorded struct {
	event   string
	payload any
}

type recorder struct {
	mu     sync.Mutex
	events []recorded
}

func (r *recorder) Emit(event string, payload any) {
	r.mu.Lock()
	r.events = append(r.events, recorded{event, payload})
	r.mu.Unlock()
}

func (r *recorder) names() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]string, len(r.events))
	for i, e := range r.events {
		out[i] = e.event
	}
	return out
}

func (r *recorder) count(event string) int {
	n := 0
	for _, name := range r.names() {
		if name == event {
			n++
		}
	}
	return n
}

var testEvents = Events{Started: "x_started", Ended: "x_ended", Error: "x_error"}

// fakeSession blocks in Run until released, then returns runErr.
type fakeSession struct {
	sink    Sink
	release chan struct{}
	once    sync.Once
	runErr  error
	panics  bool
	closed  chan struct{}
}

func newFakeSession(sink Sink) *fakeSession {
	return &fakeSession{sink: sink, release: make(chan struct{}), closed: make(chan struct{})}
}

func (f *fakeSession) Run(ctx context.Context) error {
	f.sink.Started("hello")
	if f.panics {
		panic("boom")
	}
	select {
	case <-ctx.Done():
	case <-f.release:
	}
	return f.runErr
}

func (f *fakeSession) Close() { f.once.Do(func() { close(f.closed) }) }

type fakeConnector struct {
	mu       sync.Mutex
	sessions []*fakeSession
	failWith error
	setup    func(*fakeSession)
}

func (c *fakeConnector) Events() Events { return testEvents }

func (c *fakeConnector) Connect(_ context.Context, _ string, sink Sink) (Session, error) {
	if c.failWith != nil {
		return nil, c.failWith
	}
	s := newFakeSession(sink)
	if c.setup != nil {
		c.setup(s)
	}
	c.mu.Lock()
	c.sessions = append(c.sessions, s)
	c.mu.Unlock()
	return s, nil
}

func waitFor(t *testing.T, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatal("condition not reached in time")
}

func TestStartEmitsStartedAndStopEmitsEndedOnce(t *testing.T) {
	rec := &recorder{}
	conn := &fakeConnector{}
	m := NewManager(conn, rec)

	if err := m.Start(context.Background(), "chan"); err != nil {
		t.Fatal(err)
	}
	waitFor(t, func() bool { return rec.count("x_started") == 1 })

	m.Stop()
	m.Stop() // second stop is a no-op
	waitFor(t, func() bool { return rec.count("x_ended") == 1 })

	<-conn.sessions[0].closed
	time.Sleep(20 * time.Millisecond)
	if got := rec.count("x_ended"); got != 1 {
		t.Fatalf("x_ended emitted %d times, want 1", got)
	}
	if got := rec.count("x_error"); got != 0 {
		t.Fatalf("unexpected error events: %d", got)
	}
}

func TestReplacedSessionIsSilent(t *testing.T) {
	rec := &recorder{}
	conn := &fakeConnector{}
	m := NewManager(conn, rec)

	if err := m.Start(context.Background(), "a"); err != nil {
		t.Fatal(err)
	}
	waitFor(t, func() bool { return rec.count("x_started") == 1 })
	first := conn.sessions[0]
	first.runErr = errors.New("late failure of the old session")

	if err := m.Start(context.Background(), "b"); err != nil {
		t.Fatal(err)
	}
	<-first.closed // old session was shut down
	waitFor(t, func() bool { return rec.count("x_started") == 2 })
	time.Sleep(30 * time.Millisecond)

	if got := rec.count("x_ended"); got != 0 {
		t.Fatalf("replaced session emitted x_ended %d times", got)
	}
	if got := rec.count("x_error"); got != 0 {
		t.Fatalf("replaced session emitted x_error %d times", got)
	}
	m.Stop()
}

func TestFailedConnectKeepsCurrentSession(t *testing.T) {
	rec := &recorder{}
	conn := &fakeConnector{}
	m := NewManager(conn, rec)

	if err := m.Start(context.Background(), "a"); err != nil {
		t.Fatal(err)
	}
	waitFor(t, func() bool { return rec.count("x_started") == 1 })

	conn.failWith = errors.New("nope")
	if err := m.Start(context.Background(), "b"); err == nil {
		t.Fatal("expected connect error")
	}
	select {
	case <-conn.sessions[0].closed:
		t.Fatal("current session was closed by a failed Start")
	case <-time.After(30 * time.Millisecond):
	}
	m.Stop()
}

func TestRunErrorIsReportedThenEnded(t *testing.T) {
	rec := &recorder{}
	conn := &fakeConnector{setup: func(s *fakeSession) {
		s.runErr = errors.New("connection lost")
		close(s.release)
	}}
	m := NewManager(conn, rec)

	if err := m.Start(context.Background(), "a"); err != nil {
		t.Fatal(err)
	}
	waitFor(t, func() bool { return rec.count("x_ended") == 1 })
	if got := rec.count("x_error"); got != 1 {
		t.Fatalf("x_error = %d, want 1", got)
	}
}

func TestErrorAfterIntentionalStopIsSuppressed(t *testing.T) {
	rec := &recorder{}
	conn := &fakeConnector{setup: func(s *fakeSession) { s.runErr = errors.New("closed by us") }}
	m := NewManager(conn, rec)

	if err := m.Start(context.Background(), "a"); err != nil {
		t.Fatal(err)
	}
	waitFor(t, func() bool { return rec.count("x_started") == 1 })
	m.Stop()
	waitFor(t, func() bool { return rec.count("x_ended") == 1 })
	if got := rec.count("x_error"); got != 0 {
		t.Fatalf("x_error = %d after intentional stop, want 0", got)
	}
}

func TestPanicBecomesErrorEvent(t *testing.T) {
	rec := &recorder{}
	conn := &fakeConnector{setup: func(s *fakeSession) { s.panics = true }}
	m := NewManager(conn, rec)

	if err := m.Start(context.Background(), "a"); err != nil {
		t.Fatal(err)
	}
	waitFor(t, func() bool { return rec.count("x_ended") == 1 })
	if got := rec.count("x_error"); got != 1 {
		t.Fatalf("x_error = %d, want 1", got)
	}
}

func TestSinkDropsMessagesAfterStop(t *testing.T) {
	rec := &recorder{}
	conn := &fakeConnector{}
	m := NewManager(conn, rec)

	if err := m.Start(context.Background(), "a"); err != nil {
		t.Fatal(err)
	}
	waitFor(t, func() bool { return rec.count("x_started") == 1 })
	m.Stop()
	conn.sessions[0].sink.Message(Message{ID: "late"})
	if got := rec.count(EventMessage); got != 0 {
		t.Fatalf("message delivered after stop: %d", got)
	}
}
