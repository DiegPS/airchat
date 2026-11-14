package twitch

import (
	"reflect"
	"testing"

	twitchirc "github.com/gempir/go-twitch-irc/v3"

	"airchat/internal/chat"
)

func emoteParts(parts []chat.Part) (texts []string, emotes []string) {
	for _, p := range parts {
		if p.EmojiItem != nil {
			emotes = append(emotes, p.EmojiItem.EmojiText)
		} else {
			texts = append(texts, p.Text)
		}
	}
	return
}

func TestParseMessagePlainText(t *testing.T) {
	got := parseMessage("hello world", nil, emoteMap{})
	if len(got) != 1 || got[0].Text != "hello world" || got[0].EmojiItem != nil {
		t.Fatalf("got %+v", got)
	}
}

func TestParseMessageNativeEmoteRepeated(t *testing.T) {
	// "Kappa hi Kappa": one IRC entry, two positions.
	ircEmotes := []*twitchirc.Emote{{
		Name: "Kappa", ID: "25", Count: 2,
		Positions: []twitchirc.EmotePosition{{Start: 0, End: 4}, {Start: 9, End: 13}},
	}}
	got := parseMessage("Kappa hi Kappa", ircEmotes, emoteMap{})

	texts, emotes := emoteParts(got)
	if !reflect.DeepEqual(emotes, []string{"Kappa", "Kappa"}) {
		t.Fatalf("emotes = %v", emotes)
	}
	if !reflect.DeepEqual(texts, []string{" hi "}) {
		t.Fatalf("texts = %q", texts)
	}
	if got[0].EmojiItem.IsCustomEmoji {
		t.Fatal("native emote must not be flagged custom")
	}
	if want := "https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/1.0"; got[0].EmojiItem.URL != want {
		t.Fatalf("url = %s", got[0].EmojiItem.URL)
	}
}

func TestParseMessageThirdPartyEmote(t *testing.T) {
	third := emoteMap{"KKona": "https://cdn.example/kkona.png"}
	got := parseMessage("hola KKona amigo", nil, third)

	texts, emotes := emoteParts(got)
	if !reflect.DeepEqual(emotes, []string{"KKona"}) {
		t.Fatalf("emotes = %v", emotes)
	}
	if !reflect.DeepEqual(texts, []string{"hola ", " amigo"}) {
		t.Fatalf("texts = %q", texts)
	}
	if !got[1].EmojiItem.IsCustomEmoji {
		t.Fatal("third-party emote must be flagged custom")
	}
}

func TestParseMessageUsesRunePositions(t *testing.T) {
	// IRC positions count code points, not bytes: 🎉 is one rune.
	ircEmotes := []*twitchirc.Emote{{
		Name: "Kappa", ID: "25", Count: 1,
		Positions: []twitchirc.EmotePosition{{Start: 4, End: 8}},
	}}
	got := parseMessage("🎉 a Kappa", ircEmotes, emoteMap{})

	texts, emotes := emoteParts(got)
	if !reflect.DeepEqual(emotes, []string{"Kappa"}) || !reflect.DeepEqual(texts, []string{"🎉 a "}) {
		t.Fatalf("texts = %q emotes = %v", texts, emotes)
	}
}

func TestParseMessageIgnoresBadPositions(t *testing.T) {
	ircEmotes := []*twitchirc.Emote{{
		Name: "Kappa", ID: "25", Count: 2,
		Positions: []twitchirc.EmotePosition{{Start: 50, End: 54}, {Start: 0, End: 100}},
	}}
	got := parseMessage("short", ircEmotes, emoteMap{})
	if len(got) != 1 || got[0].Text != "short" {
		t.Fatalf("got %+v", got)
	}
}

func TestParseMessageOverlappingPositionsDoNotPanic(t *testing.T) {
	ircEmotes := []*twitchirc.Emote{{
		Name: "A", ID: "1", Count: 2,
		Positions: []twitchirc.EmotePosition{{Start: 0, End: 5}, {Start: 2, End: 4}},
	}}
	_ = parseMessage("abcdefghij", ircEmotes, emoteMap{})
}
