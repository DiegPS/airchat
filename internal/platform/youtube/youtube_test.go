package youtube

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	youtubechat "github.com/DiegPS/youtube-chat"
	"github.com/DiegPS/youtube-chat/types"

	"airchat/internal/chat"
)

func TestToMessageMapsEverything(t *testing.T) {
	ts := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	item := types.ChatItem{
		ID: "m1",
		Author: types.Author{
			Name:      "Ana",
			ChannelID: "UC1",
			Thumbnail: &types.ImageItem{URL: "http://a/1.png", Alt: "Ana"},
			Badge:     &types.Badge{Label: "6 months", Thumbnail: types.ImageItem{URL: "http://b/1.png", Alt: "6m"}},
		},
		Message: []types.MessageItem{
			{Text: "hola "},
			{EmojiItem: &types.EmojiItem{ImageItem: types.ImageItem{URL: "http://e/1.png", Alt: ":x:"}, EmojiText: ":x:", IsCustomEmoji: true}},
		},
		SuperChat:    &types.SuperChat{Amount: "$5.00", Color: "1DE9B6"},
		IsMembership: true,
		IsModerator:  true,
		Timestamp:    ts,
	}

	got := toMessage(item)

	if got.Platform != chat.YouTube || got.ID != "m1" || !got.IsMembership || !got.IsModerator || got.IsOwner {
		t.Fatalf("flags not mapped: %+v", got)
	}
	if got.Author.Thumbnail.URL != "http://a/1.png" || got.Author.Badge == nil || got.Author.Badge.Label != "6 months" {
		t.Fatalf("author not mapped: %+v", got.Author)
	}
	if len(got.Message) != 2 || got.Message[0].Text != "hola " || got.Message[1].EmojiItem == nil || !got.Message[1].EmojiItem.IsCustomEmoji {
		t.Fatalf("parts not mapped: %+v", got.Message)
	}
	if got.SuperChat == nil || got.SuperChat.Amount != "$5.00" || got.SuperChat.Color != "1DE9B6" {
		t.Fatalf("super chat not mapped: %+v", got.SuperChat)
	}
	if !got.Timestamp.Equal(ts) {
		t.Fatalf("timestamp = %v", got.Timestamp)
	}
}

func TestToMessageToleratesMissingThumbnailAndEmptyMessage(t *testing.T) {
	got := toMessage(types.ChatItem{ID: "m2", Author: types.Author{Name: "Bob"}})
	if got.Author.Thumbnail.Alt != "Bob" || got.Author.Thumbnail.URL != "" {
		t.Fatalf("thumbnail fallback: %+v", got.Author.Thumbnail)
	}
	if got.Message == nil {
		t.Fatal("Message must be a non-nil slice so the frontend never sees null")
	}
}

func TestMessageJSONShapeMatchesFrontendContract(t *testing.T) {
	raw, err := json.Marshal(toMessage(types.ChatItem{ID: "m3", Author: types.Author{Name: "C"}}))
	if err != nil {
		t.Fatal(err)
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"Platform", "ID", "Author", "Message", "IsMembership", "IsVerified", "IsOwner", "IsModerator", "Timestamp"} {
		if _, ok := m[key]; !ok {
			t.Errorf("missing key %q in %s", key, raw)
		}
	}
	if m["Platform"] != "youtube" {
		t.Errorf("Platform = %v", m["Platform"])
	}
	if _, ok := m["SuperChat"]; ok {
		t.Errorf("SuperChat must be omitted when absent: %s", raw)
	}
}

// ── session behavior with a scripted LiveChat ────────────────────────────────

type recordingSink struct {
	mu       sync.Mutex
	started  []string
	messages []chat.Message
	warnings []error
}

func (r *recordingSink) Message(m chat.Message) {
	r.mu.Lock()
	r.messages = append(r.messages, m)
	r.mu.Unlock()
}
func (r *recordingSink) Started(d string) {
	r.mu.Lock()
	r.started = append(r.started, d)
	r.mu.Unlock()
}
func (r *recordingSink) Warning(e error) {
	r.mu.Lock()
	r.warnings = append(r.warnings, e)
	r.mu.Unlock()
}

