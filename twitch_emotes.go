package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"

	twitch "github.com/gempir/go-twitch-irc/v3"
)

// emoteMap maps emote name → image URL
type emoteMap map[string]string

// twitchMessagePart mirrors the frontend MessageItem shape
type twitchMessagePart map[string]interface{}

// ─── Fetchers ────────────────────────────────────────────────────────────────

func fetchBTTV() (emoteMap, error) {
	resp, err := httpGet("https://api.betterttv.net/3/cached/emotes/global")
	if err != nil {
		return nil, err
	}

	var items []struct {
		ID        string `json:"id"`
		Code      string `json:"code"`
		ImageType string `json:"imageType"`
	}
	if err := json.Unmarshal(resp, &items); err != nil {
		return nil, err
	}

	m := make(emoteMap, len(items))
	for _, e := range items {
		m[e.Code] = fmt.Sprintf("https://cdn.betterttv.net/emote/%s/1x", e.ID)
	}
	return m, nil
}

func fetchFFZ() (emoteMap, error) {
	resp, err := httpGet("https://api.frankerfacez.com/v1/set/global")
	if err != nil {
		return nil, err
	}

	var payload struct {
		Sets map[string]struct {
			Emoticons []struct {
				Name string            `json:"name"`
				URLs map[string]string `json:"urls"`
			} `json:"emoticons"`
		} `json:"sets"`
	}
	if err := json.Unmarshal(resp, &payload); err != nil {
		return nil, err
	}

	m := make(emoteMap)
	for _, set := range payload.Sets {
		for _, e := range set.Emoticons {
			if url, ok := e.URLs["1"]; ok {
				m[e.Name] = "https:" + url
			}
		}
	}
	return m, nil
}

func fetch7TV() (emoteMap, error) {
	resp, err := httpGet("https://7tv.io/v3/emote-sets/global")
	if err != nil {
		return nil, err
	}

	var payload struct {
		Emotes []struct {
			Name string `json:"name"`
			Data struct {
				Host struct {
					URL   string `json:"url"`
					Files []struct {
						Name   string `json:"name"`
						Format string `json:"format"`
					} `json:"files"`
				} `json:"host"`
			} `json:"data"`
		} `json:"emotes"`
	}
	if err := json.Unmarshal(resp, &payload); err != nil {
		return nil, err
	}

	m := make(emoteMap)
	for _, e := range payload.Emotes {
		host := e.Data.Host
		if host.URL == "" {
			continue
		}
		// Prefer WebP 1x, fall back to first file
		chosen := ""
		for _, f := range host.Files {
			if f.Name == "1x.webp" {
				chosen = f.Name
				break
			}
		}
		if chosen == "" && len(host.Files) > 0 {
			chosen = host.Files[0].Name
		}
		if chosen != "" {
			m[e.Name] = "https:" + host.URL + "/" + chosen
		}
	}
	return m, nil
}

// buildEmoteMap fetches all three sources concurrently.
// Individual failures are silently skipped — the rest still work.
func buildEmoteMap() emoteMap {
	type result struct {
		m   emoteMap
		err error
		src string
	}

	fetchers := []struct {
		name string
		fn   func() (emoteMap, error)
	}{
		{"BTTV", fetchBTTV},
		{"FFZ", fetchFFZ},
		{"7TV", fetch7TV},
	}

	ch := make(chan result, len(fetchers))
	for _, f := range fetchers {
		f := f
		go func() {
			m, err := f.fn()
			ch <- result{m, err, f.name}
		}()
	}

	merged := make(emoteMap)
	for range fetchers {
		r := <-ch
		if r.err != nil {
			// Fallback: skip this source, others still contribute
			continue
		}
		for k, v := range r.m {
			merged[k] = v
		}
	}
	return merged
}

// ─── Message parser ───────────────────────────────────────────────────────────

