package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"syscall"

	"math"
	"time"

	youtubechat "github.com/DiegPS/youtube-chat"
	"github.com/DiegPS/youtube-chat/types"
	"github.com/andreykaipov/goobs"
	"github.com/andreykaipov/goobs/api/requests/inputs"
	"github.com/lxn/win"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx        context.Context
	lc         *youtubechat.LiveChat
	lcMu       sync.Mutex
	stopSignal chan struct{}
	hwnd       win.HWND

	obsClient *goobs.Client
	obsStop   chan struct{}
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// YoutubeStats represents the response from livecounts.io
type YoutubeStats struct {
	Cache         bool    `json:"cache"`
	Success       bool    `json:"success"`
	FollowerCount int64   `json:"followerCount"`
	BottomOdos    []int64 `json:"bottomOdos"`
	IsStudioCount bool    `json:"isStudioCount"`
}

// GetYoutubeStats fetches channel statistics from livecounts.io
func (a *App) GetYoutubeStats(channelID string) (*YoutubeStats, error) {
	url := fmt.Sprintf("https://api.livecounts.io/youtube-live-subscriber-counter/stats/%s", channelID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	// Add some headers to avoid being blocked
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Origin", "https://livecounts.io")
	req.Header.Set("Referer", "https://livecounts.io/")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to fetch stats: status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var stats YoutubeStats
	if err := json.Unmarshal(body, &stats); err != nil {
		return nil, err
	}

	return &stats, nil
}

// LiveCountsUserData represents a user in the search results
type LiveCountsUserData struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Avatar   string `json:"avatar"`
}

// LiveCountsSearchResponse represents the response from livecounts.io search
type LiveCountsSearchResponse struct {
	Cache    bool                 `json:"cache"`
	Success  bool                 `json:"success"`
	UserData []LiveCountsUserData `json:"userData"`
}

// SearchYoutubeChannel searches for a channel on livecounts.io
func (a *App) SearchYoutubeChannel(query string) (*LiveCountsSearchResponse, error) {
	url := fmt.Sprintf("https://api.livecounts.io/youtube-live-subscriber-counter/search/%s", query)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	// Add some headers to avoid being blocked
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Origin", "https://livecounts.io")
	req.Header.Set("Referer", "https://livecounts.io/")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to search channel: status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var searchResp LiveCountsSearchResponse
	if err := json.Unmarshal(body, &searchResp); err != nil {
		return nil, err
	}

	return &searchResp, nil
}

// OBSStatus represents the health of the stream
type OBSStatus struct {
	Connected      bool    `json:"connected"`
	OutputActive   bool    `json:"outputActive"`
	Reconnecting   bool    `json:"reconnecting"`
	BitrateKbps    float64 `json:"bitrateKbps"`
	FPS            float64 `json:"fps"`
	DropPercentage float64 `json:"dropPercentage"`
	Congestion     float64 `json:"congestion"`
	StatusColor    string  `json:"statusColor"` // "GREEN", "YELLOW", "RED", "GRAY"
	CurrentScene   string  `json:"currentScene"`
}

// ConnectOBS connects to the OBS WebSocket and starts monitoring
func (a *App) ConnectOBS(host, password string) error {
	if host == "" {
		host = "localhost:4455"
	}

	client, err := goobs.New(host, goobs.WithPassword(password))
	if err != nil {
		return err
	}

	if a.obsClient != nil {
		_ = a.obsClient.Disconnect()
		if a.obsStop != nil {
			close(a.obsStop)
		}
	}

	a.obsClient = client
	a.obsStop = make(chan struct{})

	go a.monitorOBS(client, a.obsStop)

	return nil
}

// DisconnectOBS disconnects from OBS
func (a *App) DisconnectOBS() {
	if a.obsClient != nil {
		_ = a.obsClient.Disconnect()
		a.obsClient = nil
	}
	if a.obsStop != nil {
		close(a.obsStop)
		a.obsStop = nil
	}
}

// OBSAudioInput represents an audio input source
type OBSAudioInput struct {
	Name   string  `json:"name"`
	Muted  bool    `json:"muted"`
	Volume float64 `json:"volume"` // Volume in dB
}

