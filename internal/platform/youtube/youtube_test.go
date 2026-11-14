package youtube

import (
	"encoding/json"
	"testing"
	"time"

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