func startSession(t *testing.T, poll func(context.Context, types.FetchOptions) ([]types.ChatItem, string, error)) (*session, *recordingSink) {
	t.Helper()
	lc, err := youtubechat.NewLiveChat(types.YoutubeId{LiveID: "abc"}, 1)
	if err != nil {
		t.Fatal(err)
	}
	lc.FetchLivePageFunc = func(context.Context, types.YoutubeId) (types.FetchOptions, error) {
		return types.FetchOptions{LiveID: "live-1", Continuation: "c"}, nil
	}
	lc.FetchChatFunc = poll
	if err := lc.Start(); err != nil {
		t.Fatal(err)
	}
	sink := &recordingSink{}
	s := &session{lc: lc, sink: sink}
	t.Cleanup(s.Close)
	return s, sink
}

func runWithTimeout(t *testing.T, s *session) error {
	t.Helper()
	done := make(chan error, 1)
	go func() { done <- s.Run(context.Background()) }()
	select {
	case err := <-done:
		return err
	case <-time.After(30 * time.Second):
		t.Fatal("Run did not return")
	}
	return nil
}

func TestSessionForwardsStartMessagesAndEndsCleanlyWhenChatEnds(t *testing.T) {
	var calls atomic.Int32
	s, sink := startSession(t, func(context.Context, types.FetchOptions) ([]types.ChatItem, string, error) {
		if calls.Add(1) == 1 {
			return []types.ChatItem{{ID: "m1", Author: types.Author{Name: "Ana"}, Message: []types.MessageItem{{Text: "hi"}}}}, "next", nil
		}
		return nil, "", nil // the chat is over
	})

	if err := runWithTimeout(t, s); err != nil {
		t.Fatalf("a chat that ended normally must not be an error: %v", err)
	}
	sink.mu.Lock()
	defer sink.mu.Unlock()
	if len(sink.started) != 1 || sink.started[0] != "live-1" {
		t.Fatalf("started = %v", sink.started)
	}
	if len(sink.messages) != 1 || sink.messages[0].ID != "m1" || sink.messages[0].Platform != chat.YouTube {
		t.Fatalf("messages = %+v", sink.messages)
	}
}

func TestSessionReportsTransientErrorsAsWarnings(t *testing.T) {
	var calls atomic.Int32
	s, sink := startSession(t, func(context.Context, types.FetchOptions) ([]types.ChatItem, string, error) {
		switch calls.Add(1) {
		case 1:
			return nil, "", errors.New("transient")
		case 2:
			return nil, "next", nil
		default:
			return nil, "", nil
		}
	})
	if err := runWithTimeout(t, s); err != nil {
		t.Fatalf("Run error: %v", err)
	}
	sink.mu.Lock()
	defer sink.mu.Unlock()
	if len(sink.warnings) != 1 || sink.warnings[0].Error() != "transient" {
		t.Fatalf("warnings = %v", sink.warnings)
	}
}

func TestSessionReturnsErrorWhenPollingGivesUp(t *testing.T) {
	s, _ := startSession(t, func(context.Context, types.FetchOptions) ([]types.ChatItem, string, error) {
		return nil, "", errors.New("down")
	})
	err := runWithTimeout(t, s)
	if err == nil || !strings.Contains(err.Error(), "down") {
		t.Fatalf("err = %v, want the failure to be reported", err)
	}
}

func TestSessionStopsWhenClosed(t *testing.T) {
	s, _ := startSession(t, func(context.Context, types.FetchOptions) ([]types.ChatItem, string, error) {
		return nil, "next", nil
	})
	done := make(chan error, 1)
	go func() { done <- s.Run(context.Background()) }()
	time.Sleep(50 * time.Millisecond)
	s.Close()
	s.Close() // idempotent

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("closing is not an error: %v", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("Run did not stop after Close")
	}
}
