// Package chat defines the platform-independent chat model and the lifecycle
// machinery shared by every platform adapter (YouTube, Twitch, Kick).
package chat

import "time"

// Platform identifies the origin of a message.
type Platform string

const (
	YouTube Platform = "youtube"
	Twitch  Platform = "twitch"
	Kick    Platform = "kick"
)

// EventMessage is the Wails event every platform uses to deliver messages.
const EventMessage = "chat_message"

// Image is a remote picture (avatar, badge, sticker).
type Image struct {
	URL string
	Alt string
}

// Emoji is an inline image inside a message.
type Emoji struct {
	URL           string
	Alt           string
	EmojiText     string
	IsCustomEmoji bool
}

// Part is one segment of a message: plain text or an emoji/emote.
type Part struct {
	Text      string
	EmojiItem *Emoji `json:",omitempty"`
}

// Badge is a membership badge shown next to an author.
type Badge struct {
	Thumbnail Image
	Label     string
}

// Author is the sender of a message.
type Author struct {
	Name      string
	Thumbnail Image
	ChannelID string
	Badge     *Badge `json:",omitempty"`
}

// SuperChat carries paid-message data (YouTube only).
// Color is an AARRGGBB hex string without '#'.
type SuperChat struct {
	Amount  string
	Color   string
	Sticker *Image `json:",omitempty"`
}

// Message is the unified message every platform emits to the frontend.
// Field names are part of the frontend contract (see frontend/src/types.ts).
type Message struct {
	Platform     Platform
	ID           string
	Author       Author
	Message      []Part
	SuperChat    *SuperChat `json:",omitempty"`
	IsMembership bool
	IsVerified   bool
	IsOwner      bool
	IsModerator  bool
	Timestamp    time.Time
}

// Text builds a plain-text part.
func Text(s string) Part { return Part{Text: s} }

// Emote builds an emote part.
func Emote(url, name string, custom bool) Part {
	return Part{EmojiItem: &Emoji{URL: url, Alt: name, EmojiText: name, IsCustomEmoji: custom}}
}
