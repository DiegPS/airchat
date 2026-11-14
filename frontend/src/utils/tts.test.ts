import { describe, expect, it } from 'vitest';
import { ChatItem } from '../types';
import { SpeechRules, cleanText, cleanUsername, speechTextFor } from './tts';

const rules = (overrides: Partial<SpeechRules> = {}): SpeechRules => ({
    blockedUsers: '',
    blockedWords: '',
    ttsMembersOnly: false,
    ttsAllowCustomUsers: false,
    ttsCustomUsersList: '',
    ttsCommandMode: false,
    ttsCommandPrefix: '',
    ttsSeparatorText: 'says:',
    ...overrides,
});

const message = (overrides: Partial<ChatItem> = {}, text = 'hello there'): ChatItem => ({
    ID: '1',
    Platform: 'twitch',
    Author: { Name: 'Ana', ChannelID: '1', Thumbnail: { URL: '', Alt: 'Ana' } },
    Message: [{ Text: text }],
    IsMembership: false,
    IsVerified: false,
    IsOwner: false,
    IsModerator: false,
    Timestamp: '2026-01-01T00:00:00Z',
    ...overrides,
});

describe('cleanUsername', () => {
    it('drops a leading @ and digits', () => {
        expect(cleanUsername('@ana123')).toBe('ana');
    });
    it('handles names made only of digits', () => {
        expect(cleanUsername('12345')).toBe('Only Numbers');
    });
});

describe('cleanText', () => {
    it('replaces URLs with the word link', () => {
        expect(cleanText('see https://example.com/a?b=1 now')).toBe('see link now');
    });
});

describe('speechTextFor', () => {
    it('builds "author separator message"', () => {
        expect(speechTextFor(message(), rules())).toBe('Ana says: hello there');
    });

    it('uses a custom separator and falls back to the default', () => {
        expect(speechTextFor(message(), rules({ ttsSeparatorText: 'dice' }))).toBe('Ana dice hello there');
        expect(speechTextFor(message(), rules({ ttsSeparatorText: '' }))).toBe('Ana says: hello there');
    });

    it('stays silent for blocked users and words', () => {
        expect(speechTextFor(message(), rules({ blockedUsers: 'ana' }))).toBeNull();
        expect(speechTextFor(message({}, 'buy casino now'), rules({ blockedWords: 'casino' }))).toBeNull();
    });

    it('stays silent for empty messages', () => {
        expect(speechTextFor(message({ Message: [] }), rules())).toBeNull();
        expect(speechTextFor(message({}, '   '), rules())).toBeNull();
    });

    describe('members-only mode', () => {
        const only = rules({ ttsMembersOnly: true });

        it('skips regular viewers', () => {
            expect(speechTextFor(message(), only)).toBeNull();
        });
        it('reads members, badge holders and super chats', () => {
            expect(speechTextFor(message({ IsMembership: true }), only)).not.toBeNull();
            expect(speechTextFor(message({ Author: { Name: 'Ana', ChannelID: '1', Thumbnail: { URL: '', Alt: '' }, Badge: { Label: '6m', Thumbnail: { URL: '', Alt: '' } } } }), only)).not.toBeNull();
            expect(speechTextFor(message({ SuperChat: { Amount: '$5', Color: 'FFFFFF' } }), only)).not.toBeNull();
        });
        it('lets allowlisted users through, with or without digits and @', () => {
            const allow = rules({ ttsMembersOnly: true, ttsAllowCustomUsers: true, ttsCustomUsersList: 'ana, @bob' });
            expect(speechTextFor(message(), allow)).not.toBeNull();
            expect(speechTextFor(message({ Author: { Name: 'ana99', ChannelID: '1', Thumbnail: { URL: '', Alt: '' } } }), allow)).not.toBeNull();
            expect(speechTextFor(message({ Author: { Name: 'carl', ChannelID: '1', Thumbnail: { URL: '', Alt: '' } } }), allow)).toBeNull();
        });
    });

    describe('command mode', () => {
        const command = rules({ ttsCommandMode: true, ttsCommandPrefix: '!say' });

        it('ignores messages without the prefix', () => {
            expect(speechTextFor(message(), command)).toBeNull();
        });
        it('strips the prefix, case-insensitively', () => {
            expect(speechTextFor(message({}, '!SAY hola a todos'), command)).toBe('Ana says: hola a todos');
        });
        it('ignores a bare prefix', () => {
            expect(speechTextFor(message({}, '!say'), command)).toBeNull();
        });
    });
});
