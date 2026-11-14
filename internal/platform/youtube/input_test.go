package youtube

import (
	"testing"

	"github.com/DiegPS/youtube-chat/types"
)

func TestParseInput(t *testing.T) {
	tests := []struct {
		in      string
		want    types.YoutubeId
		wantErr bool
	}{
		{"@mrbeast", types.YoutubeId{Handle: "@mrbeast"}, false},
		{"mrbeast", types.YoutubeId{Handle: "@mrbeast"}, false},
		{"  /@mrbeast ", types.YoutubeId{Handle: "@mrbeast"}, false},
		{"UCX6OQ3DkcsbYNE6H8uQQuVA", types.YoutubeId{ChannelID: "UCX6OQ3DkcsbYNE6H8uQQuVA"}, false},
		{"channel/UCX6OQ3DkcsbYNE6H8uQQuVA", types.YoutubeId{ChannelID: "UCX6OQ3DkcsbYNE6H8uQQuVA"}, false},
		{"dQw4w9WgXcQ", types.YoutubeId{LiveID: "dQw4w9WgXcQ"}, false},
		{"watch?v=dQw4w9WgXcQ", types.YoutubeId{LiveID: "dQw4w9WgXcQ"}, false},
		{"https://www.youtube.com/watch?v=dQw4w9WgXcQ", types.YoutubeId{LiveID: "dQw4w9WgXcQ"}, false},
		{"https://youtu.be/dQw4w9WgXcQ", types.YoutubeId{LiveID: "dQw4w9WgXcQ"}, false},
		{"https://www.youtube.com/live/dQw4w9WgXcQ", types.YoutubeId{LiveID: "dQw4w9WgXcQ"}, false},
		{"https://www.youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA", types.YoutubeId{ChannelID: "UCX6OQ3DkcsbYNE6H8uQQuVA"}, false},
		{"https://www.youtube.com/@mrbeast", types.YoutubeId{Handle: "@mrbeast"}, false},
		{"https://example.com/foo", types.YoutubeId{}, true},
		{"", types.YoutubeId{}, true},
		{"   ", types.YoutubeId{}, true},
	}

	for _, tt := range tests {
		got, err := ParseInput(tt.in)
		if (err != nil) != tt.wantErr {
			t.Errorf("ParseInput(%q) error = %v, wantErr %v", tt.in, err, tt.wantErr)
			continue
		}
		if got != tt.want {
			t.Errorf("ParseInput(%q) = %+v, want %+v", tt.in, got, tt.want)
		}
	}
}
