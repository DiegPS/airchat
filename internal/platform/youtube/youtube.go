package youtube

import (
	"context"
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
func (Connector) Connect(_ context.Context, input string, sink chat.Sink) (chat.Session, error) {
	id, err := ParseInput(input)
	if err != nil {
		return nil, err
	}
	lc, err := youtubechat.NewLiveChat(id, pollIntervalMs)
	if err != nil {
		return nil, err
	}
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

// Run implements chat.Session. Channels the library closes are disabled
// instead of being read as zero values.
func (s *session) Run(ctx context.Context) error {
	start, end, items, errs := s.lc.StartChan, s.lc.EndChan, s.lc.ChatChan, s.lc.ErrorChan

	for start != nil || items != nil || errs != nil {
		select {
		case <-ctx.Done():
			return nil
		case liveID, ok := <-start:
			if !ok {
				start = nil
				continue
			}
			s.sink.Started(liveID)
		case _, ok := <-end:
			if !ok {
				end = nil
				continue
			}
			return nil
		case item, ok := <-items:
			if !ok {
				items = nil
				continue
			}
			s.sink.Message(toMessage(item))
		case err, ok := <-errs:
			if !ok {
				errs = nil
				continue
			}
			s.sink.Warning(err)
		}
	}
	return nil
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
