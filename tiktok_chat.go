package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	golive "github.com/PirateTok/live-go"
	"github.com/PirateTok/live-go/events"
	"github.com/PirateTok/live-go/helpers"
	tthttp "github.com/PirateTok/live-go/http"
	pb "github.com/PirateTok/live-go/proto"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

// TikTokConnectOptions exposes live-go's complete connection configuration.
// Cookies are accepted in memory only; the frontend deliberately excludes them
// from localStorage.
type TikTokConnectOptions struct {
	CDN                 string `json:"cdn"`
	CustomCDN           string `json:"customCdn"`
	TimeoutSeconds      int    `json:"timeoutSeconds"`
	MaxRetries          int    `json:"maxRetries"`
	StaleTimeoutSeconds int    `json:"staleTimeoutSeconds"`
	UserAgent           string `json:"userAgent"`
	Cookies             string `json:"cookies"`
	Language            string `json:"language"`
	Region              string `json:"region"`
	Proxy               string `json:"proxy"`
	Compress            bool   `json:"compress"`
}

type TikTokLifecyclePayload struct {
	Username string `json:"username"`
	RoomID   string `json:"roomId"`
	Reason   string `json:"reason,omitempty"`
}

type TikTokStatusPayload struct {
	Username       string `json:"username"`
	RoomID         string `json:"roomId"`
	State          string `json:"state"`
	Connected      bool   `json:"connected"`
	Reconnecting   bool   `json:"reconnecting"`
	ViewerCount    int64  `json:"viewerCount"`
	TotalUserCount int32  `json:"totalUserCount"`
	TotalLikes     int32  `json:"totalLikes"`
	SessionLikes   int64  `json:"sessionLikes"`
	LastEventType  string `json:"lastEventType"`
	Detail         string `json:"detail,omitempty"`
}

type TikTokEventPayload struct {
	ID               string      `json:"id"`
	Type             string      `json:"type"`
	Category         string      `json:"category"`
	Timestamp        string      `json:"timestamp"`
	Summary          string      `json:"summary"`
	Data             interface{} `json:"data,omitempty"`
	RawPayloadBase64 string      `json:"rawPayloadBase64,omitempty"`
}

type tiktokEventDescriptor struct {
	Name     string
	Category string
}

type tiktokSessionState struct {
	username       string
	roomID         string
	generation     uint64
	connected      bool
	everConnected  bool
	startedEmitted bool
	connectionInfo string
	viewerCount    int64
	totalUsers     int32
	totalLikes     int32
	sessionLikes   int64
	likeTracker    *helpers.LikeAccumulator
	giftTracker    *helpers.GiftStreakTracker
	lastEventType  string
	activitySeq    uint64
	options        TikTokConnectOptions
}

func normalizeTikTokUsername(input string) (string, error) {
	value := strings.TrimSpace(input)
	if value == "" {
		return "", fmt.Errorf("TikTok username is required")
	}
	if parsed, err := url.Parse(value); err == nil && parsed.Host != "" {
		host := strings.ToLower(strings.TrimPrefix(parsed.Host, "www."))
		if host != "tiktok.com" && !strings.HasSuffix(host, ".tiktok.com") {
			return "", fmt.Errorf("unsupported TikTok URL")
		}
		parts := strings.Split(strings.Trim(parsed.Path, "/"), "/")
		if len(parts) == 0 || parts[0] == "" {
			return "", fmt.Errorf("TikTok URL does not contain a username")
		}
		value = parts[0]
	}
	value = strings.TrimSpace(strings.TrimPrefix(value, "@"))
	if strings.ContainsAny(value, "/?#& \\") {
		return "", fmt.Errorf("invalid TikTok username")
	}
	if value == "" {
		return "", fmt.Errorf("TikTok username is required")
	}
	return value, nil
}

// StartTikTokChat connects to a TikTok LIVE and consumes every event exposed
// by live-go. A generation guard prevents a cancelled/replaced socket from
// emitting late events into a newer AirChat session.
func (a *App) StartTikTokChat(input string, opts TikTokConnectOptions) error {
	username, err := normalizeTikTokUsername(input)
	if err != nil {
		runtime.EventsEmit(a.ctx, "tiktok_error", err.Error())
		return err
	}

	ctx, cancel := context.WithCancel(a.ctx)

	a.tiktokMu.Lock()
	oldCancel := a.tiktokCancel
	a.tiktokGeneration++
	generation := a.tiktokGeneration
	a.tiktokCancel = cancel
	a.tiktokMu.Unlock()

	if oldCancel != nil {
		oldCancel()
	}

	eventCh, err := buildTikTokClient(username, opts).Connect(ctx)
	if err != nil {
		cancel()
		a.clearTikTokSession(generation)
		wrapped := fmt.Errorf("tiktok: %w", err)
		runtime.EventsEmit(a.ctx, "tiktok_error", wrapped.Error())
		return wrapped
	}

	state := &tiktokSessionState{
		username:    username,
		generation:  generation,
		likeTracker: helpers.NewLikeAccumulator(),
		giftTracker: helpers.NewGiftStreakTracker(),
		options:     opts,
	}
	go a.consumeTikTokEvents(ctx, cancel, eventCh, state)
	return nil
}

