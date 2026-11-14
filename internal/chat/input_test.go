package chat

import "testing"

func TestNormalizeChannel(t *testing.T) {
	tests := []struct {
		in      string
		want    string
		wantErr bool
	}{
		{"shroud", "shroud", false},
		{"  @shroud ", "shroud", false},
		{"https://www.twitch.tv/shroud", "shroud", false},
		{"https://kick.com/xqc/", "xqc", false},
		{"https://kick.com/xqc?foo=bar", "xqc", false},
		{"", "", true},
		{"   ", "", true},
		{"@", "", true},
		{"https://twitch.tv/", "", true},
		{"two words", "", true},
	}
	for _, tt := range tests {
		got, err := NormalizeChannel(tt.in)
		if (err != nil) != tt.wantErr {
			t.Errorf("NormalizeChannel(%q) error = %v, wantErr %v", tt.in, err, tt.wantErr)
			continue
		}
		if got != tt.want {
			t.Errorf("NormalizeChannel(%q) = %q, want %q", tt.in, got, tt.want)
		}
	}
}
