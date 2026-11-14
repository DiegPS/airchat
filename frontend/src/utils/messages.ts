import { ChatItem } from '../types';
import { isPlatformId } from '../platforms';
import { containsBlockedWord, isUserBlocked } from './filters';

export const DEFAULT_MESSAGE_LIMIT = 100;

/**
 * Validates a payload from the backend and fills the gaps the renderer
 * relies on. Returns null for payloads that cannot be shown.
 */
export function sanitizeIncoming(raw: unknown): ChatItem | null {
    const message = raw as Partial<ChatItem> | null | undefined;
    const name = message?.Author?.Name;
    if (!message || !name) return null;

    const parts = message.Message === null ? [] : message.Message;
    if (!Array.isArray(parts)) return null;

    return {
        ...(message as ChatItem),
        Platform: isPlatformId(message.Platform) ? message.Platform : undefined,
        Message: parts,
        Author: {
            ...message.Author!,
            Thumbnail: message.Author!.Thumbnail ?? { URL: '', Alt: name },
        },
    };
}

export interface BlockLists {
    blockedUsers: string;
    blockedWords: string;
}

/** True when the message must be hidden (and not read aloud). */
export const isBlocked = (message: ChatItem, { blockedUsers, blockedWords }: BlockLists): boolean =>
    isUserBlocked(message.Author.Name, blockedUsers) || containsBlockedWord(message.Message, blockedWords);

const sameMessage = (a: ChatItem, b: ChatItem) => a.Platform === b.Platform && a.ID === b.ID;

/**
 * Appends a message, skipping duplicates (same platform and ID) and keeping
 * only the newest `limit` messages.
 */
export function appendMessage(prev: ChatItem[], message: ChatItem, limit: number): ChatItem[] {
    if (message.ID && prev.some((m) => sameMessage(m, message))) return prev;
    const max = limit > 0 ? limit : DEFAULT_MESSAGE_LIMIT;
    return [...prev.slice(-(max - 1)), message];
}

/** Keeps only the newest `limit` messages. */
export function trimMessages(prev: ChatItem[], limit: number): ChatItem[] {
    const max = limit > 0 ? limit : DEFAULT_MESSAGE_LIMIT;
    return prev.length > max ? prev.slice(-max) : prev;
}