// StopTikTokChat invalidates the current generation before cancelling it.
func (a *App) StopTikTokChat() {
	a.tiktokMu.Lock()
	cancel := a.tiktokCancel
	a.tiktokCancel = nil
	a.tiktokGeneration++
	a.tiktokMu.Unlock()
	if cancel != nil {
		cancel()
	}
}

func (a *App) isTikTokGenerationCurrent(generation uint64) bool {
	a.tiktokMu.Lock()
	defer a.tiktokMu.Unlock()
	return a.tiktokGeneration == generation && a.tiktokCancel != nil
}

func (a *App) clearTikTokSession(generation uint64) bool {
	a.tiktokMu.Lock()
	defer a.tiktokMu.Unlock()
	if a.tiktokGeneration != generation {
		return false
	}
	a.tiktokCancel = nil
	return true
}

func (a *App) emitTikTok(generation uint64, eventName string, payload interface{}) bool {
	if !a.isTikTokGenerationCurrent(generation) {
		return false
	}
	runtime.EventsEmit(a.ctx, eventName, payload)
	return true
}

func (a *App) consumeTikTokEvents(ctx context.Context, cancel context.CancelFunc, eventCh <-chan events.Event, state *tiktokSessionState) {
	defer cancel()
	endedEmitted := false
	emitEnded := func(reason string) {
		if endedEmitted || !a.isTikTokGenerationCurrent(state.generation) {
			return
		}
		endedEmitted = true
		a.emitTikTok(state.generation, "tiktok_ended", TikTokLifecyclePayload{
			Username: state.username,
			RoomID:   state.roomID,
			Reason:   reason,
		})
	}

	defer func() {
		if a.clearTikTokSession(state.generation) && !endedEmitted {
			runtime.EventsEmit(a.ctx, "tiktok_ended", TikTokLifecyclePayload{
				Username: state.username,
				RoomID:   state.roomID,
				Reason:   "connection closed",
			})
		}
	}()

	for {
		select {
		case <-ctx.Done():
			return
		case evt, ok := <-eventCh:
			if !ok || !a.isTikTokGenerationCurrent(state.generation) {
				return
			}
			desc := describeTikTokEvent(evt.Type)
			payload := makeTikTokEventPayload(evt, desc, state)
			state.lastEventType = desc.Name
			a.emitTikTok(state.generation, "tiktok_event", payload)

			switch evt.Type {
			case events.EventConnected:
				state.roomID = evt.RoomID
				a.emitTikTokStatus(state, "connecting", "LIVE resolved; waiting for WebSocket traffic")
			case events.EventReconnecting:
				state.connected = false
				detail := fmt.Sprint(evt.Data)
				state.connectionInfo = detail
				a.emitTikTok(state.generation, "tiktok_reconnecting", detail)
				a.emitTikTokStatus(state, "reconnecting", detail)
				state.giftTracker.Reset()
			case events.EventDisconnected:
				if !state.everConnected {
					reason := "TikTok connection setup failed after automatic retries"
					if state.connectionInfo != "" {
						reason += ": " + state.connectionInfo
					}
					emitEnded(reason)
					return
				}
				emitEnded("disconnected after reconnect attempts")
				return
			case events.EventLiveEnded:
				emitEnded("LIVE ended")
				return
			default:
				if !state.connected {
					state.connected = true
					state.everConnected = true
					if !state.startedEmitted {
						state.startedEmitted = true
						a.emitTikTok(state.generation, "tiktok_started", TikTokLifecyclePayload{Username: state.username, RoomID: state.roomID})
						go a.fetchTikTokMetadata(state)
					}
					a.emitTikTokStatus(state, "connected", "WebSocket traffic received")
				}
				a.routeTikTokContentEvent(evt, payload, state)
			}
		}
	}
}

