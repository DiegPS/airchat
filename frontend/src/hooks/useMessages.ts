import { useCallback, useEffect, useRef, useState } from 'react';
import { EventsOn } from '../../wailsjs/runtime';
import { ChatItem } from '../types';
import { useSettings } from '../context/SettingsContext';
import { appendMessage, isBlocked, sanitizeIncoming, trimMessages } from '../utils/messages';

/**
 * The visible message feed: receives `chat_message` events, drops invalid,
 * blocked and duplicate messages, and keeps the newest `maxMessages`.
 */
export function useMessages(active: boolean) {
    const { settings } = useSettings();
    const [messages, setMessages] = useState<ChatItem[]>([]);

    // Read inside the event handler so it never needs re-subscribing.
    const settingsRef = useRef(settings);
    settingsRef.current = settings;

    // Events are only accepted while something is running. `open` flips this
    // synchronously so the first messages of a session are not lost to the
    // delay of a React state update.
    const acceptRef = useRef(false);
    useEffect(() => { acceptRef.current = active; }, [active]);

    const scrollRef = useRef<HTMLDivElement>(null);

    const open = useCallback(() => { acceptRef.current = true; }, []);
    const clear = useCallback(() => { acceptRef.current = false; setMessages([]); }, []);

    useEffect(() => {
        const cancel = EventsOn('chat_message', (raw: unknown) => {
            if (!acceptRef.current) return;

            const message = sanitizeIncoming(raw);
            if (!message) return;
            if (isBlocked(message, settingsRef.current)) return;

            setMessages((prev) => appendMessage(prev, message, settingsRef.current.maxMessages));
        });
        return cancel;
    }, []);

    // Apply a lowered limit immediately.
    useEffect(() => {
        setMessages((prev) => trimMessages(prev, settings.maxMessages));
    }, [settings.maxMessages]);

    useEffect(() => {
        if (active) scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, active]);

    return { messages, scrollRef, open, clear };
}
