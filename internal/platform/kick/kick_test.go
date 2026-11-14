package kick

import (
	"testing"
	"time"

	kickchat "github.com/DiegPS/kick-chat"

	"airchat/internal/chat"
)

func TestRoles(t *testing.T) {
	owner, mod, sub, verified := roles([]kickchat.Badge{
		{Type: "broadcaster"}, {Type: "moderator"}, {Type: "sub_gifter"}, {Type: "verified"}, {Type: "og"},
	})
	if !owner || !mod || !sub || !verified {
		t.Fatalf("roles = %v %v %v %v", owner, mod, sub, verified)
	}

	owner, mod, sub, verified = roles(nil)
	if owner || mod || sub || verified {
		t.Fatal("no badges must give no roles")
	}
}

func TestToMessageParsesEmotes(t *testing.T) {
	content := "hola [emote:37225:KEKLEO] mundo"
	ts := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	got := toMessage(kickchat.ChatMessage{
		ID:        "k1",
		CreatedAt: ts,
		Sender: kickchat.Sender{
			ID: 42, Username: "ana",
			Identity: kickchat.Identity{Badges: []kickchat.Badge{{Type: "subscriber"}}},
		},
		Parts: kickchat.ParseMessage(content),
	})

	if got.Platform != chat.Kick || got.ID != "k1" || got.Author.ChannelID != "42" || !got.IsMembership {
		t.Fatalf("unexpected message: %+v", got)
	}
	if len(got.Message) != 3 {
		t.Fatalf("parts = %+v", got.Message)
	}
	emote := got.Message[1].EmojiItem
	if emote == nil || emote.EmojiText != "KEKLEO" || emote.URL != "https://files.kick.com/emotes/37225/fullsize" || !emote.IsCustomEmoji {
		t.Fatalf("emote = %+v", emote)
	}
	if got.Message[0].Text != "hola " || got.Message[2].Text != " mundo" {
		t.Fatalf("text parts = %+v", got.Message)
	}
	if !got.Timestamp.Equal(ts) {
		t.Fatalf("timestamp = %v", got.Timestamp)
	}
}

func TestPartsNeverNil(t *testing.T) {
	if parts(nil) == nil {
		t.Fatal("parts must be non-nil so the frontend never receives null")
	}
}