// CheckTikTokLive exposes live-go's room resolution without opening a socket.
func (a *App) CheckTikTokLive(input string, timeoutSeconds int) (string, error) {
	username, err := normalizeTikTokUsername(input)
	if err != nil {
		return "", err
	}
	if timeoutSeconds <= 0 {
		timeoutSeconds = 10
	}
	result, err := golive.CheckOnline(username, time.Duration(timeoutSeconds)*time.Second)
	if err != nil {
		return "", err
	}
	return result.RoomID, nil
}

// GetTikTokRoomInfo exposes room metadata and stream URLs. Cookies are passed
// only for this call and are never stored by App.
func (a *App) GetTikTokRoomInfo(roomID string, timeoutSeconds int, cookies string) (*tthttp.RoomInfo, error) {
	if strings.TrimSpace(roomID) == "" {
		return nil, fmt.Errorf("TikTok room ID is required")
	}
	if timeoutSeconds <= 0 {
		timeoutSeconds = 10
	}
	return golive.FetchRoomInfo(roomID, time.Duration(timeoutSeconds)*time.Second, cookies)
}

func (a *App) fetchTikTokMetadata(state *tiktokSessionState) {
	timeout := state.options.TimeoutSeconds
	if timeout <= 0 {
		timeout = 10
	}
	room, roomErr := golive.FetchRoomInfo(state.roomID, time.Duration(timeout)*time.Second, state.options.Cookies)
	if roomErr != nil {
		a.emitTikTokDiagnostic(state, "room_info_error", roomErr.Error())
	} else {
		a.emitTikTokSyntheticEvent(state, TikTokEventPayload{
			ID: "room-info-" + state.roomID, Type: "room_info", Category: "profile",
			Timestamp: time.Now().UTC().Format(time.RFC3339Nano), Summary: room.Title, Data: jsonCompatible(room),
		})
	}

	profileCache := helpers.NewProfileCache()
	if state.options.Proxy != "" {
		profileCache.WithProxy(state.options.Proxy)
	}
	if state.options.UserAgent != "" {
		profileCache.WithUserAgent(state.options.UserAgent)
	}
	if state.options.Cookies != "" {
		profileCache.WithCookies(state.options.Cookies)
	}
	profile, profileErr := profileCache.Fetch(state.username)
	if profileErr != nil {
		a.emitTikTokDiagnostic(state, "profile_error", profileErr.Error())
	} else {
		a.emitTikTokSyntheticEvent(state, TikTokEventPayload{
			ID: "profile-" + state.username, Type: "creator_profile", Category: "profile",
			Timestamp: time.Now().UTC().Format(time.RFC3339Nano), Summary: profile.Nickname, Data: jsonCompatible(profile),
		})
	}
}

func (a *App) emitTikTokDiagnostic(state *tiktokSessionState, eventType string, detail string) {
	a.emitTikTokSyntheticEvent(state, TikTokEventPayload{
		ID: fmt.Sprintf("%s-%d", eventType, time.Now().UnixNano()), Type: eventType, Category: "diagnostic",
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano), Summary: detail, Data: map[string]interface{}{"detail": detail},
	})
}

func (a *App) emitTikTokSyntheticEvent(state *tiktokSessionState, payload TikTokEventPayload) {
	if a.emitTikTok(state.generation, "tiktok_event", payload) {
		a.emitTikTok(state.generation, "chat_message", tiktokAdvancedItem(payload))
	}
}

func jsonCompatible(value interface{}) interface{} {
	encoded, err := json.Marshal(value)
	if err != nil {
		return map[string]interface{}{"value": fmt.Sprint(value)}
	}
	var decoded interface{}
	if json.Unmarshal(encoded, &decoded) != nil {
		return map[string]interface{}{"value": fmt.Sprint(value)}
	}
	return decoded
}

