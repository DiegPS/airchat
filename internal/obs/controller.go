package obs

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/andreykaipov/goobs"
	"github.com/andreykaipov/goobs/api/requests/inputs"

	"airchat/internal/chat"
)

// EventStatus is the Wails event carrying Status snapshots.
const EventStatus = "obs_status"

const (
	defaultHost  = "localhost:4455"
	pollInterval = time.Second
)

var errNotConnected = errors.New("not connected to OBS")

// Controller owns the OBS connection and its monitoring goroutine.
type Controller struct {
	emit chat.Emitter

	mu     sync.RWMutex
	client *goobs.Client
	cancel context.CancelFunc
}

// NewController creates a Controller that publishes status through emit.
func NewController(emit chat.Emitter) *Controller {
	return &Controller{emit: emit}
}

// Connect opens a connection to OBS and starts monitoring it. Any previous
// connection is replaced. Monitoring also stops when ctx is cancelled.
func (c *Controller) Connect(ctx context.Context, host, password string) error {
	if host == "" {
		host = defaultHost
	}

	// The network call happens outside the lock: it can take a while.
	client, err := goobs.New(host, goobs.WithPassword(password))
	if err != nil {
		return err
	}

	monitorCtx, cancel := context.WithCancel(ctx)

	c.mu.Lock()
	oldClient, oldCancel := c.client, c.cancel
	c.client, c.cancel = client, cancel
	c.mu.Unlock()

	release(oldClient, oldCancel)
	go c.monitor(monitorCtx, client)
	return nil
}

// Disconnect closes the connection, if any.
func (c *Controller) Disconnect() {
	c.mu.Lock()
	client, cancel := c.client, c.cancel
	c.client, c.cancel = nil, nil
	c.mu.Unlock()

	release(client, cancel)
}

func release(client *goobs.Client, cancel context.CancelFunc) {
	if cancel != nil {
		cancel()
	}
	if client != nil {
		_ = client.Disconnect()
	}
}

func (c *Controller) snapshot() (*goobs.Client, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.client == nil {
		return nil, errNotConnected
	}
	return c.client, nil
}

// AudioInputs returns the special microphone and desktop inputs.
func (c *Controller) AudioInputs() (map[string]AudioInput, error) {
	client, err := c.snapshot()
	if err != nil {
		return nil, err
	}

	special, err := client.Inputs.GetSpecialInputs()
	if err != nil {
		return nil, err
	}

	result := make(map[string]AudioInput)
	for key, name := range map[string]string{"microphone": special.Mic1, "desktop": special.Desktop1} {
		if name == "" {
			continue
		}
		if muted, volume, err := audioState(client, name); err == nil {
			result[key] = AudioInput{Name: name, Muted: muted, Volume: volume}
		}
	}
	return result, nil
}

func audioState(client *goobs.Client, name string) (bool, float64, error) {
	mute, err := client.Inputs.GetInputMute(&inputs.GetInputMuteParams{InputName: &name})
	if err != nil {
		return false, 0, err
	}
	volume, err := client.Inputs.GetInputVolume(&inputs.GetInputVolumeParams{InputName: &name})
	if err != nil {
		return mute.InputMuted, 0, err
	}
	return mute.InputMuted, volume.InputVolumeDb, nil
}

// SetInputMute mutes or unmutes an input.
func (c *Controller) SetInputMute(name string, muted bool) error {
	client, err := c.snapshot()
	if err != nil {
		return err
	}
	_, err = client.Inputs.SetInputMute(&inputs.SetInputMuteParams{InputName: &name, InputMuted: &muted})
	return err
}

// SetInputVolume sets an input's volume in dB.
func (c *Controller) SetInputVolume(name string, volumeDb float64) error {
	client, err := c.snapshot()
	if err != nil {
		return err
	}
	_, err = client.Inputs.SetInputVolume(&inputs.SetInputVolumeParams{InputName: &name, InputVolumeDb: &volumeDb})
	return err
}

func (c *Controller) monitor(ctx context.Context, client *goobs.Client) {
	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	var s sampler
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-ticker.C:
			cur, err := read(client)
			if err != nil {
				c.emit.Emit(EventStatus, Status{Connected: false})
				continue
			}
			c.emit.Emit(EventStatus, s.next(cur, now))
		}
	}
}

// read takes one raw reading from OBS.
func read(client *goobs.Client) (sample, error) {
	stream, err := client.Stream.GetStreamStatus()
	if err != nil {
		return sample{}, err
	}
	stats, err := client.General.GetStats()
	if err != nil {
		return sample{}, err
	}

	cur := sample{
		Bytes:        stream.OutputBytes,
		Skipped:      stream.OutputSkippedFrames,
		Total:        stream.OutputTotalFrames,
		Active:       stream.OutputActive,
		Reconnecting: stream.OutputReconnecting,
		Congestion:   stream.OutputCongestion,
		FPS:          stats.ActiveFps,
	}
	if scene, err := client.Scenes.GetCurrentProgramScene(); err == nil {
		cur.Scene = scene.CurrentProgramSceneName
	}
	return cur, nil
}