// GetOBSAudioInputs gets the special audio inputs (Mic and Desktop)
func (a *App) GetOBSAudioInputs() (map[string]OBSAudioInput, error) {
	if a.obsClient == nil {
		return nil, fmt.Errorf("not connected to OBS")
	}

	// Get special inputs
	specialInputs, err := a.obsClient.Inputs.GetSpecialInputs()
	if err != nil {
		return nil, err
	}

	result := make(map[string]OBSAudioInput)

	// Check Mic/Aux (usually microphone)
	if specialInputs.Mic1 != "" {
		micName := specialInputs.Mic1
		muted, vol, err := a.getInputAudioState(micName)
		if err == nil {
			result["microphone"] = OBSAudioInput{Name: micName, Muted: muted, Volume: vol}
		}
	}

	// Check Desktop Audio
	if specialInputs.Desktop1 != "" {
		desktopName := specialInputs.Desktop1
		muted, vol, err := a.getInputAudioState(desktopName)
		if err == nil {
			result["desktop"] = OBSAudioInput{Name: desktopName, Muted: muted, Volume: vol}
		}
	}

	return result, nil
}

// Helper to get audio state
func (a *App) getInputAudioState(inputName string) (bool, float64, error) {
	muteResp, err := a.obsClient.Inputs.GetInputMute(&inputs.GetInputMuteParams{
		InputName: &inputName,
	})
	if err != nil {
		return false, 0, err
	}

	volResp, err := a.obsClient.Inputs.GetInputVolume(&inputs.GetInputVolumeParams{
		InputName: &inputName,
	})
	if err != nil {
		return muteResp.InputMuted, 0, err
	}

	return muteResp.InputMuted, volResp.InputVolumeDb, nil
}

// SetOBSInputMute mutes or unmutes an audio input
func (a *App) SetOBSInputMute(inputName string, muted bool) error {
	if a.obsClient == nil {
		return fmt.Errorf("not connected to OBS")
	}
	_, err := a.obsClient.Inputs.SetInputMute(&inputs.SetInputMuteParams{
		InputName:  &inputName,
		InputMuted: &muted,
	})
	return err
}

// SetOBSInputVolume sets the volume of an audio input (in dB)
func (a *App) SetOBSInputVolume(inputName string, volumeDb float64) error {
	if a.obsClient == nil {
		return fmt.Errorf("not connected to OBS")
	}
	_, err := a.obsClient.Inputs.SetInputVolume(&inputs.SetInputVolumeParams{
		InputName:     &inputName,
		InputVolumeDb: &volumeDb,
	})
	return err
}

