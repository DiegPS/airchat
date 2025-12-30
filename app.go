package main

import (
	"context"
	"fmt"
	"sync"

	"github.com/DiegPS/youtube-chat"
	"github.com/DiegPS/youtube-chat/types"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx        context.Context
	lc         *youtubechat.LiveChat
	lcMu       sync.Mutex
	stopSignal chan struct{}
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
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
