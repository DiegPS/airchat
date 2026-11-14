package obs

import (
	"testing"
	"time"
)

var t0 = time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

func TestFirstSampleHasNoRates(t *testing.T) {
	var s sampler
	st := s.next(sample{Bytes: 1000, Total: 100, Active: true}, t0)
	if st.BitrateKbps != 0 || st.DropPercentage != 0 || st.StatusColor != "GREEN" || !st.Connected {
		t.Fatalf("unexpected status: %+v", st)
	}
}

func TestBitrateAndDropPercentage(t *testing.T) {
	var s sampler
	s.next(sample{Bytes: 0, Total: 0, Active: true}, t0)
	st := s.next(sample{Bytes: 625_000, Skipped: 1, Total: 100, Active: true, FPS: 60, Scene: "Game"}, t0.Add(time.Second))

	if st.BitrateKbps != 5000 {
		t.Fatalf("bitrate = %v, want 5000", st.BitrateKbps)
	}
	if st.DropPercentage != 1 {
		t.Fatalf("drop percentage = %v, want 1", st.DropPercentage)
	}
	if st.StatusColor != "YELLOW" {
		t.Fatalf("color = %s, want YELLOW", st.StatusColor)
	}
	if st.FPS != 60 || st.CurrentScene != "Game" {
		t.Fatalf("fps/scene not carried: %+v", st)
	}
}

func TestStatusColors(t *testing.T) {
	tests := []struct {
		name string
		prev sample
		cur  sample
		want string
	}{
		{"not streaming", sample{}, sample{Active: false, Bytes: 10, Total: 10}, "GRAY"},
		{"reconnecting", sample{Active: true}, sample{Active: true, Reconnecting: true, Bytes: 10, Total: 10}, "RED"},
		{"high drops", sample{Active: true}, sample{Active: true, Bytes: 10, Skipped: 5, Total: 100}, "RED"},
		{"no bytes flowing", sample{Active: true, Bytes: 10, Total: 10}, sample{Active: true, Bytes: 10, Total: 20}, "YELLOW"},
		{"healthy", sample{Active: true}, sample{Active: true, Bytes: 1000, Total: 60}, "GREEN"},
	}
	for _, tt := range tests {
		var s sampler
		s.next(tt.prev, t0)
		if got := s.next(tt.cur, t0.Add(time.Second)).StatusColor; got != tt.want {
			t.Errorf("%s: color = %s, want %s", tt.name, got, tt.want)
		}
	}
}

func TestCounterResetDropsBaseline(t *testing.T) {
	var s sampler
	s.next(sample{Bytes: 5_000_000, Total: 1000, Active: true}, t0)
	st := s.next(sample{Bytes: 100, Total: 10, Active: true}, t0.Add(time.Second))
	if st.BitrateKbps != 0 || st.DropPercentage != 0 {
		t.Fatalf("restart must not produce negative or huge rates: %+v", st)
	}
}
