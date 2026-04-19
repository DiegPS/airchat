import { useState, useEffect, useRef } from 'react';
import { EventsOn, EventsOff } from "../../wailsjs/runtime";
import { StartChat, StopChat, ConnectOBS, DisconnectOBS, StartTwitchChat, StopTwitchChat } from "../../wailsjs/go/main/App";
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
    const [error, setError] = useState('');
    const [twitchError, setTwitchError] = useState('');
    const [liveId, setLiveId] = useState('');
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [channelId, setChannelId] = useState('');
    const [twitchChannel, setTwitchChannel] = useState('');
    const [obsStatus, setObsStatus] = useState<OBSStatus | null>(null);

    // Gate for accepting chat_message events — true if ANY platform is active
    const isActiveRef = useRef(false);
    useEffect(() => {
        isActiveRef.current = isStarted || isTwitchStarted || isPreviewMode;
    }, [isStarted, isTwitchStarted, isPreviewMode]);

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
        if (isStarted || isTwitchStarted || isPreviewMode) {
            scrollToBottom();
        }
    }, [messages, isStarted, isTwitchStarted, isPreviewMode]);

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
        if (!channelId && !twitchChannel) {
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

        await Promise.all(tasks);
    };

    const startPreview = () => {
        setIsPreviewMode(true);
        const now = new Date().toISOString();
        const dummyMessages: ChatItem[] = [
            {
                ID: "1",
                Platform: "youtube",
                Author: { Name: "StreamOwner", Thumbnail: { URL: "https://i.pravatar.cc/100?u=owner", Alt: "O" }, ChannelID: "A" },
                Message: [{ Text: "Bienvenidos al stream! 🎉 Hoy vamos a ver la nueva temporada" }],
                IsMembership: false, IsVerified: false, IsOwner: true, IsModerator: false, Timestamp: now
            },
            {
                ID: "2",
                Platform: "twitch",
                Author: { Name: "TwitchMod", Thumbnail: { URL: "https://i.pravatar.cc/100?u=mod", Alt: "M" }, ChannelID: "B" },
                Message: [{ Text: "Chateando desde Twitch! 😮" }],
                IsMembership: false, IsVerified: false, IsOwner: false, IsModerator: true, Timestamp: now
            },
            {
                ID: "3",
                Platform: "youtube",
                Author: {
                    Name: "MiembroFiel",
                    Thumbnail: { URL: "https://i.pravatar.cc/100?u=member", Alt: "F" },
                    ChannelID: "C",
                    Badge: { Thumbnail: { URL: "https://i.pravatar.cc/20?u=badge", Alt: "6m" }, Label: "6 months" }
                },
                Message: [{ Text: "Llevo 6 meses de miembro y el contenido sigue mejorando 🔥" }],
                IsMembership: true, IsVerified: false, IsOwner: false, IsModerator: false, Timestamp: now
            },
            {
                ID: "4",
                Platform: "twitch",
                Author: { Name: "TwitchSub", Thumbnail: { URL: "https://i.pravatar.cc/100?u=sub", Alt: "S" }, ChannelID: "D" },
                Message: [{ Text: "Sub del mes! resub x3 🎉" }],
                IsMembership: true, IsVerified: false, IsOwner: false, IsModerator: false, Timestamp: now
            },
            {
                ID: "5",
                Platform: "youtube",
                Author: { Name: "SuperFan2000", Thumbnail: { URL: "https://i.pravatar.cc/100?u=super", Alt: "S" }, ChannelID: "E" },
                Message: [{ Text: "Esto merece un superchat!" }],
                SuperChat: { Amount: "$10.00", Color: "#1565C0" },
                IsMembership: false, IsVerified: false, IsOwner: false, IsModerator: false, Timestamp: now
            },
            {
                ID: "6",
                Platform: "twitch",
                Author: { Name: "Viewer_Twitch", Thumbnail: { URL: "https://i.pravatar.cc/100?u=viewer2", Alt: "V" }, ChannelID: "F" },
                Message: [{ Text: "Qué tal se ve el chat con ambas plataformas? 👀" }],
                IsMembership: false, IsVerified: false, IsOwner: false, IsModerator: false, Timestamp: now
            },
            {
                ID: "7",
                Platform: "youtube",
                Author: { Name: "YTViewer", Thumbnail: { URL: "https://i.pravatar.cc/100?u=viewer3", Alt: "Y" }, ChannelID: "G" },
                Message: [{ Text: "ajusta el sidebar para personalizar el diseño ⚙️" }],
                IsMembership: false, IsVerified: true, IsOwner: false, IsModerator: false, Timestamp: now
            },
        ];
        setMessages(dummyMessages);
    };

    const stopChat = async () => {
        if (!isPreviewMode) {
            await Promise.all([
                StopChat().catch(console.error),
                StopTwitchChat().catch(console.error),
            ]);
        }
        setIsStarted(false);
        setIsTwitchStarted(false);
        setIsPreviewMode(false);
        setMessages([]);
        setLiveId('');
        setError('');
        setTwitchError('');
    };

    return {
        messages,
        isStarted,
        isTwitchStarted,
        error,
        twitchError,
        liveId,
        isPreviewMode,
        channelId,
        setChannelId,
        twitchChannel,
        setTwitchChannel,
        startChat,
        startPreview,
        stopChat,
        scrollToBottomRef,
        obsStatus,
    };
};
