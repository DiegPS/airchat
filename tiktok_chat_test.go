package main

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/PirateTok/live-go/events"
	"github.com/PirateTok/live-go/helpers"
	pb "github.com/PirateTok/live-go/proto"
)

func TestNormalizeTikTokUsername(t *testing.T) {
	tests := map[string]string{
		"creator":                          "creator",
		" @creator ":                       "creator",
		"https://www.tiktok.com/@creator":  "creator",
		"https://tiktok.com/@creator/live": "creator",
	}
	for input, want := range tests {
		got, err := normalizeTikTokUsername(input)
		if err != nil {
			t.Fatalf("normalizeTikTokUsername(%q): %v", input, err)
		}
		if got != want {
			t.Fatalf("normalizeTikTokUsername(%q) = %q, want %q", input, got, want)
		}
	}
	for _, input := range []string{"", "https://example.com/@creator", "bad/name", "@"} {
		if _, err := normalizeTikTokUsername(input); err == nil {
			t.Fatalf("normalizeTikTokUsername(%q) should fail", input)
		}
	}
}

func TestEveryPirateTokEventHasDescriptor(t *testing.T) {
	for eventType := events.EventConnected; eventType <= events.EventUnknown; eventType++ {
		desc := describeTikTokEvent(eventType)
		if desc.Name == "" || desc.Category == "" || strings.HasPrefix(desc.Name, "event_") {
			t.Fatalf("event type %d is not explicitly described: %#v", eventType, desc)
		}
	}
}

func TestTikTokRolesUseIdentityAndUserFallbacks(t *testing.T) {
	user := &pb.User{
		Verified:    true,
		IsSubscribe: true,
		UserAttr:    &pb.User_UserAttr{IsAdmin: true},
	}
	identity := &pb.UserIdentity{IsAnchor: true, IsModeratorOfAnchor: false, IsSubscriberOfAnchor: false}
	owner, mod, sub, verified := tiktokRoles(user, identity)
	if !owner || !mod || !sub || !verified {
		t.Fatalf("unexpected roles owner=%v mod=%v sub=%v verified=%v", owner, mod, sub, verified)
	}
}

func TestTikTokUserMetadataSupportsAudienceFilters(t *testing.T) {
	user := &pb.User{
		UniqueId:    "viewer_1",
		IsFollower:  true,
		PayGrade:    &pb.User_PayGrade{Level: 24},
		FansClub:    &pb.User_FansClub{Data: &pb.User_FansClub_FansClubData{Level: 7}},
		IsSubscribe: true,
		UserAttr:    &pb.User_UserAttr{IsAdmin: true},
	}
	meta := tiktokUserMeta(user, &pb.UserIdentity{IsAnchor: true})
	if meta["UniqueID"] != "viewer_1" || meta["GifterLevel"] != int64(24) || meta["FanClubLevel"] != int32(7) {
		t.Fatalf("unexpected numeric metadata: %#v", meta)
	}
	for _, key := range []string{"IsFollower", "IsSubscriber", "IsModerator", "IsAnchor"} {
		if meta[key] != true {
			t.Fatalf("%s should be true: %#v", key, meta)
		}
	}
}

func TestTikTokGenerationInvalidatesStoppedSessions(t *testing.T) {
	_, cancel := context.WithCancel(context.Background())
	app := &App{tiktokCancel: cancel, tiktokGeneration: 4}
	if !app.isTikTokGenerationCurrent(4) {
		t.Fatal("active generation should be current")
	}
	app.StopTikTokChat()
	if app.isTikTokGenerationCurrent(4) || app.tiktokGeneration != 5 {
		t.Fatalf("stopped generation remained active: %d", app.tiktokGeneration)
	}
}

func TestTikTokInitialRetryDelayIsShortAndBounded(t *testing.T) {
	tests := map[int]time.Duration{
		0: 1 * time.Second,
		1: 1 * time.Second,
		3: 3 * time.Second,
		8: 5 * time.Second,
	}
	for attempt, want := range tests {
		if got := tiktokInitialRetryDelay(attempt); got != want {
			t.Fatalf("attempt %d delay = %v, want %v", attempt, got, want)
		}
	}
}

func TestTikTokIndexedMessagePreservesUnicodeTextAndEmote(t *testing.T) {
	content := "A🌎B"
	parts := tiktokIndexedMessageParts(content, []*pb.WebcastChatMessage_EmoteWithIndex{{
		Index: 1,
		Emote: &pb.Emote{EmoteId: "wave", Image: &pb.Image{UrlList: []string{"https://example.test/wave.png"}}},
	}})
	var textOnly strings.Builder
	emotes := 0
	for _, part := range parts {
		if text, ok := part["Text"].(string); ok {
			textOnly.WriteString(text)
		}
		if part["EmojiItem"] != nil {
			emotes++
		}
	}
	if textOnly.String() != content {
		t.Fatalf("text was not preserved: %q", textOnly.String())
	}
	if emotes != 1 {
		t.Fatalf("got %d emotes, want 1", emotes)
	}
}

func TestTikTokGiftItemUsesStableComboIDAndTotals(t *testing.T) {
	tracker := helpers.NewGiftStreakTracker()
	msg := &pb.WebcastGiftMessage{
		Common:      &pb.Common{MsgId: 99, CreateTime: 1_700_000_000_000},
		GroupId:     77,
		RepeatCount: 3,
		RepeatEnd:   0,
		User:        &pb.User{Nickname: "Gifter", IdStr: "10"},
		Gift:        &pb.GiftStruct{Name: "Rose", Type: 1, DiamondCount: 2},
	}
	event := TikTokEventPayload{ID: "99", Type: "gift", Category: "gift", Timestamp: tiktokTimestamp(msg.Common.CreateTime)}
	item := tiktokGiftItem(msg, tracker.Process(msg), event)
	if item["ID"] != "gift-streak-77" || item["UpdateExisting"] != true {
		t.Fatalf("combo identity not stable: %#v", item)
	}
	gift := item["Gift"].(map[string]interface{})
	if gift["Count"] != int32(3) || gift["DiamondCount"] != int64(6) {
		t.Fatalf("wrong gift totals: %#v", gift)
	}
}

func TestUnknownEventRetainsSafeExportPayload(t *testing.T) {
	state := &tiktokSessionState{}
	event := events.Event{Type: events.EventUnknown, Data: &events.UnknownEvent{Method: "WebcastFutureMessage", Payload: []byte{1, 2, 3}}}
	payload := makeTikTokEventPayload(event, describeTikTokEvent(event.Type), state)
	if payload.RawPayloadBase64 != "AQID" {
		t.Fatalf("raw payload = %q", payload.RawPayloadBase64)
	}
	if !strings.Contains(payload.Summary, "WebcastFutureMessage") {
		t.Fatalf("summary does not identify method: %q", payload.Summary)
	}
}