// parseTwitchMessage converts a raw Twitch IRC message into the same
// []MessageItem shape the frontend already knows how to render.
// Native emotes are resolved first (by position), then third-party
// emotes are matched word-by-word in the remaining text segments.
// If any emote URL is missing the word is left as plain text (fallback).
func parseTwitchMessage(text string, ircEmotes []*twitch.Emote, emotes emoteMap) []twitchMessagePart {
	// Expand every emote occurrence into a flat list (same emote can appear N times
	// with N positions in one IRC entry — we need to handle all of them).
	type occurrence struct {
		id, name   string
		start, end int
	}
	var all []occurrence
	for _, e := range ircEmotes {
		for _, pos := range e.Positions {
			all = append(all, occurrence{e.ID, e.Name, pos.Start, pos.End})
		}
	}
	sort.Slice(all, func(i, j int) bool { return all[i].start < all[j].start })

	runes := []rune(text)
	var parts []twitchMessagePart
	cursor := 0

	for _, occ := range all {
		if occ.start > len(runes) || occ.end >= len(runes) {
			continue
		}

		// Text segment before this emote
		if occ.start > cursor {
			segment := string(runes[cursor:occ.start])
			parts = append(parts, splitByThirdParty(segment, emotes)...)
		}

		// Native Twitch emote
		url := fmt.Sprintf("https://static-cdn.jtvnw.net/emoticons/v2/%s/default/dark/1.0", occ.id)
		parts = append(parts, twitchMessagePart{
			"Text": "",
			"EmojiItem": map[string]interface{}{
				"URL":           url,
				"Alt":           occ.name,
				"EmojiText":     occ.name,
				"IsCustomEmoji": false,
			},
		})

		cursor = occ.end + 1
	}

	// Remaining text after last native emote
	if cursor < len(runes) {
		segment := string(runes[cursor:])
		parts = append(parts, splitByThirdParty(segment, emotes)...)
	}

	// No emotes at all — return the raw text
	if len(parts) == 0 {
		return []twitchMessagePart{{"Text": text}}
	}
	return parts
}

// splitByThirdParty splits a text segment word-by-word and replaces
// known emote names with EmojiItems. Adjacent text words are merged.
func splitByThirdParty(text string, emotes emoteMap) []twitchMessagePart {
	if strings.TrimSpace(text) == "" {
		if text != "" {
			return []twitchMessagePart{{"Text": text}}
		}
		return nil
	}

	words := strings.Fields(text)
	var parts []twitchMessagePart
	var acc strings.Builder

	flushText := func() {
		if acc.Len() > 0 {
			parts = append(parts, twitchMessagePart{"Text": acc.String()})
			acc.Reset()
		}
	}

	for i, word := range words {
		if url, ok := emotes[word]; ok {
			flushText()
			parts = append(parts, twitchMessagePart{
				"Text": "",
				"EmojiItem": map[string]interface{}{
					"URL":           url,
					"Alt":           word,
					"EmojiText":     word,
					"IsCustomEmoji": true,
				},
			})
		} else {
			if i > 0 && acc.Len() > 0 {
				acc.WriteString(" ")
			}
			acc.WriteString(word)
		}
	}
	flushText()

	return parts
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

var httpClient = &http.Client{}

func httpGet(url string) ([]byte, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "airchat/1.0")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d from %s", resp.StatusCode, url)
	}
	return io.ReadAll(resp.Body)
}

// ─── App integration ─────────────────────────────────────────────────────────

// loadTwitchEmotes fetches all emote sources and stores them in the App.
// Called async from StartTwitchChat — a fetch failure only affects emote
// display, the chat connection itself is unaffected.
func (a *App) loadTwitchEmotes() {
	m := buildEmoteMap()
	a.twitchEmotesMu.Lock()
	a.twitchEmotes = m
	a.twitchEmotesMu.Unlock()
}

// getTwitchMessageParts returns the parsed message parts for a Twitch message.
func (a *App) getTwitchMessageParts(text string, ircEmotes []*twitch.Emote) []twitchMessagePart {
	a.twitchEmotesMu.RLock()
	emotes := a.twitchEmotes
	a.twitchEmotesMu.RUnlock()

	if emotes == nil {
		emotes = emoteMap{}
	}
	return parseTwitchMessage(text, ircEmotes, emotes)
}
