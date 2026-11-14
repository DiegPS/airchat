package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/PirateTok/live-go/auth"
	"github.com/PirateTok/live-go/connection"
	"github.com/PirateTok/live-go/events"
	tthttp "github.com/PirateTok/live-go/http"
)

const tiktokTTWIDRegisterURL = "https://ttwid.bytedance.com/ttwid/union/register/"

type airTikTokClient struct {
	username     string
	cdnHost      string
	timeout      time.Duration
	maxRetries   int
	staleTimeout time.Duration
	userAgent    string
	cookies      string
	language     string
	region       string
	proxy        string
	compress     bool
}

func buildTikTokClient(username string, opts TikTokConnectOptions) *airTikTokClient {
	client := &airTikTokClient{
		username:     username,
		cdnHost:      "webcast-ws.tiktok.com",
		timeout:      10 * time.Second,
		maxRetries:   5,
		staleTimeout: 60 * time.Second,
		compress:     opts.Compress,
		userAgent:    strings.TrimSpace(opts.UserAgent),
		cookies:      strings.TrimSpace(opts.Cookies),
		language:     strings.TrimSpace(opts.Language),
		region:       strings.TrimSpace(opts.Region),
		proxy:        strings.TrimSpace(opts.Proxy),
	}

	switch strings.ToLower(strings.TrimSpace(opts.CDN)) {
	case "eu":
		client.cdnHost = "webcast-ws.eu.tiktok.com"
	case "us":
		client.cdnHost = "webcast-ws.us.tiktok.com"
	case "custom":
		if host := strings.TrimSpace(opts.CustomCDN); host != "" {
			client.cdnHost = host
		}
	}
	if opts.TimeoutSeconds > 0 {
		client.timeout = time.Duration(opts.TimeoutSeconds) * time.Second
	}
	if opts.MaxRetries >= 0 {
		client.maxRetries = opts.MaxRetries
	}
	if opts.StaleTimeoutSeconds > 0 {
		client.staleTimeout = time.Duration(opts.StaleTimeoutSeconds) * time.Second
	}
	return client
}

// Connect keeps live-go's room resolution, protobuf router, WebSocket framing,
// and event contract. It replaces only the fragile ttwid bootstrap so a user
// cookie can be honored and ByteDance's registration endpoint can be used when
// the TikTok homepage returns HTTP 200 without setting ttwid.
func (c *airTikTokClient) Connect(ctx context.Context) (<-chan events.Event, error) {
	lang := c.language
	if lang == "" {
		lang = tthttp.SystemLanguage()
	}
	region := c.region
	if region == "" {
		region = tthttp.SystemRegion()
	}

	room, err := tthttp.CheckOnline(c.username, c.timeout, lang, region, c.proxy)
	if err != nil {
		return nil, err
	}

	eventCh := make(chan events.Event, 256)
	eventCh <- events.Event{Type: events.EventConnected, RoomID: room.RoomID}
	go c.run(ctx, room.RoomID, lang, region, eventCh)
	return eventCh, nil
}

func (c *airTikTokClient) run(ctx context.Context, roomID string, lang string, region string, eventCh chan events.Event) {
	defer close(eventCh)
	acceptLanguage := fmt.Sprintf("%s-%s,%s;q=0.9", lang, region, lang)
	timezone := tthttp.SystemTimezone()
	attempt := 0

	for ctx.Err() == nil {
		userAgent := c.userAgent
		if userAgent == "" {
			userAgent = tthttp.RandomUA()
		}

		ttwid, source, bootstrapErr := c.resolveTTWID(ctx, userAgent)
		if bootstrapErr == nil {
			cookieHeader := mergeTikTokCookies(ttwid, c.cookies)
			wssURL := connection.BuildWSSURL(c.cdnHost, roomID, timezone, lang, region, c.compress)
			bootstrapErr = connection.RunWebSocket(ctx, wssURL, cookieHeader, userAgent, roomID, c.staleTimeout, acceptLanguage, c.proxy, eventCh)
			if bootstrapErr != nil {
				log.Printf("TikTok WebSocket failed (ttwid source %s): %v", source, bootstrapErr)
			}
		} else {
			log.Printf("TikTok ttwid bootstrap failed: %v", bootstrapErr)
		}

		if ctx.Err() != nil {
			break
		}
		attempt++
		if attempt > c.maxRetries {
			log.Printf("TikTok max retries (%d) exceeded", c.maxRetries)
			break
		}

		delay := tiktokReconnectDelay(attempt, bootstrapErr)
		detail := fmt.Sprintf("attempt=%d max=%d delay=%v", attempt, c.maxRetries, delay)
		if bootstrapErr != nil {
			detail += fmt.Sprintf(" error=%v", bootstrapErr)
		}
		select {
		case eventCh <- events.Event{Type: events.EventReconnecting, RoomID: roomID, Data: detail}:
		default:
		}

		select {
		case <-time.After(delay):
		case <-ctx.Done():
			return
		}
	}

	select {
	case eventCh <- events.Event{Type: events.EventDisconnected, RoomID: roomID}:
	default:
	}
}

