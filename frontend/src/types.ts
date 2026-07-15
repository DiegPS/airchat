export interface ImageItem {
  URL: string;
  Alt: string;
}

export interface EmojiItem extends ImageItem {
  EmojiText: string;
  IsCustomEmoji: boolean;
}

export interface MessageItem {
  Text: string;
  EmojiItem?: EmojiItem;
}

export interface Badge {
  Thumbnail: ImageItem;
  Label: string;
}

export interface SuperChat {
  Amount: string;
  Color: string;
  Sticker?: ImageItem;
}

export interface Author {
  Name: string;
  Thumbnail: ImageItem;
  ChannelID: string;
  Badge?: Badge;
}

export interface ChatItem {
  ID: string;
  Platform?: 'youtube' | 'twitch' | 'kick' | 'tiktok';
  EventKind?: 'chat' | 'emote' | 'gift' | 'subscription' | 'follow' | 'share' | 'join' | 'question' | 'metrics' | 'advanced';
  Author: Author;
  Message: MessageItem[] | null;
  SuperChat?: SuperChat;
  Gift?: TikTokGift;
  TikTokEvent?: TikTokEvent;
  TikTokUser?: TikTokUserMeta;
  UpdateExisting?: boolean;
  IsMembership: boolean;
  IsVerified: boolean;
  IsOwner: boolean;
  IsModerator: boolean;
  Timestamp: string;
}

export interface TikTokGift {
  Name: string;
  Count: number;
  EventCount: number;
  DiamondCount: number;
  EventDiamondCount: number;
  DiamondEach: number;
  Image?: ImageItem;
  IsCombo: boolean;
  IsFinal: boolean;
  GroupID: string;
}

export interface TikTokEvent {
  id: string;
  type: string;
  category: string;
  timestamp: string;
  summary: string;
  data?: unknown;
  rawPayloadBase64?: string;
}

export interface TikTokUserMeta {
  UniqueID: string;
  GifterLevel: number;
  FanClubLevel: number;
  IsFollower: boolean;
  IsSubscriber: boolean;
  IsModerator: boolean;
  IsAnchor: boolean;
}

export interface ChatSettings {
  settingsStatusMessage: string;
  fontSize: number;
  bgOpacity: number;
  messageOpacity: number;
  showAvatars: boolean;
  showBadges: boolean;
  showTimestamp: boolean;
  chromaMode: boolean;
  chromaColor: string;
  textStroke: number;
  textStrokeColor: string;
  threeDEnabled: boolean;
  hideScrollbar: boolean;
  perspective: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  skewX: number;
  skewY: number;
  scale: number;
  showGrid: boolean;
  // New Design Options
  lineHeight: number;
  messageGap: number;
  fontWeight: number;
  borderRadius: number;
  textShadow: boolean;
  showBubble: boolean;
  superChatBarEnabled: boolean;
  superChatBarColor: string;
  superChatBarWidth: number;
  maxMessages: number;
  animation: string;
  animationDuration: number;
  textAlign: string;
  // OBS Settings
  obsEnabled: boolean;
  obsHost: string;
  obsPassword: string;
  obsConnected: boolean; // Virtual state for UI button
  obsStatusMessage: string;
  // OBS HUD Customization
  obsHudPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  obsHudOpacity: number;
  obsHudScale: number;
  obsHudShowFps: boolean;
  obsHudShowBitrate: boolean;
  obsHudShowMic: boolean;
  obsHudShowDesktop: boolean;
  obsHudShowScene: boolean;

  // Platform Settings
  showPlatformBadge: boolean;
  youtubeBubbleAccent: boolean;
  twitchBubbleAccent: boolean;
  kickBubbleAccent: boolean;
  tiktokBubbleAccent: boolean;

  // TikTok event visibility
  tiktokShowChat: boolean;
  tiktokShowEmotes: boolean;
  tiktokShowGifts: boolean;
  tiktokShowSubscriptions: boolean;
  tiktokShowFollows: boolean;
  tiktokShowShares: boolean;
  tiktokShowJoins: boolean;
  tiktokShowQuestions: boolean;
  tiktokShowMetrics: boolean;
  tiktokShowActivityEvents: boolean;
  tiktokShowContent: boolean;
  tiktokShowGoals: boolean;
  tiktokShowInteraction: boolean;
  tiktokShowRankings: boolean;
  tiktokShowLinkMic: boolean;
  tiktokShowSystem: boolean;
  tiktokShowCommerce: boolean;
  tiktokShowGames: boolean;
  tiktokShowPartnerships: boolean;
  tiktokShowModeration: boolean;
  tiktokShowProfileEvents: boolean;
  tiktokShowDiagnosticEvents: boolean;
  tiktokShowUnknown: boolean;

  // TikTok flow and audience filters
  tiktokJoinRateLimit: number;
  tiktokMetricIntervalSeconds: number;
  tiktokMinGiftDiamonds: number;
  tiktokMinGifterLevel: number;
  tiktokOnlyFollowers: boolean;
  tiktokOnlySubscribers: boolean;
  tiktokOnlyModerators: boolean;

  // TikTok connection
  tiktokCDN: 'global' | 'eu' | 'us' | 'custom';
  tiktokCustomCDN: string;
  tiktokTimeoutSeconds: number;
  tiktokMaxRetries: number;
  tiktokStaleTimeoutSeconds: number;
  tiktokCompress: boolean;
  tiktokLanguage: string;
  tiktokRegion: string;
  tiktokUserAgent: string;
  tiktokProxy: string;
  tiktokSessionCookies: string;

  // Filter Settings
  blockedUsers: string;
  blockedWords: string;
  // TTS Settings
  ttsEnabled: boolean;
  ttsStatusMessage: string;
  ttsMembersOnly: boolean; // New setting
  ttsAllowCustomUsers: boolean;
  ttsCustomUsersList: string;
  ttsCommandMode: boolean;
  ttsCommandPrefix: string;
  ttsSeparatorText: string;
  ttsRandomVoice: boolean;
  ttsProvider: string;
  ttsVoice: string;
  ttsReadTikTokGifts: boolean;
  ttsReadTikTokActivity: boolean;
  ttsReadTikTokAdvanced: boolean;
  // Supertonic TTS Settings
  supertonicVoiceStyle: string;
  supertonicLang: string;
  supertonicTotalStep: number;
  supertonicSpeed: number;
}
