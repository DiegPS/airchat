package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"syscall"

	"math"
	"time"

	kickchat "github.com/DiegPS/kick-chat"
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

	kickClient *kickchat.Client
	kickMu     sync.Mutex
	kickCancel context.CancelFunc

	tiktokMu         sync.Mutex
	tiktokCancel     context.CancelFunc
	tiktokGeneration uint64
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
			"Author":  map[string]interface{}{"Name": "ElStreamer", "ChannelID": "A", "Thumbnail": map[string]interface{}{"URL": "https://i.pravatar.cc/100?u=yt-owner", "Alt": "E"}},
			"Message": []map[string]interface{}{txt("📺 Mensaje del dueño del canal (YouTube)")},
			"IsOwner": true, "IsModerator": false, "IsMembership": false, "IsVerified": false,
			"Timestamp": now.Format(time.RFC3339),
		},
		// YouTube — mod
		{
			"Platform": "youtube", "ID": "p2",
			"Author":  map[string]interface{}{"Name": "ModYT", "ChannelID": "B", "Thumbnail": map[string]interface{}{"URL": "https://i.pravatar.cc/100?u=yt-mod", "Alt": "M"}},
			"Message": []map[string]interface{}{txt("🛡️ Moderador de YouTube")},
			"IsOwner": false, "IsModerator": true, "IsMembership": false, "IsVerified": false,
			"Timestamp": now.Format(time.RFC3339),
		},
		// YouTube — member con badge
		{
			"Platform": "youtube", "ID": "p3",
			"Author": map[string]interface{}{
				"Name": "MiembroFiel", "ChannelID": "C",
				"Thumbnail": map[string]interface{}{"URL": "https://i.pravatar.cc/100?u=yt-member", "Alt": "F"},
				"Badge":     map[string]interface{}{"Label": "6 meses", "Thumbnail": map[string]interface{}{"URL": "https://i.pravatar.cc/20?u=badge", "Alt": "6m"}},
			},
			"Message": []map[string]interface{}{txt("🟢 Miembro 6 meses")},
			"IsOwner": false, "IsModerator": false, "IsMembership": true, "IsVerified": false,
			"Timestamp": now.Format(time.RFC3339),
		},
		// YouTube — SuperChat
		{
			"Platform": "youtube", "ID": "p4",
			"Author":    map[string]interface{}{"Name": "SuperDonador", "ChannelID": "D", "Thumbnail": map[string]interface{}{"URL": "https://i.pravatar.cc/100?u=yt-super", "Alt": "S"}},
			"Message":   []map[string]interface{}{txt("💰 Super Chat de YouTube")},
			"SuperChat": map[string]interface{}{"Amount": "$4.99", "Color": "1DE9B6"},
			"IsOwner":   false, "IsModerator": false, "IsMembership": false, "IsVerified": false,
			"Timestamp": now.Format(time.RFC3339),
		},
		// YouTube - mod + member + SuperChat
		{
			"Platform": "youtube", "ID": "p4b",
			"Author": map[string]interface{}{
				"Name": "ModMiembroDonador", "ChannelID": "D2",
				"Thumbnail": map[string]interface{}{"URL": "https://i.pravatar.cc/100?u=yt-mod-member-super", "Alt": "D"},
				"Badge":     map[string]interface{}{"Label": "12 meses", "Thumbnail": map[string]interface{}{"URL": "https://i.pravatar.cc/20?u=badge-super", "Alt": "12m"}},
			},
			"Message":   []map[string]interface{}{txt("Soy mod, miembro y tambien dono")},
			"SuperChat": map[string]interface{}{"Amount": "$20.00", "Color": "00BFA5"},
			"IsOwner":   false, "IsModerator": true, "IsMembership": true, "IsVerified": false,
			"Timestamp": now.Format(time.RFC3339),
		},
		// Twitch — broadcaster sin foto + emote nativo Kappa
		{
			"Platform": "twitch", "ID": "p5",
			"Author": map[string]interface{}{"Name": "ElStreamerTwitch", "ChannelID": "E", "Thumbnail": map[string]interface{}{"URL": "", "Alt": "E"}},
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
			"Author": map[string]interface{}{"Name": "ModTwitch", "ChannelID": "F", "Thumbnail": map[string]interface{}{"URL": "", "Alt": "M"}},
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
			"Author": map[string]interface{}{"Name": "SubTwitch", "ChannelID": "G", "Thumbnail": map[string]interface{}{"URL": "", "Alt": "S"}},
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
		{
			"Platform": "kick", "ID": "p9",
			"Author":  map[string]interface{}{"Name": "StreamerKick", "ChannelID": "I", "Thumbnail": map[string]interface{}{"URL": "", "Alt": "K"}},
			"Message": []map[string]interface{}{txt("Kick broadcaster message")},
			"IsOwner": true, "IsModerator": false, "IsMembership": false, "IsVerified": true,
			"Timestamp": now.Format(time.RFC3339),
		},
		{
			"Platform": "kick", "ID": "p10",
			"Author":  map[string]interface{}{"Name": "ModKick", "ChannelID": "J", "Thumbnail": map[string]interface{}{"URL": "", "Alt": "M"}},
			"Message": []map[string]interface{}{txt("Kick moderator checking chat")},
			"IsOwner": false, "IsModerator": true, "IsMembership": false, "IsVerified": false,
			"Timestamp": now.Format(time.RFC3339),
		},
		{
			"Platform": "kick", "ID": "p11",
			"Author": map[string]interface{}{"Name": "SubKick", "ChannelID": "K", "Thumbnail": map[string]interface{}{"URL": "", "Alt": "S"}},
			"Message": []map[string]interface{}{
				txt("Kick sub emote: "),
				emote("https://files.kick.com/emotes/37217/fullsize", "KEKW", true),
			},
			"IsOwner": false, "IsModerator": false, "IsMembership": true, "IsVerified": false,
			"Timestamp": now.Format(time.RFC3339),
		},
		{
			"Platform": "kick", "ID": "p12",
			"Author":  map[string]interface{}{"Name": "ViewerKick", "ChannelID": "L", "Thumbnail": map[string]interface{}{"URL": "", "Alt": "V"}},
			"Message": []map[string]interface{}{txt("Viewer normal desde Kick")},
			"IsOwner": false, "IsModerator": false, "IsMembership": false, "IsVerified": false,
			"Timestamp": now.Format(time.RFC3339),
		},
		{
			"Platform": "tiktok", "ID": "p13", "EventKind": "chat",
			"Author":  map[string]interface{}{"Name": "CreatorTikTok", "ChannelID": "TT1", "Thumbnail": map[string]interface{}{"URL": "https://i.pravatar.cc/100?u=tiktok-creator", "Alt": "T"}},
			"Message": []map[string]interface{}{txt("TikTok LIVE chat with native roles")},
			"IsOwner": true, "IsModerator": false, "IsMembership": false, "IsVerified": true,
			"Timestamp": now.Format(time.RFC3339),
		},
		{
			"Platform": "tiktok", "ID": "p14", "EventKind": "emote",
			"Author":  map[string]interface{}{"Name": "TikTokSubscriber", "ChannelID": "TT2", "Thumbnail": map[string]interface{}{"URL": "https://i.pravatar.cc/100?u=tiktok-sub", "Alt": "S"}},
			"Message": []map[string]interface{}{emote("https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/802a21ae29f9fae5abe3693de9f874bd~tplv-obj.image", "TikTok emote", true)},
			"IsOwner": false, "IsModerator": false, "IsMembership": true, "IsVerified": false,
			"Timestamp": now.Format(time.RFC3339),
		},
		{
			"Platform": "tiktok", "ID": "gift-streak-preview", "EventKind": "gift", "UpdateExisting": true,
			"Author":  map[string]interface{}{"Name": "GiftGiver", "ChannelID": "TT3", "Thumbnail": map[string]interface{}{"URL": "https://i.pravatar.cc/100?u=tiktok-gift", "Alt": "G"}},
			"Message": []map[string]interface{}{txt("sent Rose x25")},
			"Gift":    map[string]interface{}{"Name": "Rose", "Count": 25, "EventCount": 5, "DiamondCount": 25, "EventDiamondCount": 5, "DiamondEach": 1, "Image": map[string]interface{}{"URL": "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.png", "Alt": "Rose"}, "IsCombo": true, "IsFinal": false, "GroupID": "preview"},
			"IsOwner": false, "IsModerator": false, "IsMembership": false, "IsVerified": false,
			"Timestamp": now.Format(time.RFC3339),
		},
		{
			"Platform": "tiktok", "ID": "p15", "EventKind": "subscription",
			"Author":  map[string]interface{}{"Name": "NewSubscriber", "ChannelID": "TT4", "Thumbnail": map[string]interface{}{"URL": "", "Alt": "N"}},
			"Message": []map[string]interface{}{txt("subscribed for 6 months")},
			"IsOwner": false, "IsModerator": false, "IsMembership": true, "IsVerified": false,
			"Timestamp": now.Format(time.RFC3339),
		},
		{
			"Platform": "tiktok", "ID": "p16", "EventKind": "question",
			"Author":  map[string]interface{}{"Name": "CuriousViewer", "ChannelID": "TT5", "Thumbnail": map[string]interface{}{"URL": "", "Alt": "C"}},
			"Message": []map[string]interface{}{txt("What is your next stream?")},
			"IsOwner": false, "IsModerator": false, "IsMembership": false, "IsVerified": false,
			"Timestamp": now.Format(time.RFC3339),
		},
	}

	advancedCategories := []string{"content", "goals", "interaction", "rankings", "link_mic", "system", "commerce", "games", "partnerships", "moderation", "unknown"}
	for i, category := range advancedCategories {
		id := fmt.Sprintf("tt-advanced-%d", i)
		eventType := category + "_preview"
		msgs = append(msgs, map[string]interface{}{
			"Platform": "tiktok", "ID": id, "EventKind": "advanced",
			"TikTokEvent": map[string]interface{}{"id": id, "type": eventType, "category": category, "timestamp": now.Format(time.RFC3339), "summary": "TikTok " + category + " event", "data": map[string]interface{}{"preview": true}},
			"Author":      map[string]interface{}{"Name": "TikTok LIVE", "ChannelID": "system", "Thumbnail": map[string]interface{}{"URL": "", "Alt": "T"}},
			"Message":     []map[string]interface{}{txt("TikTok " + category + " event")},
			"IsOwner":     false, "IsModerator": false, "IsMembership": false, "IsVerified": false,
			"Timestamp": now.Format(time.RFC3339),
		})
	}

	go func() {
		for _, msg := range msgs {
			runtime.EventsEmit(a.ctx, "chat_message", msg)
			if event, ok := msg["TikTokEvent"]; ok {
				runtime.EventsEmit(a.ctx, "tiktok_event", event)
			}
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
		a.hwnd = win.FindWindow(nil, syscall.StringToUTF16Ptr("airchat"))
		if a.hwnd == 0 {
			return
		}
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

var youtubeVideoIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{11}$`)

func youtubeIDFromInput(input string) (types.YoutubeId, error) {
	value := strings.TrimSpace(input)
	if value == "" {
		return types.YoutubeId{}, fmt.Errorf("youtube channel or video is required")
	}

	if id, ok := youtubeIDFromURL(value); ok {
		return id, nil
	}
	if parsed, err := url.Parse(value); err == nil && parsed.Host != "" {
		return types.YoutubeId{}, fmt.Errorf("unsupported YouTube input: use @handle, UC channel ID, or YouTube video URL")
	}

	if strings.HasPrefix(value, "watch?") {
		if query, err := url.ParseQuery(strings.TrimPrefix(value, "watch?")); err == nil {
			if videoID := strings.TrimSpace(query.Get("v")); videoID != "" {
				return types.YoutubeId{LiveID: videoID}, nil
			}
		}
	}

	pathValue := strings.Trim(value, "/")
	if strings.HasPrefix(pathValue, "channel/") {
		parts := strings.Split(pathValue, "/")
		if len(parts) >= 2 && strings.TrimSpace(parts[1]) != "" {
			return types.YoutubeId{ChannelID: strings.TrimSpace(parts[1])}, nil
		}
	}

	if strings.HasPrefix(value, "UC") {
		return types.YoutubeId{ChannelID: value}, nil
	}

	if youtubeVideoIDPattern.MatchString(value) {
		return types.YoutubeId{LiveID: value}, nil
	}

	handle := strings.TrimPrefix(value, "/")
	if !strings.HasPrefix(handle, "@") {
		handle = "@" + handle
	}
	return types.YoutubeId{Handle: handle}, nil
}

func youtubeIDFromURL(input string) (types.YoutubeId, bool) {
	parsed, err := url.Parse(input)
	if err != nil || parsed.Host == "" {
		return types.YoutubeId{}, false
	}

	host := strings.ToLower(strings.TrimPrefix(parsed.Host, "www."))
	path := strings.Trim(parsed.Path, "/")
	parts := strings.Split(path, "/")

	if videoID := strings.TrimSpace(parsed.Query().Get("v")); videoID != "" {
		return types.YoutubeId{LiveID: videoID}, true
	}

	if host == "youtu.be" && len(parts) > 0 && parts[0] != "" {
		return types.YoutubeId{LiveID: parts[0]}, true
	}

	if len(parts) >= 2 && parts[0] == "channel" && parts[1] != "" {
		return types.YoutubeId{ChannelID: parts[1]}, true
	}

	if len(parts) >= 1 && strings.HasPrefix(parts[0], "@") {
		return types.YoutubeId{Handle: parts[0]}, true
	}

	if len(parts) >= 2 && parts[0] == "live" && parts[1] != "" {
		return types.YoutubeId{LiveID: parts[1]}, true
	}

	return types.YoutubeId{}, false
}

// StartChat starts observing YouTube chat from a handle, channel ID, or video URL.
func (a *App) StartChat(youtubeInput string) error {
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

	youtubeID, err := youtubeIDFromInput(youtubeInput)
	if err != nil {
		return err
	}

	lc, err := youtubechat.NewLiveChat(youtubeID, 1000)
	if err != nil {
		return err
	}

	sig := make(chan struct{})
	if err := lc.Start(); err != nil {
		return err
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
	channelName = strings.TrimSpace(strings.TrimPrefix(channelName, "@"))
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

// StartKickChat connects anonymously to a Kick channel's chat.
// Runs independently — if it fails, other platforms are unaffected.
func (a *App) StartKickChat(slug string) error {
	slug = strings.TrimSpace(strings.TrimPrefix(slug, "@"))
	if slug == "" {
		return fmt.Errorf("channel slug is required")
	}

	kickCtx, cancel := context.WithCancel(a.ctx)
	client, err := kickchat.NewClient(kickCtx)
	if err != nil {
		cancel()
		return fmt.Errorf("kick: failed to connect: %w", err)
	}

	if err := client.JoinChannelBySlug(slug); err != nil {
		cancel()
		client.Close()
		return err
	}

	// Atomic swap — collect old for cleanup outside the lock.
	a.kickMu.Lock()
	oldClient := a.kickClient
	oldCancel := a.kickCancel
	a.kickClient = client
	a.kickCancel = cancel
	a.kickMu.Unlock()

	if oldCancel != nil {
		oldCancel()
	}
	if oldClient != nil {
		oldClient.Close()
	}

	runtime.EventsEmit(a.ctx, "kick_started", slug)

	go func() {
		defer func() {
			if r := recover(); r != nil {
				runtime.EventsEmit(a.ctx, "kick_error", fmt.Sprintf("panic: %v", r))
			}
		}()

		for {
			select {
			case msg, ok := <-client.Messages():
				if !ok {
					runtime.EventsEmit(a.ctx, "kick_ended", slug)
					return
				}
				isOwner, isMod, isSub, isVerified := kickRoles(msg.Sender.Identity.Badges)
				payload := map[string]interface{}{
					"Platform": "kick",
					"ID":       msg.ID,
					"Author": map[string]interface{}{
						"Name":      msg.Sender.Username,
						"ChannelID": fmt.Sprintf("%d", msg.Sender.ID),
						"Thumbnail": map[string]interface{}{
							"URL": "",
							"Alt": msg.Sender.Username,
						},
					},
					"Message":      kickMessageItems(msg.Parts),
					"IsMembership": isSub,
					"IsVerified":   isVerified,
					"IsOwner":      isOwner,
					"IsModerator":  isMod,
					"Timestamp":    msg.CreatedAt.Format(time.RFC3339),
				}
				runtime.EventsEmit(a.ctx, "chat_message", payload)
			case err := <-client.Errors():
				runtime.EventsEmit(a.ctx, "kick_error", err.Error())
			}
		}
	}()

	return nil
}

// StopKickChat disconnects from Kick chat cleanly.
func (a *App) StopKickChat() {
	a.kickMu.Lock()
	client := a.kickClient
	cancel := a.kickCancel
	a.kickClient = nil
	a.kickCancel = nil
	a.kickMu.Unlock()

	if cancel != nil {
		cancel()
	}
	if client != nil {
		client.Close()
	}
}

func (a *App) handleChatEvents(lc *youtubechat.LiveChat, stopSignal chan struct{}) {
	startChan := lc.StartChan
	endChan := lc.EndChan
	chatChan := lc.ChatChan
	errorChan := lc.ErrorChan

	for {
		select {
		case <-stopSignal:
			return
		case liveId, ok := <-startChan:
			if !ok {
				startChan = nil
				continue
			}
			runtime.EventsEmit(a.ctx, "chat_started", liveId)
		case reason, ok := <-endChan:
			if !ok {
				return
			}
			runtime.EventsEmit(a.ctx, "chat_ended", reason)
			return
		case chatItem, ok := <-chatChan:
			if !ok {
				chatChan = nil
				continue
			}
			runtime.EventsEmit(a.ctx, "chat_message", withPlatform("youtube", chatItem))
		case err, ok := <-errorChan:
			if !ok {
				errorChan = nil
				continue
			}
			if err == nil {
				continue
			}
			runtime.EventsEmit(a.ctx, "chat_error", err.Error())
		}

		if startChan == nil && chatChan == nil && errorChan == nil {
			return
		}
	}
}
