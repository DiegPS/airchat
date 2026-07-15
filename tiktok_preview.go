package main

import (
	"fmt"
	"time"

	"github.com/PirateTok/live-go/events"
	"github.com/PirateTok/live-go/helpers"
	pb "github.com/PirateTok/live-go/proto"
	"google.golang.org/protobuf/proto"
)

type tiktokPreviewFixture struct {
	method  string
	message proto.Message
}

// tiktokPreviewMessages builds preview events from the protobuf types and the
// decoder shipped by live-go. This keeps preview payloads aligned with the
// library instead of maintaining hand-written frontend-shaped maps.
func tiktokPreviewMessages(now time.Time) []map[string]interface{} {
	state := &tiktokSessionState{
		giftTracker: helpers.NewGiftStreakTracker(),
		likeTracker: helpers.NewLikeAccumulator(),
	}

	common := func(id int64, method string) *pb.Common {
		return &pb.Common{Method: method, MsgId: id, RoomId: 987654321, CreateTime: now.UnixMilli(), IsShowMsg: true}
	}
	image := func(url string) *pb.Image { return &pb.Image{UrlList: []string{url}} }
	user := func(id int64, nickname, uniqueID string) *pb.User {
		return &pb.User{
			Id: id, IdStr: fmt.Sprintf("%d", id), Nickname: nickname, UniqueId: uniqueID,
			AvatarThumb: image("https://i.pravatar.cc/100?u=" + uniqueID),
		}
	}

	creator := user(1001, "CreatorTikTok", "creator_tiktok")
	creator.Verified = true
	moderator := user(1002, "ModeratorTikTok", "mod_tiktok")
	moderator.UserAttr = &pb.User_UserAttr{IsAdmin: true}
	subscriber := user(1003, "TikTokSubscriber", "subscriber_tiktok")
	subscriber.IsSubscribe = true
	subscriber.IsFollower = true
	gifter := user(1004, "GiftGiver", "gift_giver")
	gifter.IsFollower = true
	gifter.PayGrade = &pb.User_PayGrade{Level: 18}
	gifter.FansClub = &pb.User_FansClub{Data: &pb.User_FansClub_FansClubData{ClubName: "AirChat", Level: 7, AnchorId: creator.Id}}
	follower := user(1005, "NewFollower", "new_follower")
	sharer := user(1006, "LiveSharer", "live_sharer")
	joiner := user(1007, "NewViewer", "new_viewer")
	questioner := user(1008, "CuriousViewer", "curious_viewer")

	emoteImage := image("https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/802a21ae29f9fae5abe3693de9f874bd~tplv-obj.image")
	emote := &pb.Emote{EmoteId: "preview-emote", Image: emoteImage}
	roseImage := image("https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.png")

	fixtures := []tiktokPreviewFixture{
		{
			method: "WebcastChatMessage",
			message: &pb.WebcastChatMessage{
				Common: common(2001, "WebcastChatMessage"), User: creator,
				Content: "TikTok LIVE chat from the creator", UserIdentity: &pb.UserIdentity{IsAnchor: true},
			},
		},
		{
			method: "WebcastChatMessage",
			message: &pb.WebcastChatMessage{
				Common: common(2002, "WebcastChatMessage"), User: moderator,
				Content:      "Moderator message with an indexed emote",
				EmotesList:   []*pb.WebcastChatMessage_EmoteWithIndex{{Index: 23, Emote: emote}},
				UserIdentity: &pb.UserIdentity{IsModeratorOfAnchor: true},
			},
		},
		{
			method: "WebcastEmoteChatMessage",
			message: &pb.WebcastEmoteChatMessage{
				Common: common(2003, "WebcastEmoteChatMessage"), User: subscriber,
				EmoteList: []*pb.Emote{emote}, UserIdentity: &pb.UserIdentity{IsSubscriberOfAnchor: true, IsFollowerOfAnchor: true},
			},
		},
		{
			method: "WebcastGiftMessage",
			message: &pb.WebcastGiftMessage{
				Common: common(2004, "WebcastGiftMessage"), GiftId: 5655, User: gifter, RepeatCount: 1, RepeatEnd: 1,
				Gift:         &pb.GiftStruct{Id: 5655, Name: "Rose", Type: 0, DiamondCount: 1, Image: roseImage},
				UserIdentity: &pb.UserIdentity{IsGiftGiverOfAnchor: true, IsFollowerOfAnchor: true},
			},
		},
		{
			method: "WebcastGiftMessage",
			message: &pb.WebcastGiftMessage{
				Common: common(2005, "WebcastGiftMessage"), GiftId: 5655, GroupId: 7001, User: gifter, RepeatCount: 3,
				Gift:         &pb.GiftStruct{Id: 5655, Name: "Rose", Type: 1, Combo: true, DiamondCount: 1, Image: roseImage},
				UserIdentity: &pb.UserIdentity{IsGiftGiverOfAnchor: true, IsFollowerOfAnchor: true},
			},
		},
		{
			method: "WebcastGiftMessage",
			message: &pb.WebcastGiftMessage{
				Common: common(2006, "WebcastGiftMessage"), GiftId: 5655, GroupId: 7001, User: gifter, RepeatCount: 8, RepeatEnd: 1,
				Gift:         &pb.GiftStruct{Id: 5655, Name: "Rose", Type: 1, Combo: true, DiamondCount: 1, Image: roseImage},
				UserIdentity: &pb.UserIdentity{IsGiftGiverOfAnchor: true, IsFollowerOfAnchor: true},
			},
		},
		{method: "WebcastSocialMessage", message: &pb.WebcastSocialMessage{Common: common(2007, "WebcastSocialMessage"), User: follower, Action: 1, FollowCount: 451}},
		{method: "WebcastSocialMessage", message: &pb.WebcastSocialMessage{Common: common(2008, "WebcastSocialMessage"), User: sharer, Action: 2, ShareType: 1, ShareCount: 32}},
		{method: "WebcastMemberMessage", message: &pb.WebcastMemberMessage{Common: common(2009, "WebcastMemberMessage"), User: joiner, MemberCount: 128, Action: pb.MemberMessageAction_JOINED}},
		{method: "WebcastSubNotifyMessage", message: &pb.WebcastSubNotifyMessage{Common: common(2010, "WebcastSubNotifyMessage"), User: subscriber, SubMonth: 6, IsSend: true}},
		{method: "WebcastSubscriptionNotifyMessage", message: &pb.WebcastSubscriptionNotifyMessage{Common: common(2011, "WebcastSubscriptionNotifyMessage"), User: subscriber, ExhibitionType: 1}},
		{
			method: "WebcastQuestionNewMessage",
			message: &pb.WebcastQuestionNewMessage{
				Common:  common(2012, "WebcastQuestionNewMessage"),
				Details: &pb.WebcastQuestionNewMessage_QuestionDetails{Id: 9001, Text: "What is your next stream?", TimeStamp: uint64(now.Unix()), User: questioner},
			},
		},
		{method: "WebcastLikeMessage", message: &pb.WebcastLikeMessage{Common: common(2013, "WebcastLikeMessage"), User: follower, Count: 12, Total: 1540}},
		{method: "WebcastRoomUserSeqMessage", message: &pb.WebcastRoomUserSeqMessage{Common: common(2014, "WebcastRoomUserSeqMessage"), Total: 128, TotalUser: 842, Popularity: 73}},
	}

	items := make([]map[string]interface{}, 0, len(fixtures)+4)
	for _, fixture := range fixtures {
		payload, err := proto.Marshal(fixture.message)
		if err != nil {
			continue
		}
		for _, event := range events.Decode(fixture.method, payload) {
			desc := describeTikTokEvent(event.Type)
			eventPayload := makeTikTokEventPayload(event, desc, state)
			if item := tiktokPreviewItem(event, eventPayload, state); item != nil {
				items = append(items, item)
			}
		}
	}

	unknown := events.Decode("WebcastAirChatFutureMessage", []byte{0x08, 0x01})
	for _, event := range unknown {
		desc := describeTikTokEvent(event.Type)
		items = append(items, tiktokAdvancedItem(makeTikTokEventPayload(event, desc, state)))
	}

	return items
}

