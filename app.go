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
	twitch "github.com/gempir/go-twitch-irc/v3"
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

	obsClient   *goobs.Client
	obsStop     chan struct{}
	obsClientMu sync.RWMutex // protects obsClient and obsStop

	twitchClient   *twitch.Client
	twitchMu       sync.Mutex
	twitchStop     chan struct{}
	twitchEmotes   emoteMap
	twitchEmotesMu sync.RWMutex
}

// StartPreviewChat emits hardcoded mock messages that exercise the full
// pipeline (Go → event → frontend render), including real emote URLs.
func (a *App) StartPreviewChat() {
	now := time.Now()

	img := func(url, alt, text string, custom bool) map[string]interface{} {
		return map[string]interface{}{
			"URL": url, "Alt": alt, "EmojiText": text, "IsCustomEmoji": custom,
		}
	}
	txt := func(t string) map[string]interface{} { return map[string]interface{}{"Text": t} }
	emote := func(url, name string, custom bool) map[string]interface{} {
		return map[string]interface{}{"Text": "", "EmojiItem": img(url, name, name, custom)}
	}
	_ = img // used via emote helper

	msgs := []map[string]interface{}{
		// YouTube — owner
		{
			"Platform": "youtube", "ID": "p1",
			"Author":       map[string]interface{}{"Name": "ElStreamer", "ChannelID": "A", "Thumbnail": map[string]interface{}{"URL": "https://i.pravatar.cc/100?u=yt-owner", "Alt": "E"}},
			"Message":      []map[string]interface{}{txt("📺 Mensaje del dueño del canal (YouTube)")},
			"IsOwner": true, "IsModerator": false, "IsMembership": false, "IsVerified": false,
			"Timestamp": now.Format(time.RFC3339),
		},
		// YouTube — mod
		{
			"Platform": "youtube", "ID": "p2",
			"Author":      map[string]interface{}{"Name": "ModYT", "ChannelID": "B", "Thumbnail": map[string]interface{}{"URL": "https://i.pravatar.cc/100?u=yt-mod", "Alt": "M"}},
			"Message":     []map[string]interface{}{txt("🛡️ Moderador de YouTube")},
			"IsOwner": false, "IsModerator": true, "IsMembership": false, "IsVerified": false,
			"Timestamp": now.Format(time.RFC3339),
		},
		// YouTube — member con badge
		{
			"Platform": "youtube", "ID": "p3",
			"Author": map[string]interface{}{
				"Name": "MiembroFiel", "ChannelID": "C",
				"Thumbnail": map[string]interface{}{"URL": "https://i.pravatar.cc/100?u=yt-member", "Alt": "F"},
				"Badge": map[string]interface{}{"Label": "6 meses", "Thumbnail": map[string]interface{}{"URL": "https://i.pravatar.cc/20?u=badge", "Alt": "6m"}},
			},
			"Message":      []map[string]interface{}{txt("🟢 Miembro 6 meses")},
			"IsOwner": false, "IsModerator": false, "IsMembership": true, "IsVerified": false,
			"Timestamp": now.Format(time.RFC3339),
		},
		// YouTube — SuperChat
		{
			"Platform": "youtube", "ID": "p4",
			"Author":    map[string]interface{}{"Name": "SuperDonador", "ChannelID": "D", "Thumbnail": map[string]interface{}{"URL": "https://i.pravatar.cc/100?u=yt-super", "Alt": "S"}},
			"Message":   []map[string]interface{}{txt("💰 Super Chat de YouTube")},
			"SuperChat": map[string]interface{}{"Amount": "$4.99", "Color": "1DE9B6"},
			"IsOwner": false, "IsModerator": false, "IsMembership": false, "IsVerified": false,
			"Timestamp": now.Format(time.RFC3339),
		},
		// Twitch — broadcaster sin foto + emote nativo Kappa
		{
			"Platform": "twitch", "ID": "p5",
			"Author":  map[string]interface{}{"Name": "ElStreamerTwitch", "ChannelID": "E", "Thumbnail": map[string]interface{}{"URL": "", "Alt": "E"}},
			"Message": []map[string]interface{}{
				txt("🟣 Broadcaster "),
				emote("https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/1.0", "Kappa", false),
			},
			"IsOwner": true, "IsModerator": false, "IsMembership": false, "IsVerified": false,
			"Timestamp": now.Format(time.RFC3339),
		},
		// Twitch — mod + emote BTTV KKona (global real)
		{
			"Platform": "twitch", "ID": "p6",
			"Author":  map[string]interface{}{"Name": "ModTwitch", "ChannelID": "F", "Thumbnail": map[string]interface{}{"URL": "", "Alt": "M"}},
			"Message": []map[string]interface{}{
				txt("BTTV emote: "),
				emote("https://cdn.betterttv.net/emote/566ca04265dbbdab32ec054a/1x", "KKona", true),
			},
			"IsOwner": false, "IsModerator": true, "IsMembership": false, "IsVerified": false,
			"Timestamp": now.Format(time.RFC3339),
		},
		// Twitch — sub + BTTV haHAA + 7TV PETPET (ambos emotes globales reales)
		{
			"Platform": "twitch", "ID": "p7",
			"Author":  map[string]interface{}{"Name": "SubTwitch", "ChannelID": "G", "Thumbnail": map[string]interface{}{"URL": "", "Alt": "S"}},
			"Message": []map[string]interface{}{
				txt("Mix BTTV+7TV: "),
				emote("https://cdn.betterttv.net/emote/555981336ba1901877765555/1x", "haHAA", true),
				txt(" "),
				emote("https://cdn.7tv.app/emote/01FE3XY508000AA32JP519W2EW/1x.webp", "PETPET", true),
			},
			"IsOwner": false, "IsModerator": false, "IsMembership": true, "IsVerified": false,
			"Timestamp": now.Format(time.RFC3339),
		},
		// Twitch — viewer normal sin foto
		{
			"Platform": "twitch", "ID": "p8",
			"Author":  map[string]interface{}{"Name": "ViewerTwitch", "ChannelID": "H", "Thumbnail": map[string]interface{}{"URL": "", "Alt": "V"}},
			"Message": []map[string]interface{}{txt("👾 Viewer normal — sin foto de perfil")},
			"IsOwner": false, "IsModerator": false, "IsMembership": false, "IsVerified": false,
			"Timestamp": now.Format(time.RFC3339),
		},
	}

	go func() {
		for _, msg := range msgs {
			runtime.EventsEmit(a.ctx, "chat_message", msg)
			time.Sleep(150 * time.Millisecond)
		}
	}()
}

