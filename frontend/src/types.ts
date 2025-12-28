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

export interface Author {
  Name: string;
  Thumbnail: ImageItem;
  ChannelID: string;
}

export interface ChatItem {
  ID: string;
  Author: Author;
  Message: MessageItem[];
  IsMembership: boolean;
  IsVerified: boolean;
  IsOwner: boolean;
  IsModerator: boolean;
  Timestamp: string;
}
