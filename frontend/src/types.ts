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
  Author: Author;
  Message: MessageItem[] | null;
  SuperChat?: SuperChat;
  IsMembership: boolean;
  IsVerified: boolean;
  IsOwner: boolean;
  IsModerator: boolean;
  Timestamp: string;
}

export interface ChatSettings {
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
  maxMessages: number;
  animation: string;
  animationDuration: number;
  textAlign: string;
  // Subscriber Goal Settings
  showSubGoal: boolean;
  subGoalTitle: string;
  subGoalTarget: number;
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
  ttsEnabled: boolean;
  ttsCommandMode: boolean;
  ttsCommandPrefix: string;
  ttsSeparatorText: string;
  ttsRandomVoice: boolean;
  ttsProvider: string;
  ttsVoice: string;
  // Supertonic TTS Settings
  supertonicVoiceStyle: string;
  supertonicLang: string;
  supertonicTotalStep: number;
  supertonicSpeed: number;
}