// withPlatform serializes data to a map and injects the Platform field.
// This lets us emit a unified chat_message event across all platforms.
func withPlatform(platform string, data interface{}) map[string]interface{} {
	b, _ := json.Marshal(data)
	var m map[string]interface{}
	_ = json.Unmarshal(b, &m)
	if m == nil {
		m = make(map[string]interface{})
	}
	m["Platform"] = platform
	return m
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

	// Network call outside the lock — can take hundreds of ms.
	client, err := goobs.New(host, goobs.WithPassword(password))
	if err != nil {
		return err
	}

	sig := make(chan struct{})

	// Swap in the new client/signal atomically and collect the old ones for cleanup.
	a.obsClientMu.Lock()
	oldClient := a.obsClient
	oldStop := a.obsStop
	a.obsClient = client
	a.obsStop = sig
	a.obsClientMu.Unlock()

	// Clean up the previous session outside the lock so cleanup work doesn't
	// block readers.
	if oldStop != nil {
		close(oldStop)
	}
	if oldClient != nil {
		_ = oldClient.Disconnect()
	}

	go a.monitorOBS(client, sig)

	return nil
}

// DisconnectOBS disconnects from OBS
func (a *App) DisconnectOBS() {
	// Grab and nil out the fields atomically so no other goroutine can observe
	// a non-nil client that is mid-disconnect.
	a.obsClientMu.Lock()
	client := a.obsClient
	sig := a.obsStop
	a.obsClient = nil
	a.obsStop = nil
	a.obsClientMu.Unlock()

	// Cleanup outside the lock.
	if sig != nil {
		close(sig)
	}
	if client != nil {
		_ = client.Disconnect()
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
	a.obsClientMu.RLock()
	client := a.obsClient
	a.obsClientMu.RUnlock()

	if client == nil {
		return nil, fmt.Errorf("not connected to OBS")
	}

	// Get special inputs
	specialInputs, err := client.Inputs.GetSpecialInputs()
	if err != nil {
		return nil, err
	}

	result := make(map[string]OBSAudioInput)

	// Check Mic/Aux (usually microphone)
	if specialInputs.Mic1 != "" {
		micName := specialInputs.Mic1
		muted, vol, err := getInputAudioState(client, micName)
		if err == nil {
			result["microphone"] = OBSAudioInput{Name: micName, Muted: muted, Volume: vol}
		}
	}

	// Check Desktop Audio
	if specialInputs.Desktop1 != "" {
		desktopName := specialInputs.Desktop1
		muted, vol, err := getInputAudioState(client, desktopName)
		if err == nil {
			result["desktop"] = OBSAudioInput{Name: desktopName, Muted: muted, Volume: vol}
		}
	}

	return result, nil
}

// getInputAudioState is a pure helper — it receives the already-snapshotted client
// so callers don't need to hold any lock while this runs.
func getInputAudioState(client *goobs.Client, inputName string) (bool, float64, error) {
	muteResp, err := client.Inputs.GetInputMute(&inputs.GetInputMuteParams{
		InputName: &inputName,
	})
	if err != nil {
		return false, 0, err
	}

	volResp, err := client.Inputs.GetInputVolume(&inputs.GetInputVolumeParams{
		InputName: &inputName,
	})
	if err != nil {
		return muteResp.InputMuted, 0, err
	}

	return muteResp.InputMuted, volResp.InputVolumeDb, nil
}

// SetOBSInputMute mutes or unmutes an audio input
func (a *App) SetOBSInputMute(inputName string, muted bool) error {
	a.obsClientMu.RLock()
	client := a.obsClient
	a.obsClientMu.RUnlock()

	if client == nil {
		return fmt.Errorf("not connected to OBS")
	}
	_, err := client.Inputs.SetInputMute(&inputs.SetInputMuteParams{
		InputName:  &inputName,
		InputMuted: &muted,
	})
	return err
}

// SetOBSInputVolume sets the volume of an audio input (in dB)
func (a *App) SetOBSInputVolume(inputName string, volumeDb float64) error {
	a.obsClientMu.RLock()
	client := a.obsClient
	a.obsClientMu.RUnlock()

	if client == nil {
		return fmt.Errorf("not connected to OBS")
	}
	_, err := client.Inputs.SetInputVolume(&inputs.SetInputVolumeParams{
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

	// Stop any existing session and clean up immediately so that any error path
	// below leaves the struct in a consistent nil state, preventing a double-close
	// panic on the next call.
	if a.lc != nil {
		a.lc.Stop("Starting new session")
		a.lc = nil
	}
	if a.stopSignal != nil {
		close(a.stopSignal)
		a.stopSignal = nil
	}

	lc, err := youtubechat.NewLiveChat(types.YoutubeId{ChannelID: channelID}, 1000)
	if err != nil {
		return err
	}

	sig := make(chan struct{})
	ok := lc.Start()
	if !ok {
		return fmt.Errorf("failed to start live chat observation")
	}

	a.lc = lc
	a.stopSignal = sig

	go a.handleChatEvents(lc, sig)

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

// StartTwitchChat connects anonymously to a Twitch channel's chat.
// Runs independently — if it fails, YouTube chat is unaffected.
func (a *App) StartTwitchChat(channelName string) error {
	if channelName == "" {
		return fmt.Errorf("channel name is required")
	}

	client := twitch.NewAnonymousClient()
	sig := make(chan struct{})

	client.OnPrivateMessage(func(msg twitch.PrivateMessage) {
		select {
		case <-sig:
			return
		default:
		}
		isMod := msg.User.Badges["moderator"] > 0
		isBroadcaster := msg.User.Badges["broadcaster"] > 0
		isSub := msg.User.Badges["subscriber"] > 0 || msg.User.Badges["founder"] > 0

		payload := map[string]interface{}{
			"Platform": "twitch",
			"ID":       msg.ID,
			"Author": map[string]interface{}{
				"Name":      msg.User.DisplayName,
				"ChannelID": msg.User.ID,
				"Thumbnail": map[string]interface{}{
					"URL": "",
					"Alt": msg.User.DisplayName,
				},
			},
			"Message":      a.getTwitchMessageParts(msg.Message, msg.Emotes),
			"IsMembership": isSub,
			"IsVerified":   false,
			"IsOwner":      isBroadcaster,
			"IsModerator":  isMod,
			"Timestamp":    msg.Time.Format(time.RFC3339),
		}
		runtime.EventsEmit(a.ctx, "chat_message", payload)
	})

	client.OnConnect(func() {
		runtime.EventsEmit(a.ctx, "twitch_started", channelName)
		go a.loadTwitchEmotes()
	})

	client.Join(channelName)

	// Swap in the new client atomically and collect old for cleanup.
	a.twitchMu.Lock()
	oldClient := a.twitchClient
	oldStop := a.twitchStop
	a.twitchClient = client
	a.twitchStop = sig
	a.twitchMu.Unlock()

	if oldStop != nil {
		close(oldStop)
	}
	if oldClient != nil {
		oldClient.Disconnect()
	}

	go func() {
		defer func() {
			if r := recover(); r != nil {
				runtime.EventsEmit(a.ctx, "twitch_error", fmt.Sprintf("panic: %v", r))
			}
		}()

		// Disconnect when stop signal fires.
		go func() {
			<-sig
			client.Disconnect()
		}()

		if err := client.Connect(); err != nil {
			// Only surface the error if it wasn't an intentional stop.
			select {
			case <-sig:
			default:
				runtime.EventsEmit(a.ctx, "twitch_error", err.Error())
			}
		}
		runtime.EventsEmit(a.ctx, "twitch_ended", channelName)
	}()

	return nil
}

// StopTwitchChat disconnects from Twitch chat cleanly.
func (a *App) StopTwitchChat() {
	a.twitchMu.Lock()
	client := a.twitchClient
	sig := a.twitchStop
	a.twitchClient = nil
	a.twitchStop = nil
	a.twitchMu.Unlock()

	if sig != nil {
		close(sig) // triggers the goroutine's watcher to call Disconnect
	}
	if client != nil {
		client.Disconnect()
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
			runtime.EventsEmit(a.ctx, "chat_message", withPlatform("youtube", chatItem))
		case err := <-lc.ErrorChan:
			runtime.EventsEmit(a.ctx, "chat_error", err.Error())
		}
	}
}