func (a *App) routeTikTokContentEvent(evt events.Event, eventPayload TikTokEventPayload, state *tiktokSessionState) {
	var item map[string]interface{}
	switch evt.Type {
	case events.EventChat:
		if msg, ok := evt.Data.(*pb.WebcastChatMessage); ok {
			item = tiktokChatItem(msg, eventPayload)
		}
	case events.EventEmoteChat:
		if msg, ok := evt.Data.(*pb.WebcastEmoteChatMessage); ok {
			item = tiktokEmoteChatItem(msg, eventPayload)
		}
	case events.EventGift:
		if msg, ok := evt.Data.(*pb.WebcastGiftMessage); ok {
			item = tiktokGiftItem(msg, state.giftTracker.Process(msg), eventPayload)
		}
	case events.EventFollow:
		if msg, ok := evt.Data.(*pb.WebcastSocialMessage); ok {
			item = tiktokActivityItem("follow", msg.Common, msg.User, "followed the creator", eventPayload)
		}
	case events.EventShare:
		if msg, ok := evt.Data.(*pb.WebcastSocialMessage); ok {
			item = tiktokActivityItem("share", msg.Common, msg.User, "shared the LIVE", eventPayload)
		}
	case events.EventJoin:
		if msg, ok := evt.Data.(*pb.WebcastMemberMessage); ok {
			item = tiktokActivityItem("join", msg.Common, msg.User, "joined the LIVE", eventPayload)
		}
	case events.EventSubNotify:
		if msg, ok := evt.Data.(*pb.WebcastSubNotifyMessage); ok {
			summary := "subscribed"
			if msg.SubMonth > 0 {
				summary = fmt.Sprintf("subscribed for %d month(s)", msg.SubMonth)
			}
			item = tiktokActivityItem("subscription", msg.Common, msg.User, summary, eventPayload)
		}
	case events.EventSubscriptionNotify:
		if msg, ok := evt.Data.(*pb.WebcastSubscriptionNotifyMessage); ok {
			item = tiktokActivityItem("subscription", msg.Common, msg.User, "subscription update", eventPayload)
		}
	case events.EventQuestionNew:
		if msg, ok := evt.Data.(*pb.WebcastQuestionNewMessage); ok && msg.Details != nil {
			item = tiktokActivityItem("question", msg.Common, msg.Details.User, msg.Details.Text, eventPayload)
		}
	case events.EventLike:
		if msg, ok := evt.Data.(*pb.WebcastLikeMessage); ok {
			stats := state.likeTracker.Process(msg)
			item = tiktokMetricItem("like", msg.Common, msg.User, fmt.Sprintf("sent %d like(s)", msg.Count), eventPayload)
			a.emitTikTokMetrics(state, stats)
		}
	case events.EventRoomUserSeq:
		if msg, ok := evt.Data.(*pb.WebcastRoomUserSeqMessage); ok {
			state.viewerCount = msg.Total
			state.totalUsers = msg.TotalUser
			item = tiktokMetricItem("audience", msg.Common, nil, fmt.Sprintf("%d viewer(s)", msg.Total), eventPayload)
			a.emitTikTokMetrics(state, helpers.LikeStats{})
		}
	default:
		item = tiktokAdvancedItem(eventPayload)
	}
	if item != nil {
		a.emitTikTok(state.generation, "chat_message", item)
	}
}

func (a *App) emitTikTokStatus(state *tiktokSessionState, status string, detail string) {
	a.emitTikTok(state.generation, "tiktok_status", TikTokStatusPayload{
		Username:       state.username,
		RoomID:         state.roomID,
		State:          status,
		Connected:      status == "connected",
		Reconnecting:   status == "reconnecting",
		ViewerCount:    state.viewerCount,
		TotalUserCount: state.totalUsers,
		TotalLikes:     state.totalLikes,
		SessionLikes:   state.sessionLikes,
		LastEventType:  state.lastEventType,
		Detail:         detail,
	})
}

func (a *App) emitTikTokMetrics(state *tiktokSessionState, likes helpers.LikeStats) {
	if likes.TotalLikeCount > 0 || likes.AccumulatedCount > 0 {
		state.totalLikes = likes.TotalLikeCount
		state.sessionLikes = likes.AccumulatedCount
	}
	payload := TikTokStatusPayload{
		Username:       state.username,
		RoomID:         state.roomID,
		State:          "connected",
		Connected:      state.connected,
		ViewerCount:    state.viewerCount,
		TotalUserCount: state.totalUsers,
		TotalLikes:     state.totalLikes,
		SessionLikes:   state.sessionLikes,
		LastEventType:  state.lastEventType,
	}
	a.emitTikTok(state.generation, "tiktok_metrics", payload)
}

