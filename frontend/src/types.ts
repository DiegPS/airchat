import { PlatformId } from './platforms';

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
  Platform?: PlatformId;
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
  twitchBubbleAccent: boolean;
  kickBubbleAccent: boolean;

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
  // Supertonic TTS Settings
  supertonicVoiceStyle: string;
  supertonicLang: string;
  supertonicTotalStep: number;
  supertonicSpeed: number;
}
