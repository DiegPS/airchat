// Package obs monitors an OBS Studio instance over OBS WebSocket and exposes
// audio controls.
package obs

import (
	"math"
	"time"
)

// Status is the stream health snapshot sent to the frontend as "obs_status".
type Status struct {
	Connected      bool    `json:"connected"`
	OutputActive   bool    `json:"outputActive"`
	Reconnecting   bool    `json:"reconnecting"`
	BitrateKbps    float64 `json:"bitrateKbps"`
	FPS            float64 `json:"fps"`
	DropPercentage float64 `json:"dropPercentage"`
	Congestion     float64 `json:"congestion"`
	StatusColor    string  `json:"statusColor"` // "GREEN", "YELLOW", "RED", "GRAY"
	CurrentScene   string  `json:"currentScene"`
}

// AudioInput is an OBS audio source.
type AudioInput struct {
	Name   string  `json:"name"`
	Muted  bool    `json:"muted"`
	Volume float64 `json:"volume"` // dB
}

// sample is one raw reading from OBS.
type sample struct {
	Bytes, Skipped, Total float64
	Active, Reconnecting  bool
	Congestion, FPS       float64
	Scene                 string
}

// sampler turns consecutive raw readings into rates (bitrate, drop percent).
type sampler struct {
	prev    sample
	prevAt  time.Time
	hasPrev bool
}

// next computes the Status for a new sample.
func (s *sampler) next(cur sample, now time.Time) Status {
	// A restarted stream resets OBS counters: drop the baseline.
	if s.hasPrev && (cur.Bytes < s.prev.Bytes || cur.Skipped < s.prev.Skipped || cur.Total < s.prev.Total) {
		s.hasPrev = false
	}

	var kbps, dropPct, bytesDelta float64
	if s.hasPrev {
		dt := now.Sub(s.prevAt).Seconds()
		if dt <= 0 {
			dt = 1
		}
		bytesDelta = cur.Bytes - s.prev.Bytes
		kbps = sanitize(bytesDelta * 8 / dt / 1000)
		if totalDelta := cur.Total - s.prev.Total; totalDelta > 0 {
			dropPct = sanitize((cur.Skipped - s.prev.Skipped) / totalDelta * 100)
		}
	}

	color := "GREEN"
	switch {
	case !cur.Active:
		color = "GRAY"
	case cur.Reconnecting, dropPct >= 2.0:
		color = "RED"
	case dropPct >= 0.5, s.hasPrev && bytesDelta == 0:
		color = "YELLOW"
	}

	status := Status{
		Connected:      true,
		OutputActive:   cur.Active,
		Reconnecting:   cur.Reconnecting,
		BitrateKbps:    kbps,
		FPS:            cur.FPS,
		DropPercentage: dropPct,
		Congestion:     cur.Congestion,
		StatusColor:    color,
		CurrentScene:   cur.Scene,
	}

	s.prev, s.prevAt, s.hasPrev = cur, now, true
	return status
}

func sanitize(v float64) float64 {
	if v < 0 || math.IsNaN(v) || math.IsInf(v, 0) {
		return 0
	}
	return v
}
