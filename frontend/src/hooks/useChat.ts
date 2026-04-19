import { useState, useEffect, useRef } from 'react';
import { EventsOn, EventsOff } from "../../wailsjs/runtime";
import { StartChat, StopChat, ConnectOBS, DisconnectOBS, StartTwitchChat, StopTwitchChat, StartPreviewChat, StartKickChat, StopKickChat } from "../../wailsjs/go/main/App";
import { ChatItem } from '../types';
import { useSettings } from '../context/SettingsContext';


const usePrevious = <T,>(value: T): T | undefined => {
    const ref = useRef<T>();
    useEffect(() => {
        ref.current = value;
    });
    return ref.current;
};

export interface OBSStatus {
    connected: boolean;
    outputActive: boolean;
    reconnecting: boolean;
    bitrateKbps: number;
    fps: number;
    dropPercentage: number;
    congestion: number;
    statusColor: string;
    currentScene: string;
}

export const useChat = () => {
    const { settings, updateSettings } = useSettings();
    const prevProvider = usePrevious(settings.ttsProvider);
    const [messages, setMessages] = useState<ChatItem[]>([]);
    const [isStarted, setIsStarted] = useState(false);
    const [isTwitchStarted, setIsTwitchStarted] = useState(false);
    const [isKickStarted, setIsKickStarted] = useState(false);
    const [error, setError] = useState('');
    const [twitchError, setTwitchError] = useState('');
    const [kickError, setKickError] = useState('');
    const [liveId, setLiveId] = useState('');
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [channelId, setChannelId] = useState('');
    const [twitchChannel, setTwitchChannel] = useState('');
    const [kickChannel, setKickChannel] = useState('');
    const [obsStatus, setObsStatus] = useState<OBSStatus | null>(null);

    // Gate for accepting chat_message events — true if ANY platform is active
    const isActiveRef = useRef(false);
    useEffect(() => {
        isActiveRef.current = isStarted || isTwitchStarted || isKickStarted || isPreviewMode;
    }, [isStarted, isTwitchStarted, isKickStarted, isPreviewMode]);

    const scrollToBottomRef = useRef<HTMLDivElement>(null);

    // Reset ttsVoice when provider changes
    useEffect(() => {
        if (prevProvider && prevProvider !== settings.ttsProvider) {
            updateSettings({ ttsVoice: '' });
        }
    }, [settings.ttsProvider, prevProvider, updateSettings]);

    const scrollToBottom = () => {
        scrollToBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isStarted || isTwitchStarted || isKickStarted || isPreviewMode) {
            scrollToBottom();
        }
    }, [messages, isStarted, isTwitchStarted, isKickStarted, isPreviewMode]);

    // Truncate messages when the limit setting changes
    useEffect(() => {
        setMessages(prev => {
            const limit = settings.maxMessages || 100;
            if (prev.length > limit) return prev.slice(-limit);
            return prev;
        });
    }, [settings.maxMessages]);

    useEffect(() => {
        EventsOn("chat_message", (message: ChatItem) => {
            if (!isActiveRef.current) return;
            setMessages(prev => {
                if (message.ID && prev.some(m => m.ID === message.ID)) return prev;
                const limit = settings.maxMessages || 100;
                return [...prev.slice(-(limit - 1)), message];
            });
        });

        EventsOn("chat_started", (id: string) => {
            setLiveId(id);
            setIsStarted(true);
            setError('');
        });

        EventsOn("chat_error", (err: string) => {
            setError(err);
            setIsStarted(false);
        });

        EventsOn("chat_ended", () => {
            setIsStarted(false);
        });

        EventsOn("twitch_started", () => {
            setIsTwitchStarted(true);
            setTwitchError('');
        });

        EventsOn("twitch_error", (err: string) => {
            setTwitchError(err);
            setIsTwitchStarted(false);
        });

        EventsOn("twitch_ended", () => {
            setIsTwitchStarted(false);
        });

        EventsOn("kick_started", () => {
            setIsKickStarted(true);
            setKickError('');
        });

        EventsOn("kick_error", (err: string) => {
            setKickError(err);
            setIsKickStarted(false);
        });

        EventsOn("kick_ended", () => {
            setIsKickStarted(false);
        });

        EventsOn("obs_status", (status: OBSStatus) => {
            setObsStatus(status);
        });

        return () => {
            EventsOff("chat_message");
            EventsOff("chat_started");
            EventsOff("chat_error");
            EventsOff("chat_ended");
            EventsOff("twitch_started");
            EventsOff("twitch_error");
            EventsOff("twitch_ended");
            EventsOff("kick_started");
            EventsOff("kick_error");
            EventsOff("kick_ended");
            EventsOff("obs_status");
        };
    }, []);

    // OBS connection reactive to settings
    useEffect(() => {
        if (settings.obsEnabled && settings.obsConnected) {
            updateSettings({ obsStatusMessage: 'Connecting...' });
            ConnectOBS(settings.obsHost || 'localhost:4455', settings.obsPassword)
                .catch((err) => {
                    console.error("OBS Connect Error:", err);
                    updateSettings({ obsStatusMessage: `Error: ${err}`, obsConnected: false });
                });
        } else {
            DisconnectOBS().catch(console.error);
            setObsStatus(null);
            updateSettings({ obsStatusMessage: 'Disconnected' });
        }
    }, [settings.obsEnabled, settings.obsConnected, settings.obsHost, settings.obsPassword]);

    useEffect(() => {
        if (obsStatus && obsStatus.connected) {
            updateSettings({ obsStatusMessage: 'Connected' });
        } else if (settings.obsConnected && obsStatus && !obsStatus.connected) {
            updateSettings({ obsStatusMessage: 'Disconnected (Lost connection)' });
        }
    }, [obsStatus, settings.obsConnected]);

    const startChat = async () => {
        if (!channelId && !twitchChannel && !kickChannel) {
            setError("Please enter at least one channel");
            return;
        }

        const tasks: Promise<void>[] = [];

        if (channelId) {
            tasks.push(
                StartChat(channelId).catch((err: any) => setError(err.toString()))
            );
        }

        if (twitchChannel) {
            tasks.push(
                StartTwitchChat(twitchChannel).catch((err: any) => setTwitchError(err.toString()))
            );
        }

        if (kickChannel) {
            tasks.push(
                StartKickChat(kickChannel).catch((err: any) => setKickError(err.toString()))
            );
        }

        await Promise.all(tasks);
    };

    const startPreview = () => {
        setIsPreviewMode(true);
        StartPreviewChat().catch(console.error);
    };

    const stopChat = async () => {
        if (!isPreviewMode) {
            await Promise.all([
                StopChat().catch(console.error),
                StopTwitchChat().catch(console.error),
                StopKickChat().catch(console.error),
            ]);
        }
        setIsStarted(false);
        setIsTwitchStarted(false);
        setIsKickStarted(false);
        setIsPreviewMode(false);
        setMessages([]);
        setLiveId('');
        setError('');
        setTwitchError('');
        setKickError('');
    };

    return {
        messages,
        isStarted,
        isTwitchStarted,
        isKickStarted,
        error,
        twitchError,
        kickError,
        liveId,
        isPreviewMode,
        channelId,
        setChannelId,
        twitchChannel,
        setTwitchChannel,
        kickChannel,
        setKickChannel,
        startChat,
        startPreview,
        stopChat,
        scrollToBottomRef,
        obsStatus,
    };
};
