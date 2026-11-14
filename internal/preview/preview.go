// Package preview produces sample messages that exercise the whole render
// pipeline (Go -> event -> frontend) without connecting to any platform.
package preview

import (
	"context"
	"time"

	"airchat/internal/chat"
)

// Messages returns one sample message per interesting case on each platform.
func Messages(now time.Time) []chat.Message {
	avatar := func(seed string) chat.Image {
		return chat.Image{URL: "https://i.pravatar.cc/100?u=" + seed, Alt: seed}
	}
	noAvatar := func(alt string) chat.Image { return chat.Image{Alt: alt} }
	badge := func(label, seed string) *chat.Badge {
		return &chat.Badge{Label: label, Thumbnail: chat.Image{URL: "https://i.pravatar.cc/20?u=" + seed, Alt: label}}
	}

	type roles struct{ owner, mod, member, verified bool }
	msg := func(platform chat.Platform, id, name, channel string, thumb chat.Image, r roles, parts ...chat.Part) chat.Message {
		return chat.Message{
			Platform:     platform,
			ID:           id,
			Author:       chat.Author{Name: name, ChannelID: channel, Thumbnail: thumb},
			Message:      parts,
			IsOwner:      r.owner,
			IsModerator:  r.mod,
			IsMembership: r.member,
			IsVerified:   r.verified,
			Timestamp:    now,
		}
	}
	text := chat.Text
	emote := chat.Emote

	youtubeMember := msg(chat.YouTube, "p3", "MiembroFiel", "C", avatar("yt-member"), roles{member: true}, text("🟢 Miembro 6 meses"))
	youtubeMember.Author.Badge = badge("6 meses", "badge")

	youtubeSuper := msg(chat.YouTube, "p4", "SuperDonador", "D", avatar("yt-super"), roles{}, text("💰 Super Chat de YouTube"))
	youtubeSuper.SuperChat = &chat.SuperChat{Amount: "$4.99", Color: "1DE9B6"}

	youtubeAll := msg(chat.YouTube, "p4b", "ModMiembroDonador", "D2", avatar("yt-mod-member-super"), roles{mod: true, member: true}, text("Soy mod, miembro y tambien dono"))
	youtubeAll.Author.Badge = badge("12 meses", "badge-super")
	youtubeAll.SuperChat = &chat.SuperChat{Amount: "$20.00", Color: "00BFA5"}

	return []chat.Message{
		msg(chat.YouTube, "p1", "ElStreamer", "A", avatar("yt-owner"), roles{owner: true}, text("📺 Mensaje del dueño del canal (YouTube)")),
		msg(chat.YouTube, "p2", "ModYT", "B", avatar("yt-mod"), roles{mod: true}, text("🛡️ Moderador de YouTube")),
		youtubeMember,
		youtubeSuper,
		youtubeAll,

		msg(chat.Twitch, "p5", "ElStreamerTwitch", "E", noAvatar("E"), roles{owner: true},
			text("🟣 Broadcaster "),
			emote("https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/1.0", "Kappa", false)),
		msg(chat.Twitch, "p6", "ModTwitch", "F", noAvatar("M"), roles{mod: true},
			text("BTTV emote: "),
			emote("https://cdn.betterttv.net/emote/566ca04265dbbdab32ec054a/1x", "KKona", true)),
		msg(chat.Twitch, "p7", "SubTwitch", "G", noAvatar("S"), roles{member: true},
			text("Mix BTTV+7TV: "),
			emote("https://cdn.betterttv.net/emote/555981336ba1901877765555/1x", "haHAA", true),
			text(" "),
			emote("https://cdn.7tv.app/emote/01FE3XY508000AA32JP519W2EW/1x.webp", "PETPET", true)),
		msg(chat.Twitch, "p8", "ViewerTwitch", "H", noAvatar("V"), roles{}, text("👾 Viewer normal — sin foto de perfil")),

		msg(chat.Kick, "p9", "StreamerKick", "I", noAvatar("K"), roles{owner: true, verified: true}, text("Kick broadcaster message")),
		msg(chat.Kick, "p10", "ModKick", "J", noAvatar("M"), roles{mod: true}, text("Kick moderator checking chat")),
		msg(chat.Kick, "p11", "SubKick", "K", noAvatar("S"), roles{member: true},
			text("Kick sub emote: "),
			emote("https://files.kick.com/emotes/37217/fullsize", "KEKW", true)),
		msg(chat.Kick, "p12", "ViewerKick", "L", noAvatar("V"), roles{}, text("Viewer normal desde Kick")),
	}
}

// Play emits messages one by one, spaced by delay, until done or ctx ends.
func Play(ctx context.Context, emit chat.Emitter, messages []chat.Message, delay time.Duration) {
	for _, m := range messages {
		select {
		case <-ctx.Done():
			return
		default:
		}
		emit.Emit(chat.EventMessage, m)
		select {
		case <-ctx.Done():
			return
		case <-time.After(delay):
		}
	}
}