func describeTikTokEvent(t events.EventType) tiktokEventDescriptor {
	descriptors := map[events.EventType]tiktokEventDescriptor{
		events.EventConnected: {"connected", "lifecycle"}, events.EventReconnecting: {"reconnecting", "lifecycle"}, events.EventDisconnected: {"disconnected", "lifecycle"},
		events.EventChat: {"chat", "chat"}, events.EventGift: {"gift", "gift"}, events.EventLike: {"like", "metrics"}, events.EventMember: {"member", "activity"}, events.EventSocial: {"social", "activity"}, events.EventRoomUserSeq: {"room_user_seq", "metrics"}, events.EventControl: {"control", "moderation"},
		events.EventFollow: {"follow", "activity"}, events.EventShare: {"share", "activity"}, events.EventJoin: {"join", "activity"}, events.EventLiveEnded: {"live_ended", "lifecycle"},
		events.EventLiveIntro: {"live_intro", "system"}, events.EventRoomMessage: {"room_message", "system"}, events.EventCaption: {"caption", "content"}, events.EventGoalUpdate: {"goal_update", "goals"}, events.EventImDelete: {"im_delete", "moderation"},
		events.EventRankUpdate: {"rank_update", "rankings"}, events.EventPoll: {"poll", "interaction"}, events.EventEnvelope: {"envelope", "interaction"}, events.EventRoomPin: {"room_pin", "interaction"}, events.EventUnauthorizedMember: {"unauthorized_member", "moderation"},
		events.EventLinkMicMethod: {"link_mic_method", "link_mic"}, events.EventLinkMicBattle: {"link_mic_battle", "link_mic"}, events.EventLinkMicArmies: {"link_mic_armies", "link_mic"}, events.EventLinkMessage: {"link_message", "link_mic"}, events.EventLinkLayer: {"link_layer", "link_mic"}, events.EventLinkMicLayoutState: {"link_mic_layout_state", "link_mic"},
		events.EventGiftPanelUpdate: {"gift_panel_update", "gift"}, events.EventInRoomBanner: {"in_room_banner", "system"}, events.EventGuide: {"guide", "system"},
		events.EventEmoteChat: {"emote_chat", "chat"}, events.EventQuestionNew: {"question_new", "interaction"}, events.EventSubNotify: {"sub_notify", "subscription"}, events.EventBarrage: {"barrage", "system"}, events.EventHourlyRank: {"hourly_rank", "rankings"}, events.EventMsgDetect: {"msg_detect", "moderation"}, events.EventLinkMicFanTicket: {"link_mic_fan_ticket", "link_mic"}, events.EventRoomVerify: {"room_verify", "moderation"}, events.EventOecLiveShopping: {"oec_live_shopping", "commerce"}, events.EventGiftBroadcast: {"gift_broadcast", "gift"}, events.EventRankText: {"rank_text", "rankings"}, events.EventGiftDynamicRestriction: {"gift_dynamic_restriction", "gift"}, events.EventViewerPicksUpdate: {"viewer_picks_update", "rankings"},
		events.EventSystemMessage: {"system_message", "system"}, events.EventLiveGameIntro: {"live_game_intro", "games"}, events.EventAccessControl: {"access_control", "moderation"}, events.EventAccessRecall: {"access_recall", "moderation"}, events.EventAlertBoxAuditResult: {"alert_box_audit_result", "moderation"}, events.EventBindingGift: {"binding_gift", "gift"}, events.EventBoostCard: {"boost_card", "games"}, events.EventBottomMessage: {"bottom_message", "system"}, events.EventGameRankNotify: {"game_rank_notify", "games"}, events.EventGiftPrompt: {"gift_prompt", "gift"}, events.EventLinkState: {"link_state", "link_mic"}, events.EventLinkMicBattlePunishFinish: {"link_mic_battle_punish_finish", "link_mic"}, events.EventLinkmicBattleTask: {"link_mic_battle_task", "link_mic"}, events.EventMarqueeAnnouncement: {"marquee_announcement", "system"}, events.EventNotice: {"notice", "system"}, events.EventNotify: {"notify", "system"}, events.EventPartnershipDropsUpdate: {"partnership_drops_update", "partnerships"}, events.EventPartnershipGameOffline: {"partnership_game_offline", "partnerships"}, events.EventPartnershipPunish: {"partnership_punish", "partnerships"}, events.EventPerception: {"perception", "system"}, events.EventSpeaker: {"speaker", "system"}, events.EventSubCapsule: {"sub_capsule", "subscription"}, events.EventSubPinEvent: {"sub_pin_event", "subscription"}, events.EventSubscriptionNotify: {"subscription_notify", "subscription"}, events.EventToast: {"toast", "system"},
		events.EventUnknown: {"unknown", "unknown"},
	}
	if value, ok := descriptors[t]; ok {
		return value
	}
	return tiktokEventDescriptor{Name: fmt.Sprintf("event_%d", t), Category: "unknown"}
}

