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

// Lifecycle events. Every platform emits the same four events; the payload
// says which platform they are about.
const (
	EventStarted = "platform_started"
	EventEnded   = "platform_ended"
	EventError   = "platform_error"   // fatal: the session is unusable
	EventWarning = "platform_warning" // recoverable: the session keeps running
)

// StatusEvent is the payload of EventStarted and EventEnded.
type StatusEvent struct {
	Platform Platform `json:"platform"`
	Detail   string   `json:"detail,omitempty"` // e.g. YouTube live ID, channel name
}

// ProblemEvent is the payload of EventError and EventWarning.
type ProblemEvent struct {
	Platform Platform `json:"platform"`
	Message  string   `json:"message"`
}

// Sink is what a Session uses to report what happens on its connection.
// Calls from a stopped or replaced session are dropped, so a session never
// has to check whether it is still current.
type Sink interface {
	Message(Message)
	// Started reports that the connection is live. detail is shown next to
	// the platform name (live ID, channel).
	Started(detail string)
	// Warning reports a recoverable problem (the session keeps running).
	Warning(err error)
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
	Platform() Platform
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

	session, err := m.connector.Connect(ctx, input, &sink{m: m, r: r})
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

	go m.supervise(r, input)
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
func (m *Manager) supervise(r *run, input string) {
	s := &sink{m: m, r: r}
	defer func() {
		if rec := recover(); rec != nil {
			s.fail(fmt.Errorf("panic: %v", rec))
		}
		m.mu.Lock()
		if m.current == r {
			m.current = nil
		}
		m.mu.Unlock()
		r.cancel()
		if !r.superseded.Load() {
			m.emit.Emit(EventEnded, StatusEvent{Platform: m.connector.Platform(), Detail: input})
		}
	}()

	if err := r.session.Run(r.ctx); err != nil {
		s.fail(err)
	}
}

type sink struct {
	m *Manager
	r *run
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

func (s *sink) Started(detail string) {
	if s.live() {
		s.m.emit.Emit(EventStarted, StatusEvent{Platform: s.m.connector.Platform(), Detail: detail})
	}
}

func (s *sink) Warning(err error) {
	s.problem(EventWarning, err)
}

// fail reports a fatal error. Only the Manager calls it.
func (s *sink) fail(err error) {
	s.problem(EventError, err)
}

func (s *sink) problem(event string, err error) {
	if err != nil && s.live() {
		s.m.emit.Emit(event, ProblemEvent{Platform: s.m.connector.Platform(), Message: err.Error()})
	}
}
