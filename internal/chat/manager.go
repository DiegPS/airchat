package chat

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
)

// Emitter delivers an event to the frontend.
type Emitter interface {
	Emit(event string, payload any)
}

// EmitterFunc adapts a function to Emitter.
type EmitterFunc func(event string, payload any)

// Emit implements Emitter.
func (f EmitterFunc) Emit(event string, payload any) { f(event, payload) }

// Events names the lifecycle events a platform emits.
type Events struct {
	Started string
	Ended   string
	Error   string
}

// Sink is what a Session uses to report what happens on its connection.
// Calls from a stopped or replaced session are dropped, so a session never
// has to check whether it is still current.
type Sink interface {
	Message(Message)
	Started(payload any)
	Error(err error)
}

// Session is one live connection to a platform.
type Session interface {
	// Run blocks until the session ends. It must return promptly once ctx is
	// cancelled or Close is called. A non-nil error is reported to the user
	// unless the session was stopped on purpose.
	Run(ctx context.Context) error
	// Close tears the connection down. It must be idempotent and safe to call
	// concurrently with Run.
	Close()
}

// Connector opens sessions for one platform.
type Connector interface {
	Events() Events
	// Connect validates input and opens a connection. ctx is cancelled when
	// the session is stopped or replaced.
	Connect(ctx context.Context, input string, sink Sink) (Session, error)
}

// Manager owns the single active session of one platform. Platforms are
// independent: each has its own Manager and none shares state with another.
type Manager struct {
	connector Connector
	emit      Emitter

	mu      sync.Mutex
	current *run
}

// NewManager creates a Manager for a platform.
func NewManager(connector Connector, emit Emitter) *Manager {
	return &Manager{connector: connector, emit: emit}
}

type run struct {
	cancel     context.CancelFunc
	session    Session
	superseded atomic.Bool // replaced by a newer session: emit nothing more
	ctx        context.Context
}

// shutdown cancels the run and closes its session.
func (r *run) shutdown() {
	r.cancel()
	if r.session != nil {
		r.session.Close()
	}
}

// Start opens a new session and replaces the current one. If connecting
// fails the current session is left untouched.
func (m *Manager) Start(parent context.Context, input string) error {
	ctx, cancel := context.WithCancel(parent)
	r := &run{cancel: cancel, ctx: ctx}
	events := m.connector.Events()

	session, err := m.connector.Connect(ctx, input, &sink{m: m, r: r, events: events})
	if err != nil {
		cancel()
		return err
	}
	r.session = session

	// Swap under the lock, clean up the old session outside it.
	m.mu.Lock()
	old := m.current
	m.current = r
	m.mu.Unlock()

	if old != nil {
		old.superseded.Store(true)
		old.shutdown()
	}

	go m.supervise(r, input, events)
	return nil
}

// Stop ends the current session, if any.
func (m *Manager) Stop() {
	m.mu.Lock()
	r := m.current
	m.current = nil
	m.mu.Unlock()

	if r != nil {
		r.shutdown()
	}
}

// supervise runs the session and reports how it ended. A panic is turned
// into an error event instead of taking the whole app down.
func (m *Manager) supervise(r *run, input string, events Events) {
	s := &sink{m: m, r: r, events: events}
	defer func() {
		if rec := recover(); rec != nil {
			s.Error(fmt.Errorf("panic: %v", rec))
		}
		m.mu.Lock()
		if m.current == r {
			m.current = nil
		}
		m.mu.Unlock()
		r.cancel()
		if !r.superseded.Load() {
			m.emit.Emit(events.Ended, input)
		}
	}()

	if err := r.session.Run(r.ctx); err != nil {
		s.Error(err)
	}
}

type sink struct {
	m      *Manager
	r      *run
	events Events
}

// live reports whether the session may still talk to the frontend.
func (s *sink) live() bool {
	return !s.r.superseded.Load() && s.r.ctx.Err() == nil
}

func (s *sink) Message(msg Message) {
	if s.live() {
		s.m.emit.Emit(EventMessage, msg)
	}
}

func (s *sink) Started(payload any) {
	if s.live() {
		s.m.emit.Emit(s.events.Started, payload)
	}
}

func (s *sink) Error(err error) {
	if err != nil && s.live() {
		s.m.emit.Emit(s.events.Error, err.Error())
	}
}
