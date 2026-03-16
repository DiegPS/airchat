import { useState, useEffect, useRef } from 'react';
import { EventsOn, EventsOff } from "../../wailsjs/runtime";
import { StartChat, StopChat, ConnectOBS, DisconnectOBS } from "../../wailsjs/go/main/App";
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
    const [error, setError] = useState('');
    const [liveId, setLiveId] = useState('');
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [channelId, setChannelId] = useState('');
    const [obsStatus, setObsStatus] = useState<OBSStatus | null>(null);

    const isStartedRef = useRef(isStarted);
    const scrollToBottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        isStartedRef.current = isStarted;
    }, [isStarted]);

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
        if (isStarted || isPreviewMode) {
            scrollToBottom();
        }
    }, [messages, isStarted, isPreviewMode]);

    // Truncate messages immediately when the limit setting changes
    useEffect(() => {
        setMessages(prev => {
            const limit = settings.maxMessages || 100;
            if (prev.length > limit) {
                return prev.slice(-limit);
            }
            return prev;
        });
    }, [settings.maxMessages]);

    useEffect(() => {
        EventsOn("chat_message", (message: ChatItem) => {
            if (!isStartedRef.current) return;
            setMessages(prev => {
                // Prevent duplicate messages in UI if YouTube's API resends the same batch
                if (message.ID && prev.some(m => m.ID === message.ID)) {
                    return prev;
                }
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

        EventsOn("chat_ended", (reason: string) => {
            console.log("Chat ended:", reason);
            setIsStarted(false);
        });

        EventsOn("obs_status", (status: OBSStatus) => {
            setObsStatus(status);
        });

        return () => {
            EventsOff("chat_message");
            EventsOff("chat_started");
            EventsOff("chat_error");
            EventsOff("chat_ended");
            EventsOff("obs_status");
        };
    }, []);

    // Handle OBS Connection based on Button State (obsConnected)
    // Handle OBS Connection based on Button State (obsConnected)
    useEffect(() => {
        if (settings.obsEnabled && settings.obsConnected) {
            updateSettings({ obsStatusMessage: 'Connecting...' });

            ConnectOBS(settings.obsHost || 'localhost:4455', settings.obsPassword)
                .then(() => {
                    // Start was successful, wait for events
                })
                .catch((err) => {
                    console.error("OBS Connect Error:", err);
                    updateSettings({
                        obsStatusMessage: `Error: ${err}`,
                        obsConnected: false
                    });
                });
        } else {
            DisconnectOBS().catch(console.error);
            setObsStatus(null);
            updateSettings({ obsStatusMessage: 'Disconnected' });
        }
    }, [settings.obsEnabled, settings.obsConnected, settings.obsHost, settings.obsPassword]);

    // Update status message on successful data
    useEffect(() => {
        if (obsStatus && obsStatus.connected) {
            updateSettings({ obsStatusMessage: 'Connected' });
        } else if (settings.obsConnected && obsStatus && !obsStatus.connected) {
            // If we expect to be connected but receive a disconnection status
            updateSettings({ obsStatusMessage: 'Disconnected (Lost connection)' });
        }
    }, [obsStatus, settings.obsConnected]);

    const startChat = async () => {
        if (!channelId) {
            setError("Please enter a Channel ID");
            return;
        }
        try {
            await StartChat(channelId);
        } catch (err: any) {
            setError(err.toString());
        }
    };

    const startPreview = () => {
        setIsPreviewMode(true);
        const dummyMessages: ChatItem[] = [
            {
                ID: "1",
                Author: { Name: "System", Thumbnail: { URL: "https://i.pravatar.cc/100?u=a", Alt: "S" }, ChannelID: "A" },
                Message: [{ Text: "Welcome to the Design Preview!" }],
                IsMembership: false, IsVerified: false, IsOwner: true, IsModerator: false, Timestamp: new Date().toISOString()
            },
            {
                ID: "2",
                Author: { Name: "ModeratorJack", Thumbnail: { URL: "https://i.pravatar.cc/100?u=b", Alt: "M" }, ChannelID: "B" },
                Message: [{ Text: "You can adjust the sidebar settings to your liking." }],
                IsMembership: false, IsVerified: true, IsOwner: false, IsModerator: true, Timestamp: new Date().toISOString()
            },
            {
                ID: "3",
                Author: { Name: "Viewer99", Thumbnail: { URL: "https://i.pravatar.cc/100?u=c", Alt: "V" }, ChannelID: "C" },
                Message: [{ Text: "Try the 3D effects, they look amazing! 🚀" }],
                IsMembership: true, IsVerified: false, IsOwner: false, IsModerator: false, Timestamp: new Date().toISOString()
            }
        ];
        setMessages(dummyMessages);
    };

    const stopChat = async () => {
        if (!isPreviewMode) {
            await StopChat();
        }
        setIsStarted(false);
        setIsPreviewMode(false);
        setMessages([]);
        setLiveId('');
    };

    return {
        messages,
        isStarted,
        error,
        liveId,
        isPreviewMode,
        channelId,
        setChannelId,
        startChat,
        startPreview,
        stopChat,
        scrollToBottomRef,
        obsStatus
    };
};
