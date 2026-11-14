// Package youtube adapts github.com/DiegPS/youtube-chat to the chat model.
package youtube

import (
	"errors"
	"net/url"
	"regexp"
	"strings"

	"github.com/DiegPS/youtube-chat/types"
)

var videoIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{11}$`)

// ParseInput resolves what the user typed into a YouTube identifier. It
// accepts an @handle, a UC channel ID, a bare video ID, or a watch / live /
// youtu.be / channel URL.
func ParseInput(input string) (types.YoutubeId, error) {
	value := strings.TrimSpace(input)
	if value == "" {
		return types.YoutubeId{}, errors.New("youtube channel or video is required")
	}

	if id, ok := idFromURL(value); ok {
		return id, nil
	}
	if parsed, err := url.Parse(value); err == nil && parsed.Host != "" {
		return types.YoutubeId{}, errors.New("unsupported YouTube input: use @handle, UC channel ID, or YouTube video URL")
	}

	if strings.HasPrefix(value, "watch?") {
		if query, err := url.ParseQuery(strings.TrimPrefix(value, "watch?")); err == nil {
			if videoID := strings.TrimSpace(query.Get("v")); videoID != "" {
				return types.YoutubeId{LiveID: videoID}, nil
			}
		}
	}

	pathValue := strings.Trim(value, "/")
	if strings.HasPrefix(pathValue, "channel/") {
		parts := strings.Split(pathValue, "/")
		if len(parts) >= 2 && strings.TrimSpace(parts[1]) != "" {
			return types.YoutubeId{ChannelID: strings.TrimSpace(parts[1])}, nil
		}
	}

	if strings.HasPrefix(value, "UC") {
		return types.YoutubeId{ChannelID: value}, nil
	}

	if videoIDPattern.MatchString(value) {
		return types.YoutubeId{LiveID: value}, nil
	}

	handle := strings.TrimPrefix(value, "/")
	if !strings.HasPrefix(handle, "@") {
		handle = "@" + handle
	}
	return types.YoutubeId{Handle: handle}, nil
}

func idFromURL(input string) (types.YoutubeId, bool) {
	parsed, err := url.Parse(input)
	if err != nil || parsed.Host == "" {
		return types.YoutubeId{}, false
	}

	host := strings.ToLower(strings.TrimPrefix(parsed.Host, "www."))
	parts := strings.Split(strings.Trim(parsed.Path, "/"), "/")

	if videoID := strings.TrimSpace(parsed.Query().Get("v")); videoID != "" {
		return types.YoutubeId{LiveID: videoID}, true
	}
	if host == "youtu.be" && parts[0] != "" {
		return types.YoutubeId{LiveID: parts[0]}, true
	}
	if len(parts) >= 2 && parts[0] == "channel" && parts[1] != "" {
		return types.YoutubeId{ChannelID: parts[1]}, true
	}
	if strings.HasPrefix(parts[0], "@") {
		return types.YoutubeId{Handle: parts[0]}, true
	}
	if len(parts) >= 2 && parts[0] == "live" && parts[1] != "" {
		return types.YoutubeId{LiveID: parts[1]}, true
	}
	return types.YoutubeId{}, false
}
