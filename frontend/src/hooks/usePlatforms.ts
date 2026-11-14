import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { EventsOn } from '../../wailsjs/runtime';
import {
    StartChat, StopChat,
    StartTwitchChat, StopTwitchChat,
    StartKickChat, StopKickChat,
} from '../../wailsjs/go/main/App';
import { PLATFORMS, PlatformDef, PlatformId, isPlatformId } from '../platforms';
import {
    PlatformState,
    initialPlatformsState,
    isAnyActive,
    platformsReducer,
} from '../state/platformsReducer';

/** The backend calls that start and stop each platform. */
const ADAPTERS: Record<PlatformId, { start: (input: string) => Promise<void>; stop: () => Promise<void> }> = {
    youtube: { start: StartChat, stop: StopChat },
    twitch: { start: StartTwitchChat, stop: StopTwitchChat },
    kick: { start: StartKickChat, stop: StopKickChat },
};

interface StatusEvent { platform: string; detail?: string }
interface ProblemEvent { platform: string; message: string }

export interface PlatformView {
    def: PlatformDef;
    /** What the user typed (remembered between runs). */
    input: string;
    state: PlatformState;
}

const readStored = (key: string): string => {
    try {
        return localStorage.getItem(key) ?? '';
    } catch {
        return '';
    }
};

const writeStored = (key: string, value: string) => {
    try {
        if (value) localStorage.setItem(key, value);
        else localStorage.removeItem(key);
    } catch {
        // Storage can be unavailable; remembering the input is a convenience.
    }
};

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

const initialInputs = (): Record<PlatformId, string> =>
    Object.fromEntries(PLATFORMS.map((p) => [p.id, readStored(p.storageKey)])) as Record<PlatformId, string>;

/**
 * Owns the connection state of every chat platform: what the user typed, the
 * lifecycle events coming from the backend, and starting / stopping them all.
 */
export function usePlatforms() {
    const [states, dispatch] = useReducer(platformsReducer, undefined, initialPlatformsState);
    const [inputs, setInputs] = useState(initialInputs);
    const [notice, setNotice] = useState('');
    const inputsRef = useRef(inputs);
    inputsRef.current = inputs;

    useEffect(() => {
        const status = (type: 'started' | 'ended') => (event: StatusEvent) => {
            if (isPlatformId(event?.platform)) {
                dispatch({ type, platform: event.platform, detail: event.detail });
            }
        };
        const problem = (type: 'error' | 'warning') => (event: ProblemEvent) => {
            if (isPlatformId(event?.platform)) {
                dispatch({ type, platform: event.platform, message: event.message });
            }
        };

        const cancels = [
            EventsOn('platform_started', status('started')),
            EventsOn('platform_ended', status('ended')),
            EventsOn('platform_error', problem('error')),
            EventsOn('platform_warning', problem('warning')),
        ];
        return () => cancels.forEach((cancel) => cancel());
    }, []);

    const setInput = useCallback((id: PlatformId, value: string) => {
        setInputs((prev) => ({ ...prev, [id]: value }));
    }, []);

    const clearInput = useCallback((id: PlatformId) => {
        setInputs((prev) => ({ ...prev, [id]: '' }));
        const def = PLATFORMS.find((p) => p.id === id);
        if (def) writeStored(def.storageKey, '');
    }, []);

    /** Starts every platform that has an input. Resolves once all have answered. */
    const startAll = useCallback(async (): Promise<boolean> => {
        const wanted = PLATFORMS
            .map((def) => ({ def, input: inputsRef.current[def.id].trim() }))
            .filter((item) => item.input !== '');

        if (wanted.length === 0) {
            setNotice('Please enter at least one channel');
            return false;
        }

        setNotice('');
        await Promise.all(wanted.map(async ({ def, input }) => {
            dispatch({ type: 'attempt', platform: def.id });
            writeStored(def.storageKey, input);
            try {
                await ADAPTERS[def.id].start(input);
            } catch (err) {
                dispatch({ type: 'error', platform: def.id, message: errorText(err) });
            }
        }));
        return true;
    }, []);

    /** Stops every platform. Failures are reported but never block the others. */
    const stopAll = useCallback(async () => {
        const results = await Promise.allSettled(PLATFORMS.map((def) => ADAPTERS[def.id].stop()));
        const failures = results
            .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
            .map((r) => errorText(r.reason));

        dispatch({ type: 'reset' });
        setNotice(failures.length > 0 ? `Disconnect error: ${failures.join('; ')}` : '');
    }, []);

    const platforms: PlatformView[] = PLATFORMS.map((def) => ({
        def,
        input: inputs[def.id],
        state: states[def.id],
    }));

    return {
        platforms,
        anyActive: isAnyActive(states),
        notice,
        setInput,
        clearInput,
        startAll,
        stopAll,
    };
}