func tiktokPreviewItem(event events.Event, payload TikTokEventPayload, state *tiktokSessionState) map[string]interface{} {
	switch msg := event.Data.(type) {
	case *pb.WebcastChatMessage:
		return tiktokChatItem(msg, payload)
	case *pb.WebcastEmoteChatMessage:
		return tiktokEmoteChatItem(msg, payload)
	case *pb.WebcastGiftMessage:
		return tiktokGiftItem(msg, state.giftTracker.Process(msg), payload)
	case *pb.WebcastSocialMessage:
		switch event.Type {
		case events.EventFollow:
			return tiktokActivityItem("follow", msg.Common, msg.User, "followed the creator", payload)
		case events.EventShare:
			return tiktokActivityItem("share", msg.Common, msg.User, "shared the LIVE", payload)
		}
	case *pb.WebcastMemberMessage:
		if event.Type == events.EventJoin {
			return tiktokActivityItem("join", msg.Common, msg.User, "joined the LIVE", payload)
		}
	case *pb.WebcastSubNotifyMessage:
		summary := "subscribed"
		if msg.SubMonth > 0 {
			summary = fmt.Sprintf("subscribed for %d month(s)", msg.SubMonth)
		}
		return tiktokActivityItem("subscription", msg.Common, msg.User, summary, payload)
	case *pb.WebcastSubscriptionNotifyMessage:
		return tiktokActivityItem("subscription", msg.Common, msg.User, "subscription update", payload)
	case *pb.WebcastQuestionNewMessage:
		if msg.Details != nil {
			return tiktokActivityItem("question", msg.Common, msg.Details.User, msg.Details.Text, payload)
		}
	case *pb.WebcastLikeMessage:
		state.likeTracker.Process(msg)
		return tiktokMetricItem("like", msg.Common, msg.User, fmt.Sprintf("sent %d like(s)", msg.Count), payload)
	case *pb.WebcastRoomUserSeqMessage:
		state.viewerCount = msg.Total
		state.totalUsers = msg.TotalUser
		return tiktokMetricItem("audience", msg.Common, nil, fmt.Sprintf("%d viewer(s)", msg.Total), payload)
	}

	return tiktokAdvancedItem(payload)
}
