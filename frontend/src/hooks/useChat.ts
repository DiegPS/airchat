import { useState, useEffect, useRef } from 'react';
import { EventsOn } from "../../wailsjs/runtime";
import { StartChat, StopChat, ConnectOBS, DisconnectOBS, StartTwitchChat, StopTwitchChat, StartPreviewChat, StartKickChat, StopKickChat } from "../../wailsjs/go/main/App";
import { ChatItem } from '../types';
import { useSettings } from '../context/SettingsContext';
import { containsBlockedWord, isUserBlocked } from '../utils/filters';


const usePrevious = <T,>(value: T): T | undefined => {
    const ref = useRef<T>();
    useEffect(() => {
        ref.current = value;
    });
    return ref.current;
};

const normalizePlatformChannel = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';

    try {
        const url = new URL(trimmed);
        const pathParts = url.pathname.split('/').filter(Boolean);
        const lastPath = pathParts[pathParts.length - 1] ?? '';
        return lastPath.replace(/^@/, '').trim();
    } catch {
        return trimmed.replace(/^@/, '').trim();
    }
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
    const [channelId, setChannelId] = useState(() => localStorage.getItem('airchat_last_youtube') ?? '');
    const [twitchChannel, setTwitchChannel] = useState(() => localStorage.getItem('airchat_last_twitch') ?? '');
    const [kickChannel, setKickChannel] = useState(() => localStorage.getItem('airchat_last_kick') ?? '');
    const [obsStatus, setObsStatus] = useState<OBSStatus | null>(null);

    // Gate for accepting chat_message events — true if ANY platform is active
    const isActiveRef = useRef(false);
    const settingsRef = useRef(settings);
    useEffect(() => { settingsRef.current = settings; });
    useEffect(() => {
        isActiveRef.current = isStarted || isTwitchStarted || isKickStarted || isPreviewMode;
    }, [isStarted, isTwitchStarted, isKickStarted, isPreviewMode]);

    const scrollToBottomRef = useRef<HTMLDivElement>(null);

    // Reset provider-specific TTS settings when provider changes
    useEffect(() => {
        if (prevProvider && prevProvider !== settings.ttsProvider) {
            const nextSettings: { ttsVoice: string; supertonicLang?: string } = { ttsVoice: '' };
            const supertonic2Langs = ['en', 'ko', 'es', 'pt', 'fr'];
            if (settings.ttsProvider === 'supertonic' && !supertonic2Langs.includes(settings.supertonicLang)) {
                nextSettings.supertonicLang = 'en';
            }
            updateSettings(nextSettings);
        }
    }, [settings.ttsProvider, settings.supertonicLang, prevProvider, updateSettings]);

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
        const cancelChatMessage = EventsOn("chat_message", (message: ChatItem) => {
            if (!isActiveRef.current) return;

            if (!message?.Author?.Name) return;
            if (message.Message === null) {
                message.Message = [];
            }
            if (!Array.isArray(message.Message)) return;
            if (!message.Author.Thumbnail) {
                message.Author.Thumbnail = { URL: '', Alt: message.Author.Name };
            }

            const { blockedUsers, blockedWords } = settingsRef.current;

            if (isUserBlocked(message.Author.Name, blockedUsers)) return;
            if (containsBlockedWord(message.Message, blockedWords)) return;

            setMessages(prev => {
                if (message.ID && prev.some(m => m.ID === message.ID)) return prev;
                const limit = settingsRef.current.maxMessages || 100;
                return [...prev.slice(-(limit - 1)), message];
            });
        });

        const cancelChatStarted = EventsOn("chat_started", (id: string) => {
            setLiveId(id);
            setIsStarted(true);
            setError('');
        });

        const cancelChatError = EventsOn("chat_error", (err: string) => {
            setError(err);
            setIsStarted(false);
        });

        const cancelChatEnded = EventsOn("chat_ended", () => {
            setIsStarted(false);
        });

        const cancelTwitchStarted = EventsOn("twitch_started", () => {
            setIsTwitchStarted(true);
            setTwitchError('');
        });

        const cancelTwitchError = EventsOn("twitch_error", (err: string) => {
            setTwitchError(err);
            setIsTwitchStarted(false);
        });

        const cancelTwitchEnded = EventsOn("twitch_ended", () => {
            setIsTwitchStarted(false);
        });

        const cancelKickStarted = EventsOn("kick_started", () => {
            setIsKickStarted(true);
            setKickError('');
        });

        const cancelKickError = EventsOn("kick_error", (err: string) => {
            setKickError(err);
            setIsKickStarted(false);
        });

        const cancelKickEnded = EventsOn("kick_ended", () => {
            setIsKickStarted(false);
        });

        const cancelObsStatus = EventsOn("obs_status", (status: OBSStatus) => {
            setObsStatus(status);
        });

        return () => {
            cancelChatMessage();
            cancelChatStarted();
            cancelChatError();
            cancelChatEnded();
            cancelTwitchStarted();
            cancelTwitchError();
            cancelTwitchEnded();
            cancelKickStarted();
            cancelKickError();
            cancelKickEnded();
            cancelObsStatus();
        };
    }, []);

    const obsErrorRef = useRef(false);

    // OBS connection reactive to settings
    useEffect(() => {
        if (settings.obsEnabled && settings.obsConnected) {
            obsErrorRef.current = false;
            updateSettings({ obsStatusMessage: 'Connecting...' });
            ConnectOBS(settings.obsHost || 'localhost:4455', settings.obsPassword)
                .catch((err) => {
                    obsErrorRef.current = true;
                    console.error("OBS Connect Error:", err);
                    updateSettings({ obsStatusMessage: `Error: ${err}`, obsConnected: false });
                });
        } else {
            setObsStatus(null);
            DisconnectOBS()
                .then(() => {
                    if (!obsErrorRef.current) {
                        updateSettings({ obsStatusMessage: 'Disconnected' });
                    }
                })
                .catch((err) => {
                    console.error("OBS Disconnect Error:", err);
                    updateSettings({ obsStatusMessage: `Disconnect error: ${err}` });
                });
            obsErrorRef.current = false;
        }
    }, [settings.obsEnabled, settings.obsConnected, settings.obsHost, settings.obsPassword]);

    useEffect(() => {
        if (obsStatus && obsStatus.connected) {
            updateSettings({ obsStatusMessage: 'Connected' });
        } else if (settings.obsConnected && obsStatus && !obsStatus.connected) {
            updateSettings({ obsStatusMessage: 'Disconnected (Lost connection)', obsConnected: false });
        }
    }, [obsStatus, settings.obsConnected]);

    const startChat = async () => {
        const youtubeInput = channelId.trim();
        const twitchInput = normalizePlatformChannel(twitchChannel);
        const kickInput = normalizePlatformChannel(kickChannel);

        if (!youtubeInput && !twitchInput && !kickInput) {
            setError("Please enter at least one channel");
            return;
        }

        setError('');
        setTwitchError('');
        setKickError('');

        const tasks: Promise<void>[] = [];

        if (youtubeInput) {
            localStorage.setItem('airchat_last_youtube', youtubeInput);
            setChannelId(youtubeInput);
            tasks.push(
                StartChat(youtubeInput).catch((err: any) => setError(err.toString()))
            );
        }

        if (twitchInput) {
            localStorage.setItem('airchat_last_twitch', twitchInput);
            setTwitchChannel(twitchInput);
            tasks.push(
                StartTwitchChat(twitchInput).catch((err: any) => setTwitchError(err.toString()))
            );
        }

        if (kickInput) {
            localStorage.setItem('airchat_last_kick', kickInput);
            setKickChannel(kickInput);
            tasks.push(
                StartKickChat(kickInput).catch((err: any) => setKickError(err.toString()))
            );
        }

        await Promise.all(tasks);
    };

    const startPreview = () => {
        isActiveRef.current = true;
        setIsPreviewMode(true);
        StartPreviewChat().catch((err) => {
            setError(`Preview failed: ${err}`);
            setIsPreviewMode(false);
            isActiveRef.current = false;
        });
    };

    const stopChat = async () => {
        let disconnectError = '';
        if (!isPreviewMode) {
            const results = await Promise.allSettled([
                StopChat(),
                StopTwitchChat(),
                StopKickChat(),
            ]);
            const stopErrors = results
                .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
                .map(result => String(result.reason));
            if (stopErrors.length > 0) {
                disconnectError = `Disconnect error: ${stopErrors.join('; ')}`;
            }
        }
        setIsStarted(false);
        setIsTwitchStarted(false);
        setIsKickStarted(false);
        setIsPreviewMode(false);
        setMessages([]);
        setLiveId('');
        setError(disconnectError);
        setTwitchError('');
        setKickError('');
    };

    const clearYoutubeChannel = () => {
        setChannelId('');
        localStorage.removeItem('airchat_last_youtube');
    };

    const clearTwitchChannel = () => {
        setTwitchChannel('');
        localStorage.removeItem('airchat_last_twitch');
    };

    const clearKickChannel = () => {
        setKickChannel('');
        localStorage.removeItem('airchat_last_kick');
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
        clearYoutubeChannel,
        twitchChannel,
        setTwitchChannel,
        clearTwitchChannel,
        kickChannel,
        setKickChannel,
        clearKickChannel,
        startChat,
        startPreview,
        stopChat,
        scrollToBottomRef,
        obsStatus,
    };
};
