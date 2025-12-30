import { useState, useEffect, useRef } from 'react';
import { EventsOn, EventsOff } from "../../wailsjs/runtime";
import { StartChat, StopChat } from "../../wailsjs/go/main/App";
import { ChatItem } from '../types';

export const useChat = () => {
    const [messages, setMessages] = useState<ChatItem[]>([]);
    const [isStarted, setIsStarted] = useState(false);
    const [error, setError] = useState('');
    const [liveId, setLiveId] = useState('');
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [channelId, setChannelId] = useState('');

    const isStartedRef = useRef(isStarted);
    const scrollToBottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        isStartedRef.current = isStarted;
    }, [isStarted]);

    const scrollToBottom = () => {
        scrollToBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isStarted || isPreviewMode) {
            scrollToBottom();
        }
    }, [messages, isStarted, isPreviewMode]);

    useEffect(() => {
        EventsOn("chat_message", (message: ChatItem) => {
            if (!isStartedRef.current) return;
            setMessages(prev => [...prev.slice(-100), message]);
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

        return () => {
            EventsOff("chat_message");
            EventsOff("chat_started");
            EventsOff("chat_error");
            EventsOff("chat_ended");
        };
    }, []);

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
        scrollToBottomRef
    };
};
