package main

import (
	"context"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"airchat/internal/chat"
	"airchat/internal/obs"
	"airchat/internal/platform/kick"
	"airchat/internal/platform/twitch"
	"airchat/internal/platform/youtube"
	"airchat/internal/preview"
	"airchat/internal/window"
)

const previewDelay = 150 * time.Millisecond

// App is the thin layer Wails binds to the frontend. Every exported method is
// part of the frontend contract; the logic lives in internal/.
type App struct {
	ctx context.Context

	youtube *chat.Manager
	twitch  *chat.Manager
	kick    *chat.Manager

	obs          *obs.Controller
	clickThrough window.ClickThrough
	emit         chat.Emitter
}

// NewApp wires the platforms together. Each platform has its own Manager, so
// one failing or stopping never affects the others.
func NewApp() *App {
	a := &App{}

	// a.ctx is assigned once in startup, before the frontend can call us.
	a.emit = chat.EmitterFunc(func(event string, payload any) {
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, event, payload)
		}
	})

	a.youtube = chat.NewManager(youtube.Connector{}, a.emit)
	a.twitch = chat.NewManager(&twitch.Connector{}, a.emit)
	a.kick = chat.NewManager(kick.Connector{}, a.emit)
	a.obs = obs.NewController(a.emit)
	return a
}

func (a *App) startup(ctx context.Context) { a.ctx = ctx }

// shutdown releases every connection when the window closes.
func (a *App) shutdown(context.Context) {
	a.youtube.Stop()
	a.twitch.Stop()
	a.kick.Stop()
	a.obs.Disconnect()
}

// ── Chat platforms ───────────────────────────────────────────────────────────

// StartChat starts YouTube chat from a handle, channel ID, or video URL.
func (a *App) StartChat(input string) error { return a.youtube.Start(a.ctx, input) }

// StopChat stops YouTube chat.
func (a *App) StopChat() { a.youtube.Stop() }

// StartTwitchChat connects anonymously to a Twitch channel.
func (a *App) StartTwitchChat(channel string) error { return a.twitch.Start(a.ctx, channel) }

// StopTwitchChat stops Twitch chat.
func (a *App) StopTwitchChat() { a.twitch.Stop() }

// StartKickChat connects anonymously to a Kick channel.
func (a *App) StartKickChat(slug string) error { return a.kick.Start(a.ctx, slug) }

// StopKickChat stops Kick chat.
func (a *App) StopKickChat() { a.kick.Stop() }

// StartPreviewChat emits sample messages through the same event pipeline as
// live chat.
func (a *App) StartPreviewChat() {
	go preview.Play(a.ctx, a.emit, preview.Messages(time.Now()), previewDelay)
}

// ── OBS ──────────────────────────────────────────────────────────────────────

// ConnectOBS connects to OBS WebSocket and starts monitoring.
func (a *App) ConnectOBS(host, password string) error { return a.obs.Connect(a.ctx, host, password) }

// DisconnectOBS disconnects from OBS.
func (a *App) DisconnectOBS() { a.obs.Disconnect() }

// GetOBSAudioInputs returns the microphone and desktop audio inputs.
func (a *App) GetOBSAudioInputs() (map[string]obs.AudioInput, error) { return a.obs.AudioInputs() }

// SetOBSInputMute mutes or unmutes an audio input.
func (a *App) SetOBSInputMute(inputName string, muted bool) error {
	return a.obs.SetInputMute(inputName, muted)
}

// SetOBSInputVolume sets an audio input's volume in dB.
func (a *App) SetOBSInputVolume(inputName string, volumeDb float64) error {
	return a.obs.SetInputVolume(inputName, volumeDb)
}

// ── Window ───────────────────────────────────────────────────────────────────

// SetClickThrough toggles mouse click-through on the window.
func (a *App) SetClickThrough(enabled bool) { a.clickThrough.Set(enabled) }