func makeTikTokEventPayload(evt events.Event, desc tiktokEventDescriptor, state *tiktokSessionState) TikTokEventPayload {
	state.activitySeq++
	id, ts := tiktokEventIdentity(evt.Data, state.activitySeq)
	payload := TikTokEventPayload{
		ID:        id,
		Type:      desc.Name,
		Category:  desc.Category,
		Timestamp: ts,
		Summary:   summarizeTikTokEvent(evt, desc),
		Data:      safeTikTokEventData(evt.Data),
	}
	if unknown, ok := evt.Data.(*events.UnknownEvent); ok {
		payload.Summary = "Unknown TikTok event: " + unknown.Method
		payload.RawPayloadBase64 = base64.StdEncoding.EncodeToString(unknown.Payload)
		payload.Data = map[string]interface{}{"method": unknown.Method, "payloadBytes": len(unknown.Payload)}
	}
	return payload
}

func safeTikTokEventData(data interface{}) interface{} {
	if data == nil {
		return nil
	}
	if msg, ok := data.(proto.Message); ok {
		encoded, err := protojson.MarshalOptions{UseProtoNames: false, EmitUnpopulated: false}.Marshal(msg)
		if err == nil {
			var value interface{}
			if json.Unmarshal(encoded, &value) == nil {
				return value
			}
		}
	}
	if value, ok := data.(string); ok {
		return map[string]interface{}{"detail": value}
	}
	return map[string]interface{}{"value": fmt.Sprint(data)}
}

func tiktokEventIdentity(data interface{}, fallback uint64) (string, string) {
	now := time.Now().UTC()
	if msg, ok := data.(interface{ GetCommon() *pb.Common }); ok {
		common := msg.GetCommon()
		if common != nil {
			id := strconv.FormatInt(common.MsgId, 10)
			if common.MsgId == 0 {
				id = fmt.Sprintf("local-%d", fallback)
			}
			return id, tiktokTimestamp(common.CreateTime)
		}
	}
	return fmt.Sprintf("local-%d", fallback), now.Format(time.RFC3339Nano)
}

func tiktokTimestamp(value int64) string {
	if value <= 0 {
		return time.Now().UTC().Format(time.RFC3339Nano)
	}
	var t time.Time
	if value > 10_000_000_000 {
		t = time.UnixMilli(value)
	} else {
		t = time.Unix(value, 0)
	}
	return t.UTC().Format(time.RFC3339Nano)
}

func summarizeTikTokEvent(evt events.Event, desc tiktokEventDescriptor) string {
	switch msg := evt.Data.(type) {
	case *pb.WebcastChatMessage:
		return tiktokUserName(msg.User) + ": " + msg.Content
	case *pb.WebcastGiftMessage:
		gift := "gift"
		if msg.Gift != nil && msg.Gift.Name != "" {
			gift = msg.Gift.Name
		}
		return fmt.Sprintf("%s sent %s ×%d", tiktokUserName(msg.User), gift, maxInt32(msg.RepeatCount, 1))
	case *pb.WebcastLikeMessage:
		return fmt.Sprintf("%s sent %d like(s)", tiktokUserName(msg.User), msg.Count)
	case *pb.WebcastQuestionNewMessage:
		if msg.Details != nil {
			return tiktokUserName(msg.Details.User) + " asked: " + msg.Details.Text
		}
	}
	return strings.ReplaceAll(desc.Name, "_", " ")
}

func tiktokChatItem(msg *pb.WebcastChatMessage, event TikTokEventPayload) map[string]interface{} {
	owner, mod, sub, verified := tiktokRoles(msg.User, msg.UserIdentity)
	return map[string]interface{}{
		"Platform": "tiktok", "ID": event.ID, "EventKind": "chat", "TikTokEvent": event,
		"Author": tiktokAuthor(msg.User), "TikTokUser": tiktokUserMeta(msg.User, msg.UserIdentity), "Message": tiktokIndexedMessageParts(msg.Content, msg.EmotesList),
		"IsOwner": owner, "IsModerator": mod, "IsMembership": sub, "IsVerified": verified,
		"Timestamp": event.Timestamp,
	}
}

func tiktokEmoteChatItem(msg *pb.WebcastEmoteChatMessage, event TikTokEventPayload) map[string]interface{} {
	owner, mod, sub, verified := tiktokRoles(msg.User, msg.UserIdentity)
	parts := make([]twitchMessagePart, 0, len(msg.EmoteList))
	for _, emote := range msg.EmoteList {
		if part := tiktokEmotePart(emote); part != nil {
			parts = append(parts, part)
		}
	}
	return map[string]interface{}{
		"Platform": "tiktok", "ID": event.ID, "EventKind": "emote", "TikTokEvent": event,
		"Author": tiktokAuthor(msg.User), "TikTokUser": tiktokUserMeta(msg.User, msg.UserIdentity), "Message": parts,
		"IsOwner": owner, "IsModerator": mod, "IsMembership": sub, "IsVerified": verified,
		"Timestamp": event.Timestamp,
	}
}

