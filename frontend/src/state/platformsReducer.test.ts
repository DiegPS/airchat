import { describe, expect, it } from 'vitest';
import { initialPlatformsState, isAnyActive, platformsReducer } from './platformsReducer';

describe('platformsReducer', () => {
    it('starts with every platform idle', () => {
        const state = initialPlatformsState();
        expect(Object.keys(state).sort()).toEqual(['kick', 'twitch', 'youtube']);
        expect(isAnyActive(state)).toBe(false);
    });

    it('marks a platform active with its detail and clears old problems', () => {
        let state = platformsReducer(initialPlatformsState(), { type: 'error', platform: 'twitch', message: 'boom' });
        state = platformsReducer(state, { type: 'started', platform: 'twitch', detail: 'xqc' });

        expect(state.twitch).toEqual({ active: true, detail: 'xqc', error: '', warning: '' });
        expect(isAnyActive(state)).toBe(true);
    });

    it('keeps platforms independent', () => {
        let state = platformsReducer(initialPlatformsState(), { type: 'started', platform: 'youtube', detail: 'abc' });
        state = platformsReducer(state, { type: 'error', platform: 'kick', message: 'not found' });

        expect(state.youtube.active).toBe(true);
        expect(state.kick.error).toBe('not found');
        expect(state.twitch.active).toBe(false);
    });

    it('a warning does not deactivate the platform', () => {
        let state = platformsReducer(initialPlatformsState(), { type: 'started', platform: 'youtube' });
        state = platformsReducer(state, { type: 'warning', platform: 'youtube', message: 'fetch failed' });

        expect(state.youtube.active).toBe(true);
        expect(state.youtube.warning).toBe('fetch failed');
        expect(state.youtube.error).toBe('');
    });

    it('an error deactivates the platform and keeps the message', () => {
        let state = platformsReducer(initialPlatformsState(), { type: 'started', platform: 'kick' });
        state = platformsReducer(state, { type: 'error', platform: 'kick', message: 'lost' });

        expect(state.kick.active).toBe(false);
        expect(state.kick.error).toBe('lost');
    });

    it('ended deactivates but keeps an earlier error visible', () => {
        let state = platformsReducer(initialPlatformsState(), { type: 'error', platform: 'twitch', message: 'x' });
        state = platformsReducer(state, { type: 'ended', platform: 'twitch' });

        expect(state.twitch.active).toBe(false);
        expect(state.twitch.error).toBe('x');
    });

    it('attempt clears stale problems without activating', () => {
        let state = platformsReducer(initialPlatformsState(), { type: 'error', platform: 'kick', message: 'old' });
        state = platformsReducer(state, { type: 'attempt', platform: 'kick' });

        expect(state.kick).toEqual({ active: false, detail: '', error: '', warning: '' });
    });

    it('reset returns everything to idle', () => {
        let state = platformsReducer(initialPlatformsState(), { type: 'started', platform: 'youtube', detail: 'a' });
        state = platformsReducer(state, { type: 'reset' });

        expect(state).toEqual(initialPlatformsState());
    });

    it('does not mutate the previous state', () => {
        const before = initialPlatformsState();
        const snapshot = JSON.stringify(before);
        platformsReducer(before, { type: 'started', platform: 'youtube' });
        expect(JSON.stringify(before)).toBe(snapshot);
    });
});
