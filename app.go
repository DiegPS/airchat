package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"syscall"

	youtubechat "github.com/DiegPS/youtube-chat"
	"github.com/DiegPS/youtube-chat/types"
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

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	// Force transparency on Windows
	a.hwnd = win.FindWindow(nil, syscall.StringToUTF16Ptr("airchat"))
	if a.hwnd != 0 {
		win.SetWindowLong(a.hwnd, win.GWL_EXSTYLE, win.GetWindowLong(a.hwnd, win.GWL_EXSTYLE)|win.WS_EX_LAYERED)
	}
}

// SetClickThrough enables or disables mouse passthrough on the window
func (a *App) SetClickThrough(enabled bool) {
	if a.hwnd == 0 {
		return
	}
	currStyle := win.GetWindowLong(a.hwnd, win.GWL_EXSTYLE)
	if enabled {
		// Add WS_EX_TRANSPARENT style
		win.SetWindowLong(a.hwnd, win.GWL_EXSTYLE, currStyle|win.WS_EX_TRANSPARENT)
	} else {
		// Remove WS_EX_TRANSPARENT style
		win.SetWindowLong(a.hwnd, win.GWL_EXSTYLE, currStyle&^win.WS_EX_TRANSPARENT)
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