func tiktokGiftItem(msg *pb.WebcastGiftMessage, streak helpers.GiftStreakEvent, event TikTokEventPayload) map[string]interface{} {
	owner, mod, sub, verified := tiktokRoles(msg.User, msg.UserIdentity)
	name := fmt.Sprintf("Gift #%d", msg.GiftId)
	imageURL := ""
	diamondEach := int32(0)
	isCombo := false
	if msg.Gift != nil {
		if msg.Gift.Name != "" {
			name = msg.Gift.Name
		}
		imageURL = firstTikTokImageURL(msg.Gift.Image, msg.Gift.Icon, msg.Gift.PreviewImage)
		diamondEach = msg.Gift.DiamondCount
		isCombo = msg.Gift.Type == 1
	}
	id := event.ID
	updateExisting := false
	if isCombo && msg.GroupId != 0 {
		id = "gift-streak-" + strconv.FormatInt(msg.GroupId, 10)
		updateExisting = true
	}
	count := streak.TotalGiftCount
	if count < 1 {
		count = maxInt32(msg.RepeatCount, 1)
	}
	return map[string]interface{}{
		"Platform": "tiktok", "ID": id, "EventKind": "gift", "TikTokEvent": event, "UpdateExisting": updateExisting,
		"Author": tiktokAuthor(msg.User), "TikTokUser": tiktokUserMeta(msg.User, msg.UserIdentity), "Message": []twitchMessagePart{{"Text": fmt.Sprintf("sent %s ×%d", name, count)}},
		"Gift": map[string]interface{}{
			"Name": name, "Count": count, "EventCount": streak.EventGiftCount,
			"DiamondCount": streak.TotalDiamondCount, "EventDiamondCount": streak.EventDiamondCount,
			"DiamondEach": diamondEach, "Image": map[string]interface{}{"URL": imageURL, "Alt": name},
			"IsCombo": isCombo, "IsFinal": streak.IsFinal, "GroupID": strconv.FormatInt(msg.GroupId, 10),
		},
		"IsOwner": owner, "IsModerator": mod, "IsMembership": sub, "IsVerified": verified,
		"Timestamp": event.Timestamp,
	}
}

func tiktokActivityItem(kind string, common *pb.Common, user *pb.User, summary string, event TikTokEventPayload) map[string]interface{} {
	owner, mod, sub, verified := tiktokRoles(user, nil)
	return map[string]interface{}{
		"Platform": "tiktok", "ID": kind + "-" + event.ID, "EventKind": kind, "TikTokEvent": event,
		"Author": tiktokAuthor(user), "TikTokUser": tiktokUserMeta(user, nil), "Message": []twitchMessagePart{{"Text": summary}},
		"IsOwner": owner, "IsModerator": mod, "IsMembership": sub || kind == "subscription", "IsVerified": verified,
		"Timestamp": event.Timestamp,
	}
}

func tiktokMetricItem(kind string, common *pb.Common, user *pb.User, summary string, event TikTokEventPayload) map[string]interface{} {
	item := tiktokActivityItem(kind, common, user, summary, event)
	item["EventKind"] = "metrics"
	item["ID"] = "metrics-" + event.Type + "-" + event.ID
	return item
}

func tiktokAdvancedItem(event TikTokEventPayload) map[string]interface{} {
	return map[string]interface{}{
		"Platform": "tiktok", "ID": event.Type + "-" + event.ID, "EventKind": "advanced", "TikTokEvent": event,
		"Author":  map[string]interface{}{"Name": "TikTok LIVE", "ChannelID": "system", "Thumbnail": map[string]interface{}{"URL": "", "Alt": "TikTok"}},
		"Message": []twitchMessagePart{{"Text": event.Summary}},
		"IsOwner": false, "IsModerator": false, "IsMembership": false, "IsVerified": false,
		"Timestamp": event.Timestamp,
	}
}

func tiktokAuthor(user *pb.User) map[string]interface{} {
	name := tiktokUserName(user)
	channelID := ""
	avatar := ""
	if user != nil {
		channelID = firstNonEmpty(user.IdStr, user.UniqueId, user.DisplayId)
		if channelID == "" && user.Id != 0 {
			channelID = strconv.FormatInt(user.Id, 10)
		}
		avatar = firstTikTokImageURL(user.AvatarThumb, user.AvatarMedium, user.AvatarLarge)
	}
	return map[string]interface{}{
		"Name": name, "ChannelID": channelID,
		"Thumbnail": map[string]interface{}{"URL": avatar, "Alt": name},
	}
}

