import { describe, expect, it } from 'vitest';
import { ChatItem } from '../types';
import { appendMessage, isBlocked, sanitizeIncoming, trimMessages } from './messages';

const message = (overrides: Partial<ChatItem> = {}): ChatItem => ({
    ID: 'm1',
    Platform: 'twitch',
    Author: { Name: 'Ana', ChannelID: '1', Thumbnail: { URL: '', Alt: 'Ana' } },
    Message: [{ Text: 'hola mundo' }],
    IsMembership: false,
    IsVerified: false,
    IsOwner: false,
    IsModerator: false,
    Timestamp: '2026-01-01T00:00:00Z',
    ...overrides,
});

describe('sanitizeIncoming', () => {
    it('accepts a valid message', () => {
        expect(sanitizeIncoming(message())?.Author.Name).toBe('Ana');
    });

    it('rejects payloads without an author name', () => {
        expect(sanitizeIncoming(null)).toBeNull();
        expect(sanitizeIncoming({})).toBeNull();
        expect(sanitizeIncoming({ Author: {} })).toBeNull();
    });

    it('turns a null Message into an empty list', () => {
        expect(sanitizeIncoming(message({ Message: null }))?.Message).toEqual([]);
    });

    it('rejects a Message that is not a list', () => {
        expect(sanitizeIncoming({ ...message(), Message: 'text' })).toBeNull();
    });

    it('adds a missing thumbnail without mutating the input', () => {
        const raw = { ...message(), Author: { Name: 'Bob', ChannelID: '2' } };
        const result = sanitizeIncoming(raw);

        expect(result?.Author.Thumbnail).toEqual({ URL: '', Alt: 'Bob' });
        expect((raw.Author as { Thumbnail?: unknown }).Thumbnail).toBeUndefined();
    });

    it('drops an unknown platform instead of trusting it', () => {
        expect(sanitizeIncoming({ ...message(), Platform: 'myspace' })?.Platform).toBeUndefined();
    });
});

describe('appendMessage', () => {
    it('appends new messages', () => {
        const result = appendMessage([message({ ID: 'a' })], message({ ID: 'b' }), 10);
        expect(result.map((m) => m.ID)).toEqual(['a', 'b']);
    });

    it('ignores a duplicate from the same platform', () => {
        const prev = [message({ ID: 'a' })];
        expect(appendMessage(prev, message({ ID: 'a' }), 10)).toBe(prev);
    });

    it('keeps messages with the same ID from different platforms', () => {
        const prev = [message({ ID: 'a', Platform: 'twitch' })];
        const result = appendMessage(prev, message({ ID: 'a', Platform: 'kick' }), 10);
        expect(result).toHaveLength(2);
    });

    it('never drops messages without an ID as duplicates', () => {
        const result = appendMessage([message({ ID: '' })], message({ ID: '' }), 10);
        expect(result).toHaveLength(2);
    });

    it('keeps only the newest messages up to the limit', () => {
        let list: ChatItem[] = [];
        for (const id of ['a', 'b', 'c', 'd']) list = appendMessage(list, message({ ID: id }), 3);
        expect(list.map((m) => m.ID)).toEqual(['b', 'c', 'd']);
    });

    it('falls back to the default limit when the setting is 0', () => {
        let list: ChatItem[] = [];
        for (let i = 0; i < 150; i++) list = appendMessage(list, message({ ID: String(i) }), 0);
        expect(list).toHaveLength(100);
    });
});

describe('trimMessages', () => {
    it('trims to the newest messages', () => {
        const list = ['a', 'b', 'c'].map((ID) => message({ ID }));
        expect(trimMessages(list, 2).map((m) => m.ID)).toEqual(['b', 'c']);
    });

    it('returns the same array when already within the limit', () => {
        const list = [message()];
        expect(trimMessages(list, 5)).toBe(list);
    });
});

describe('isBlocked', () => {
    const lists = { blockedUsers: 'Spammer, @bot', blockedWords: 'casino,  free money' };

    it('blocks listed users regardless of case and @', () => {
        expect(isBlocked(message({ Author: { Name: '@SPAMMER', ChannelID: '1', Thumbnail: { URL: '', Alt: '' } } }), lists)).toBe(true);
    });

    it('blocks messages containing a blocked word', () => {
        expect(isBlocked(message({ Message: [{ Text: 'get FREE MONEY now' }] }), lists)).toBe(true);
    });

    it('lets normal messages through', () => {
        expect(isBlocked(message(), lists)).toBe(false);
    });

    it('blocks nothing when the lists are empty', () => {
        expect(isBlocked(message(), { blockedUsers: '', blockedWords: '' })).toBe(false);
    });
});