func tiktokReconnectDelay(attempt int, err error) time.Duration {
	var blocked *connection.DeviceBlockedError
	if errors.As(err, &blocked) {
		return 2 * time.Second
	}
	if attempt >= 5 {
		return 30 * time.Second
	}
	if attempt < 1 {
		attempt = 1
	}
	return time.Duration(1<<attempt) * time.Second
}

func (c *airTikTokClient) resolveTTWID(ctx context.Context, userAgent string) (string, string, error) {
	if value, ok := findCookieValue(c.cookies, "ttwid"); ok {
		return value, "session cookies", nil
	}

	value, primaryErr := auth.FetchTTWID(c.timeout, userAgent, c.proxy)
	if primaryErr == nil {
		return value, "TikTok homepage", nil
	}

	value, fallbackErr := fetchTikTokTTWID(ctx, tiktokTTWIDRegisterURL, c.timeout, userAgent, c.proxy)
	if fallbackErr == nil {
		return value, "ByteDance registration", nil
	}
	return "", "", fmt.Errorf("homepage: %v; registration fallback: %w", primaryErr, fallbackErr)
}

func fetchTikTokTTWID(ctx context.Context, endpoint string, timeout time.Duration, userAgent string, proxy string) (string, error) {
	transport := &http.Transport{Proxy: http.ProxyFromEnvironment}
	if proxy != "" {
		proxyURL, err := url.Parse(proxy)
		if err != nil {
			return "", fmt.Errorf("invalid proxy URL: %w", err)
		}
		transport.Proxy = http.ProxyURL(proxyURL)
	}

	body, err := json.Marshal(map[string]interface{}{
		"region":        "ttlive_web",
		"aid":           1768,
		"needFid":       false,
		"service":       "www.tiktok.com",
		"migrate_info":  map[string]string{"ticket": "", "source": "node"},
		"cbUrlProtocol": "https",
		"union":         true,
	})
	if err != nil {
		return "", fmt.Errorf("encode registration request: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("build registration request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", userAgent)

	resp, err := (&http.Client{Timeout: timeout, Transport: transport}).Do(req)
	if err != nil {
		return "", fmt.Errorf("registration request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return "", fmt.Errorf("registration returned HTTP %d", resp.StatusCode)
	}
	for _, cookie := range resp.Cookies() {
		if cookie.Name == "ttwid" && strings.TrimSpace(cookie.Value) != "" {
			return strings.TrimSpace(cookie.Value), nil
		}
	}
	return "", fmt.Errorf("registration response did not include ttwid (HTTP %d)", resp.StatusCode)
}

func findCookieValue(cookieHeader string, name string) (string, bool) {
	for _, part := range strings.Split(cookieHeader, ";") {
		key, value, ok := strings.Cut(strings.TrimSpace(part), "=")
		if ok && strings.EqualFold(strings.TrimSpace(key), name) {
			value = strings.Trim(strings.TrimSpace(value), `"`)
			return value, value != ""
		}
	}
	return "", false
}

func mergeTikTokCookies(ttwid string, extras string) string {
	parts := []string{"ttwid=" + ttwid}
	for _, part := range strings.Split(extras, ";") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		name, _, ok := strings.Cut(part, "=")
		if ok && strings.EqualFold(strings.TrimSpace(name), "ttwid") {
			continue
		}
		parts = append(parts, part)
	}
	return strings.Join(parts, "; ")
}
