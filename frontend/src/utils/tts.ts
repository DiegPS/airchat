import { ChatItem } from '../types';
import { isBlocked } from './messages';
import { normalizeUsernameForFilter, splitCommaList } from './filters';

export interface SpeechRules {
    blockedUsers: string;
    blockedWords: string;
    ttsMembersOnly: boolean;
    ttsAllowCustomUsers: boolean;
    ttsCustomUsersList: string;
    ttsCommandMode: boolean;
    ttsCommandPrefix: string;
    ttsSeparatorText: string;
}

/** Replaces URLs so they are not read out character by character. */
export const cleanText = (text: string) => text.replace(/(?:https?|ftp):\/\/[\n\S]+/g, 'link');

/** Makes a username speakable: drops a leading @ and every digit. */
export const cleanUsername = (username: string) => {
    const withoutAt = username.startsWith('@') ? username.slice(1) : username;
    const withoutNumbers = withoutAt.replace(/\d+/g, '').trim();
    return withoutNumbers || 'Only Numbers';
};

const isAllowedByList = (authorName: string, rules: SpeechRules) => {
    if (!rules.ttsAllowCustomUsers || !rules.ttsCustomUsersList) return false;
    const allowed = splitCommaList(rules.ttsCustomUsersList).map(normalizeUsernameForFilter);
    return allowed.includes(normalizeUsernameForFilter(authorName))
        || allowed.includes(normalizeUsernameForFilter(cleanUsername(authorName)));
};

/**
 * Decides what to read aloud for a message, or null to stay silent. Pure:
 * it knows nothing about queues, providers or timing.
 */
export function speechTextFor(message: ChatItem, rules: SpeechRules): string | null {
    if (isBlocked(message, rules)) return null;

    if (rules.ttsMembersOnly) {
        const isMember = message.IsMembership || !!message.Author.Badge || !!message.SuperChat;
        if (!isMember && !isAllowedByList(message.Author.Name, rules)) return null;
    }

    if (!message.Message || message.Message.length === 0) return null;
    let content = message.Message.map((part) => part.Text).join(' ');

    if (rules.ttsCommandMode && rules.ttsCommandPrefix) {
        const prefix = rules.ttsCommandPrefix.trim();
        if (!content.toLowerCase().startsWith(prefix.toLowerCase())) return null;
        content = content.substring(prefix.length).trim();
        if (!content) return null;
    }

    const spoken = cleanText(content).trim();
    if (!spoken) return null;

    const separator = rules.ttsSeparatorText || 'says:';
    return `${cleanUsername(message.Author.Name)} ${separator} ${spoken}`;
}