func (a *App) monitorOBS(client *goobs.Client, stopSignal chan struct{}) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	// Baselines
	var (
		prevBytes   float64
		prevSkipped float64
		prevTotal   float64
		prevT       = time.Now()
		hadPrev     bool
	)

	for {
		select {
		case <-stopSignal:
			return
		case <-ticker.C:
			// 1) Stream status
			ss, err := client.Stream.GetStreamStatus()
			if err != nil {
				runtime.EventsEmit(a.ctx, "obs_status", OBSStatus{Connected: false})
				continue
			}

			// 2) FPS (render)
			stats, err := client.General.GetStats()
			if err != nil {
				continue
			}

			// 3) Get Current Scene
			sceneResp, err := client.Scenes.GetCurrentProgramScene()
			currentScene := ""
			if err == nil {
				currentScene = sceneResp.CurrentProgramSceneName
			}

			now := time.Now()
			dt := now.Sub(prevT).Seconds()
			if dt <= 0 {
				dt = 1
			}

			// Reset baseline if stream restarted
			if hadPrev && (ss.OutputBytes < prevBytes || ss.OutputSkippedFrames < prevSkipped || ss.OutputTotalFrames < prevTotal) {
				hadPrev = false
			}

			var kbps, dropPct float64
			var bytesDelta, skippedDelta, totalDelta float64

			if hadPrev {
				bytesDelta = ss.OutputBytes - prevBytes
				skippedDelta = ss.OutputSkippedFrames - prevSkipped
				totalDelta = ss.OutputTotalFrames - prevTotal

				kbps = (bytesDelta * 8.0 / dt) / 1000.0
				if totalDelta > 0 {
					dropPct = (skippedDelta / totalDelta) * 100.0
				}
				// Sanitize
				if kbps < 0 || math.IsNaN(kbps) || math.IsInf(kbps, 0) {
					kbps = 0
				}
				if dropPct < 0 || math.IsNaN(dropPct) || math.IsInf(dropPct, 0) {
					dropPct = 0
				}
			}

			// Color logic
			statusColor := "GREEN"
			if !ss.OutputActive {
				statusColor = "GRAY" // Not streaming
			} else if ss.OutputReconnecting {
				statusColor = "RED" // Reconnecting
			} else if dropPct >= 2.0 {
				statusColor = "RED" // High drops
			} else if dropPct >= 0.5 || (hadPrev && bytesDelta == 0) {
				statusColor = "YELLOW" // Warning
			}

			payload := OBSStatus{
				Connected:      true,
				OutputActive:   ss.OutputActive,
				Reconnecting:   ss.OutputReconnecting,
				BitrateKbps:    kbps,
				FPS:            stats.ActiveFps,
				DropPercentage: dropPct,
				Congestion:     ss.OutputCongestion,
				StatusColor:    statusColor,
				CurrentScene:   currentScene,
			}

			runtime.EventsEmit(a.ctx, "obs_status", payload)

			// Update baseline
			prevBytes = ss.OutputBytes
			prevSkipped = ss.OutputSkippedFrames
			prevTotal = ss.OutputTotalFrames
			prevT = now
			hadPrev = true
		}
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	// Find window manually but DO NOT modify styles yet
	a.hwnd = win.FindWindow(nil, syscall.StringToUTF16Ptr("airchat"))
}
func (a *App) SetClickThrough(enabled bool) {
	if a.hwnd == 0 {
		return
	}
	currStyle := win.GetWindowLong(a.hwnd, win.GWL_EXSTYLE)
	if enabled {
		// Enable ClickThrough: Must add LAYERED + TRANSPARENT
		win.SetWindowLong(a.hwnd, win.GWL_EXSTYLE, currStyle|win.WS_EX_LAYERED|win.WS_EX_TRANSPARENT)
	} else {
		// Disable ClickThrough: Remove both to return to a standard managed window
		win.SetWindowLong(a.hwnd, win.GWL_EXSTYLE, currStyle&^(win.WS_EX_LAYERED|win.WS_EX_TRANSPARENT))
	}
}

// StartChat starts observing the chat for a given channel ID
func (a *App) StartChat(channelID string) error {
	a.lcMu.Lock()
	defer a.lcMu.Unlock()

	if a.lc != nil {
		a.lc.Stop("Starting new session")
		close(a.stopSignal)
	}

	lc, err := youtubechat.NewLiveChat(types.YoutubeId{ChannelID: channelID}, 1000)
	if err != nil {
		return err
	}

	a.lc = lc
	a.stopSignal = make(chan struct{})

	ok := a.lc.Start()
	if !ok {
		return fmt.Errorf("failed to start live chat observation")
	}

	go a.handleChatEvents(lc, a.stopSignal)

	return nil
}

// StopChat manually stops the chat observation
func (a *App) StopChat() {
	a.lcMu.Lock()
	defer a.lcMu.Unlock()

	if a.lc != nil {
		a.lc.Stop("User stopped chat")
		if a.stopSignal != nil {
			close(a.stopSignal)
			a.stopSignal = nil
		}
		a.lc = nil
	}
}

func (a *App) handleChatEvents(lc *youtubechat.LiveChat, stopSignal chan struct{}) {
	for {
		select {
		case <-stopSignal:
			return
		case liveId := <-lc.StartChan:
			runtime.EventsEmit(a.ctx, "chat_started", liveId)
		case reason := <-lc.EndChan:
			runtime.EventsEmit(a.ctx, "chat_ended", reason)
			return
		case chatItem := <-lc.ChatChan:
			runtime.EventsEmit(a.ctx, "chat_message", chatItem)
		case err := <-lc.ErrorChan:
			runtime.EventsEmit(a.ctx, "chat_error", err.Error())
		}
	}
}