func tiktokRoles(user *pb.User, identity *pb.UserIdentity) (owner, mod, sub, verified bool) {
	if identity != nil {
		owner = identity.IsAnchor
		mod = identity.IsModeratorOfAnchor
		sub = identity.IsSubscriberOfAnchor
	}
	if user != nil {
		verified = user.Verified
		if user.UserAttr != nil {
			mod = mod || user.UserAttr.IsAdmin || user.UserAttr.IsSuperAdmin
		}
		sub = sub || user.IsSubscribe
		if user.SubscribeInfo != nil {
			sub = sub || user.SubscribeInfo.IsSubscribe || user.SubscribeInfo.IsSubscribedToAnchor
		}
	}
	return
}

func tiktokUserMeta(user *pb.User, identity *pb.UserIdentity) map[string]interface{} {
	owner, mod, sub, _ := tiktokRoles(user, identity)
	uniqueID := ""
	gifterLevel := int64(0)
	fanClubLevel := int32(0)
	isFollower := false
	if user != nil {
		uniqueID = firstNonEmpty(user.UniqueId, user.DisplayId, user.IdStr)
		if user.PayGrade != nil {
			gifterLevel = user.PayGrade.Level
		}
		if user.FansClub != nil && user.FansClub.Data != nil {
			fanClubLevel = user.FansClub.Data.Level
		}
		isFollower = user.IsFollower || user.FollowStatus > 0
	}
	if identity != nil {
		isFollower = isFollower || identity.IsFollowerOfAnchor
	}
	return map[string]interface{}{
		"UniqueID": uniqueID, "GifterLevel": gifterLevel, "FanClubLevel": fanClubLevel,
		"IsFollower": isFollower, "IsSubscriber": sub, "IsModerator": mod, "IsAnchor": owner,
	}
}

func tiktokIndexedMessageParts(content string, indexed []*pb.WebcastChatMessage_EmoteWithIndex) []twitchMessagePart {
	if len(indexed) == 0 {
		return []twitchMessagePart{{"Text": content}}
	}
	runes := []rune(content)
	sort.SliceStable(indexed, func(i, j int) bool { return indexed[i].Index < indexed[j].Index })
	parts := make([]twitchMessagePart, 0, len(indexed)*2+1)
	cursor := 0
	for _, entry := range indexed {
		if entry == nil || entry.Emote == nil {
			continue
		}
		idx := int(entry.Index)
		if idx < cursor || idx > len(runes) {
			continue
		}
		if idx > cursor {
			parts = append(parts, twitchMessagePart{"Text": string(runes[cursor:idx])})
		}
		if part := tiktokEmotePart(entry.Emote); part != nil {
			parts = append(parts, part)
		}
		cursor = idx
	}
	if cursor < len(runes) {
		parts = append(parts, twitchMessagePart{"Text": string(runes[cursor:])})
	}
	if len(parts) == 0 {
		return []twitchMessagePart{{"Text": content}}
	}
	return parts
}

func tiktokEmotePart(emote *pb.Emote) twitchMessagePart {
	if emote == nil {
		return nil
	}
	url := firstTikTokImageURL(emote.Image)
	if url == "" {
		return nil
	}
	name := firstNonEmpty(emote.EmoteId, emote.Uuid, "TikTok emote")
	return twitchMessagePart{
		"Text": "",
		"EmojiItem": map[string]interface{}{
			"URL": url, "Alt": name, "EmojiText": name, "IsCustomEmoji": true,
		},
	}
}

func firstTikTokImageURL(images ...*pb.Image) string {
	for _, image := range images {
		if image == nil {
			continue
		}
		for _, candidate := range image.UrlList {
			if strings.TrimSpace(candidate) != "" {
				return candidate
			}
		}
	}
	return ""
}

func tiktokUserName(user *pb.User) string {
	if user == nil {
		return "TikTok user"
	}
	return firstNonEmpty(user.Nickname, user.UniqueId, user.DisplayId, "TikTok user")
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func maxInt32(value, minimum int32) int32 {
	if value < minimum {
		return minimum
	}
	return value
}

// Keep utf8 imported in builds where rune conversion is optimized by the compiler;
// it also documents that TikTok emote indexes are validated against UTF-8 content.
var _ = utf8.RuneCountInString
