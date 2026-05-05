package main

import (
	kickchat "github.com/DiegPS/kick-chat"
)

// kickMessageItems converts the pre-parsed msg.Parts into the unified
// []twitchMessagePart shape the frontend renders.
func kickMessageItems(parts []kickchat.MessagePart) []twitchMessagePart {
	items := make([]twitchMessagePart, 0, len(parts))
	for _, p := range parts {
		if p.Emote != nil {
			items = append(items, twitchMessagePart{
				"Text": "",
				"EmojiItem": map[string]interface{}{
					"URL":           p.Emote.URL,
					"Alt":           p.Emote.Name,
					"EmojiText":     p.Emote.Name,
					"IsCustomEmoji": true,
				},
			})
		} else {
			items = append(items, twitchMessagePart{"Text": p.Text})
		}
	}
	return items
}

// kickRoles extracts role flags from Kick badges.
func kickRoles(badges []kickchat.Badge) (isOwner, isMod, isSub, isVerified bool) {
	for _, b := range badges {
		switch b.Type {
		case "broadcaster":
			isOwner = true
		case "moderator":
			isMod = true
		case "subscriber", "sub_gifter":
			isSub = true
		case "verified":
			isVerified = true
		}
	}
	return
}
