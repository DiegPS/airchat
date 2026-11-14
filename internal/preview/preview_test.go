package preview

import (
	"context"
	"testing"
	"time"

	"airchat/internal/chat"
)

func TestMessagesCoverEveryPlatformAndHaveValidShape(t *testing.T) {
	msgs := Messages(time.Now())
	seen := map[chat.Platform]bool{}
	ids := map[string]bool{}

	for _, m := range msgs {
		seen[m.Platform] = true
		if m.ID == "" || m.Author.Name == "" || len(m.Message) == 0 {
			t.Errorf("incomplete preview message: %+v", m)
		}
		if ids[m.ID] {
			t.Errorf("duplicate preview ID %q: the frontend would drop it", m.ID)
		}
		ids[m.ID] = true
	}
	for _, p := range []chat.Platform{chat.YouTube, chat.Twitch, chat.Kick} {
		if !seen[p] {
			t.Errorf("no preview message for %s", p)
		}
	}
}

func TestPlayStopsWhenContextIsCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	count := 0
	emit := chat.EmitterFunc(func(string, any) {
		count++
		cancel()
	})

	Play(ctx, emit, Messages(time.Now()), time.Hour)
	if count != 1 {
		t.Fatalf("emitted %d messages after cancel, want 1", count)
	}
}
