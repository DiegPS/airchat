// Package kick adapts github.com/DiegPS/kick-chat to the chat model.
package kick

import (
	"context"
	"fmt"
	"sync"

	kickchat "github.com/DiegPS/kick-chat"

	"airchat/internal/chat"
)

// Connector opens Kick chat sessions.
type Connector struct{}

// Platform implements chat.Connector.
func (Connector) Platform() chat.Platform { return chat.Kick }

// Connect implements chat.Connector. The client is only handed to the
// Manager once it has joined the channel, so a failed join never replaces a
// working session.
func (Connector) Connect(ctx context.Context, input string, sink chat.Sink) (chat.Session, error) {
	slug, err := chat.NormalizeChannel(input)
	if err != nil {
		return nil, err
	}

	client, err := kickchat.NewClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("kick: failed to connect: %w", err)
	}
	if err := client.JoinChannelBySlug(slug); err != nil {
		client.Close()
		return nil, err
	}

	sink.Started(slug)
	return &session{client: client, sink: sink}, nil
}

type session struct {
	client *kickchat.Client
	sink   chat.Sink
	once   sync.Once
}

// Close implements chat.Session.
func (s *session) Close() {
	s.once.Do(s.client.Close)
}

// Run implements chat.Session. A closed Messages channel means the client
// shut down; a closed Errors channel is simply ignored from then on.
func (s *session) Run(ctx context.Context) error {
	messages, errs := s.client.Messages(), s.client.Errors()
	for {
		select {
		case <-ctx.Done():
			return nil
		case msg, ok := <-messages:
			if !ok {
				return nil
			}
			s.sink.Message(toMessage(msg))
		case err, ok := <-errs:
			if !ok {
				errs = nil
				continue
			}
			s.sink.Warning(err)
		}
	}
}

func toMessage(msg kickchat.ChatMessage) chat.Message {
	owner, mod, sub, verified := roles(msg.Sender.Identity.Badges)
	return chat.Message{
		Platform: chat.Kick,
		ID:       msg.ID,
		Author: chat.Author{
			Name:      msg.Sender.Username,
			ChannelID: fmt.Sprintf("%d", msg.Sender.ID),
			Thumbnail: chat.Image{Alt: msg.Sender.Username},
		},
		Message:      parts(msg.Parts),
		IsMembership: sub,
		IsVerified:   verified,
		IsOwner:      owner,
		IsModerator:  mod,
		Timestamp:    msg.CreatedAt,
	}
}

// parts converts the library's pre-parsed segments into renderable parts.
func parts(segments []kickchat.MessagePart) []chat.Part {
	out := make([]chat.Part, 0, len(segments))
	for _, p := range segments {
		if p.Emote != nil {
			out = append(out, chat.Emote(p.Emote.URL, p.Emote.Name, true))
		} else {
			out = append(out, chat.Text(p.Text))
		}
	}
	return out
}

// roles extracts role flags from Kick badges.
func roles(badges []kickchat.Badge) (owner, mod, sub, verified bool) {
	for _, b := range badges {
		switch b.Type {
		case "broadcaster":
			owner = true
		case "moderator":
			mod = true
		case "subscriber", "sub_gifter":
			sub = true
		case "verified":
			verified = true
		}
	}
	return
}
