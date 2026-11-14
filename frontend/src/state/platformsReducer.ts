import { PLATFORMS, PlatformId } from '../platforms';

export interface PlatformState {
    /** The backend reported the connection as live. */
    active: boolean;
    /** Shown next to the platform name once live (live ID, channel). */
    detail: string;
    /** Fatal problem: the session is unusable. */
    error: string;
    /** Recoverable problem: the session keeps running. */
    warning: string;
}

export type PlatformsState = Record<PlatformId, PlatformState>;

export type PlatformsAction =
    | { type: 'attempt'; platform: PlatformId }
    | { type: 'started'; platform: PlatformId; detail?: string }
    | { type: 'ended'; platform: PlatformId }
    | { type: 'error'; platform: PlatformId; message: string }
    | { type: 'warning'; platform: PlatformId; message: string }
    | { type: 'reset' };

const idle = (): PlatformState => ({ active: false, detail: '', error: '', warning: '' });

export const initialPlatformsState = (): PlatformsState =>
    Object.fromEntries(PLATFORMS.map((p) => [p.id, idle()])) as PlatformsState;

const patch = (state: PlatformsState, id: PlatformId, change: Partial<PlatformState>): PlatformsState => ({
    ...state,
    [id]: { ...state[id], ...change },
});

export function platformsReducer(state: PlatformsState, action: PlatformsAction): PlatformsState {
    switch (action.type) {
        case 'attempt':
            return patch(state, action.platform, { error: '', warning: '' });
        case 'started':
            return patch(state, action.platform, { active: true, detail: action.detail ?? '', error: '', warning: '' });
        case 'ended':
            return patch(state, action.platform, { active: false, detail: '', warning: '' });
        case 'error':
            return patch(state, action.platform, { active: false, detail: '', warning: '', error: action.message });
        case 'warning':
            return patch(state, action.platform, { warning: action.message });
        case 'reset':
            return initialPlatformsState();
    }
}

export const isAnyActive = (state: PlatformsState): boolean =>
    PLATFORMS.some((p) => state[p.id].active);
