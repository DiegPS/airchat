package twitch

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode"

	twitchirc "github.com/gempir/go-twitch-irc/v3"

	"airchat/internal/chat"
)

// emoteMap maps an emote name to its image URL.
type emoteMap map[string]string

// ─── Fetchers ────────────────────────────────────────────────────────────────

func fetchBTTV() (emoteMap, error) {
	body, err := httpGet("https://api.betterttv.net/3/cached/emotes/global")
	if err != nil {
		return nil, err
	}

	var items []struct {
		ID   string `json:"id"`
		Code string `json:"code"`
	}
	if err := json.Unmarshal(body, &items); err != nil {
		return nil, err
	}

	m := make(emoteMap, len(items))
	for _, e := range items {
		m[e.Code] = fmt.Sprintf("https://cdn.betterttv.net/emote/%s/1x", e.ID)
	}
	return m, nil
}

func fetchFFZ() (emoteMap, error) {
	body, err := httpGet("https://api.frankerfacez.com/v1/set/global")
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
	if err := json.Unmarshal(body, &payload); err != nil {
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
	body, err := httpGet("https://7tv.io/v3/emote-sets/global")
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
						Name string `json:"name"`
					} `json:"files"`
				} `json:"host"`
			} `json:"data"`
		} `json:"emotes"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}

	m := make(emoteMap)
	for _, e := range payload.Emotes {
		host := e.Data.Host
		if host.URL == "" {
			continue
		}
		// Prefer WebP 1x, fall back to the first file.
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

// buildEmoteMap fetches all sources concurrently. A failing source is
// skipped; the others still contribute.
func buildEmoteMap() emoteMap {
	fetchers := []func() (emoteMap, error){fetchBTTV, fetchFFZ, fetch7TV}

	type result struct {
		m   emoteMap
		err error
	}
	results := make(chan result, len(fetchers))
	for _, fn := range fetchers {
		go func() {
			m, err := fn()
			results <- result{m, err}
		}()
	}

	merged := make(emoteMap)
	for range fetchers {
		if r := <-results; r.err == nil {
			for name, url := range r.m {
				merged[name] = url
			}
		}
	}
	return merged
}

var httpClient = &http.Client{Timeout: 10 * time.Second}

func httpGet(url string) ([]byte, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
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

// emoteStore holds the third-party emotes loaded after connecting.
type emoteStore struct {
	mu     sync.RWMutex
	emotes emoteMap
}

func (s *emoteStore) set(m emoteMap) {
	s.mu.Lock()
	s.emotes = m
	s.mu.Unlock()
}

func (s *emoteStore) get() emoteMap {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.emotes
}

// ─── Message parser ──────────────────────────────────────────────────────────

// parseMessage converts a Twitch IRC message into renderable parts. Native
// emotes are resolved by position first, then third-party emotes are matched
// word by word in the remaining text. A native emote can appear N times in a
// message: IRC sends one entry with N positions, which are expanded here.
func parseMessage(text string, ircEmotes []*twitchirc.Emote, third emoteMap) []chat.Part {
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
	var parts []chat.Part
	cursor := 0

	for _, occ := range all {
		if occ.start < cursor || occ.start > len(runes) || occ.end >= len(runes) {
			continue
		}
		if occ.start > cursor {
			parts = append(parts, splitByThirdParty(string(runes[cursor:occ.start]), third)...)
		}
		url := fmt.Sprintf("https://static-cdn.jtvnw.net/emoticons/v2/%s/default/dark/1.0", occ.id)
		parts = append(parts, chat.Emote(url, occ.name, false))
		cursor = occ.end + 1
	}

	if cursor < len(runes) {
		parts = append(parts, splitByThirdParty(string(runes[cursor:]), third)...)
	}
	if len(parts) == 0 {
		return []chat.Part{chat.Text(text)}
	}
	return parts
}

// splitByThirdParty replaces known third-party emote names with emote parts
// and keeps every other character, whitespace included, so text around an
// emote is not glued to it. Adjacent text is merged into one part.
func splitByThirdParty(text string, third emoteMap) []chat.Part {
	if text == "" {
		return nil
	}

	var parts []chat.Part
	var acc strings.Builder
	flush := func() {
		if acc.Len() > 0 {
			parts = append(parts, chat.Text(acc.String()))
			acc.Reset()
		}
	}

	rest := text
	for rest != "" {
		// Take one run of whitespace or one run of non-whitespace.
		isSpace := unicode.IsSpace([]rune(rest)[0])
		end := strings.IndexFunc(rest, func(r rune) bool { return unicode.IsSpace(r) != isSpace })
		if end < 0 {
			end = len(rest)
		}
		token := rest[:end]
		rest = rest[end:]

		if url, ok := third[token]; ok && !isSpace {
			flush()
			parts = append(parts, chat.Emote(url, token, true))
			continue
		}
		acc.WriteString(token)
	}
	flush()
	return parts
}
