// Package twitch connects anonymously to Twitch IRC and parses native plus
// BTTV / FFZ / 7TV emotes.
package twitch

import (
	"context"
	"sync"

	twitchirc "github.com/gempir/go-twitch-irc/v3"

	"airchat/internal/chat"
)

// Connector opens Twitch chat sessions. It is cheap to create and keeps the
// third-party emote cache shared between sessions.
type Connector struct {
	emotes emoteStore
}

// Events implements chat.Connector.
func (*Connector) Events() chat.Events {
	return chat.Events{Started: "twitch_started", Ended: "twitch_ended", Error: "twitch_error"}
}

// Connect implements chat.Connector.
func (c *Connector) Connect(ctx context.Context, input string, sink chat.Sink) (chat.Session, error) {
	channel, err := chat.NormalizeChannel(input)
	if err != nil {
		return nil, err
	}

	client := twitchirc.NewAnonymousClient()
	client.OnPrivateMessage(func(msg twitchirc.PrivateMessage) {
		sink.Message(c.toMessage(msg))
	})
	client.OnConnect(func() {
		sink.Started(channel)
		// A failed emote fetch only affects emote display, never the chat.
		go func() {
			m := buildEmoteMap()
			if ctx.Err() == nil {
				c.emotes.set(m)
			}
		}()
	})
	client.Join(channel)

	return &session{client: client}, nil
}

func (c *Connector) toMessage(msg twitchirc.PrivateMessage) chat.Message {
	third := c.emotes.get()
	if third == nil {
		third = emoteMap{}
	}
	return chat.Message{
		Platform: chat.Twitch,
		ID:       msg.ID,
		Author: chat.Author{
			Name:      msg.User.DisplayName,
			ChannelID: msg.User.ID,
			Thumbnail: chat.Image{Alt: msg.User.DisplayName},
		},
		Message:      parseMessage(msg.Message, msg.Emotes, third),
		IsMembership: msg.User.Badges["subscriber"] > 0 || msg.User.Badges["founder"] > 0,
		IsOwner:      msg.User.Badges["broadcaster"] > 0,
		IsModerator:  msg.User.Badges["moderator"] > 0,
		Timestamp:    msg.Time,
	}
}

type session struct {
	client *twitchirc.Client
	once   sync.Once
}

// Close implements chat.Session.
func (s *session) Close() {
	s.once.Do(func() { _ = s.client.Disconnect() })
}

// Run implements chat.Session. client.Connect blocks until Disconnect.
func (s *session) Run(ctx context.Context) error {
	done := make(chan struct{})
	defer close(done)
	go func() {
		select {
		case <-ctx.Done():
			s.Close()
		case <-done:
		}
	}()

	err := s.client.Connect()
	if ctx.Err() != nil {
		return nil // disconnected on purpose
	}
	return err
}
