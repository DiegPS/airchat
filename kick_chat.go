package main

import (
	"fmt"
	"regexp"

	kickchat "github.com/DiegPS/kick-chat"
)

var kickEmoteRe = regexp.MustCompile(`\[emote:(\d+):([^\]]+)\]`)

// parseKickMessage converts Kick message content (which embeds emotes as
// [emote:id:name] tokens) into the unified []twitchMessagePart shape that
// the frontend already knows how to render.
func parseKickMessage(content string, _ []kickchat.ParsedEmote) []twitchMessagePart {
	var parts []twitchMessagePart
	last := 0

	for _, m := range kickEmoteRe.FindAllStringSubmatchIndex(content, -1) {
		if m[0] > last {
			parts = append(parts, twitchMessagePart{"Text": content[last:m[0]]})
		}
		id := content[m[2]:m[3]]
		name := content[m[4]:m[5]]
		parts = append(parts, twitchMessagePart{
			"Text": "",
			"EmojiItem": map[string]interface{}{
				"URL":           fmt.Sprintf("https://files.kick.com/emotes/%s/fullsize", id),
				"Alt":           name,
				"EmojiText":     name,
				"IsCustomEmoji": true,
			},
		})
		last = m[1]
	}

	if last < len(content) {
		parts = append(parts, twitchMessagePart{"Text": content[last:]})
	}
	if len(parts) == 0 {
		return []twitchMessagePart{{"Text": content}}
	}
	return parts
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
