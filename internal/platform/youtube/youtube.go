package youtube

import (
	"context"
	"errors"
	"strings"
	"sync"

	youtubechat "github.com/DiegPS/youtube-chat"
	"github.com/DiegPS/youtube-chat/types"

	"airchat/internal/chat"
)

const pollIntervalMs = 1000

// Connector opens YouTube live-chat sessions.
type Connector struct{}

// Platform implements chat.Connector.
func (Connector) Platform() chat.Platform { return chat.YouTube }

// Connect implements chat.Connector.
func (Connector) Connect(ctx context.Context, input string, sink chat.Sink) (chat.Session, error) {
	id, err := ParseInput(input)
	if err != nil {
		return nil, err
	}
	lc, err := youtubechat.NewLiveChat(id, pollIntervalMs)
	if err != nil {
		return nil, err
	}

	// Cancelling ctx also interrupts a stream lookup that is still running.
	finished := make(chan struct{})
	defer close(finished)
	go func() {
		select {
		case <-ctx.Done():
			lc.Stop("cancelled")
		case <-finished:
		}
	}()

	if err := lc.Start(); err != nil {
		return nil, err
	}
	return &session{lc: lc, sink: sink}, nil
}

type session struct {
	lc   *youtubechat.LiveChat
	sink chat.Sink
	once sync.Once
}

// Close implements chat.Session.
func (s *session) Close() {
	s.once.Do(func() { s.lc.Stop("session closed") })
}

// Run implements chat.Session. It returns nil when the stream's chat ended or
// the session was closed, and an error when polling gave up.
func (s *session) Run(ctx context.Context) error {
	for {
		select {
		case <-ctx.Done():
			return nil
		case liveID := <-s.lc.StartChan:
			s.sink.Started(liveID)
		case item := <-s.lc.ChatChan:
			s.sink.Message(toMessage(item))
		case err := <-s.lc.ErrorChan:
			s.sink.Warning(err)
		case reason := <-s.lc.EndChan:
			if strings.HasPrefix(reason, youtubechat.EndTooManyErrors) {
				return errors.New("youtube chat stopped: " + reason)
			}
			return nil
		}
	}
}

func toMessage(item types.ChatItem) chat.Message {
	author := chat.Author{
		Name:      item.Author.Name,
		ChannelID: item.Author.ChannelID,
		Thumbnail: chat.Image{Alt: item.Author.Name},
	}
	if t := item.Author.Thumbnail; t != nil {
		author.Thumbnail = chat.Image{URL: t.URL, Alt: t.Alt}
	}
	if b := item.Author.Badge; b != nil {
		author.Badge = &chat.Badge{
			Label:     b.Label,
			Thumbnail: chat.Image{URL: b.Thumbnail.URL, Alt: b.Thumbnail.Alt},
		}
	}

	parts := make([]chat.Part, 0, len(item.Message))
	for _, p := range item.Message {
		part := chat.Part{Text: p.Text}
		if e := p.EmojiItem; e != nil {
			part.EmojiItem = &chat.Emoji{URL: e.URL, Alt: e.Alt, EmojiText: e.EmojiText, IsCustomEmoji: e.IsCustomEmoji}
		}
		parts = append(parts, part)
	}

	var superChat *chat.SuperChat
	if sc := item.SuperChat; sc != nil {
		superChat = &chat.SuperChat{Amount: sc.Amount, Color: sc.Color}
		if sc.Sticker != nil {
			superChat.Sticker = &chat.Image{URL: sc.Sticker.URL, Alt: sc.Sticker.Alt}
		}
	}

	return chat.Message{
		Platform:     chat.YouTube,
		ID:           item.ID,
		Author:       author,
		Message:      parts,
		SuperChat:    superChat,
		IsMembership: item.IsMembership,
		IsVerified:   item.IsVerified,
		IsOwner:      item.IsOwner,
		IsModerator:  item.IsModerator,
		Timestamp:    item.Timestamp,
	}
}
