package chat

import (
	"errors"
	"net/url"
	"strings"
)

// NormalizeChannel turns user input into a bare channel name. It accepts a
// plain name, "@name", or a channel URL (the last path segment is used).
func NormalizeChannel(input string) (string, error) {
	value := strings.TrimSpace(input)
	if value == "" {
		return "", errors.New("channel name is required")
	}

	if parsed, err := url.Parse(value); err == nil && parsed.Host != "" {
		var last string
		for segment := range strings.SplitSeq(parsed.Path, "/") {
			if segment != "" {
				last = segment
			}
		}
		value = last
	}

	value = strings.TrimSpace(strings.TrimPrefix(value, "@"))
	if value == "" || strings.ContainsAny(value, "/?#& \\") {
		return "", errors.New("invalid channel name")
	}
	return value, nil
}
