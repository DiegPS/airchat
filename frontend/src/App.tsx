import { useState, useEffect, useRef } from 'react';
import './App.css';
import { StartChat, StopChat } from "../wailsjs/go/main/App";
import { EventsOn, EventsOff } from "../wailsjs/runtime";
import { ChatItem } from './types';

function App() {
    const [channelId, setChannelId] = useState('');
    const [messages, setMessages] = useState<ChatItem[]>([]);
    const [isStarted, setIsStarted] = useState(false);
    const [error, setError] = useState('');
    const [liveId, setLiveId] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isStarted) {
            scrollToBottom();
        }
    }, [messages, isStarted]);

    useEffect(() => {
        EventsOn("chat_message", (message: ChatItem) => {
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

    const handleStart = async () => {
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

    const handleStop = async () => {
        await StopChat();
        setIsStarted(false);
        setMessages([]);
        setLiveId('');
    };

    if (!isStarted) {
        return (
            <div className="container">
                <div className="setup-card">
                    <h1 className="title">YouTube Chat Overlay</h1>
                    <p className="subtitle">Enter a Channel ID to start capturing live chat</p>
                    <div className="input-group">
                        <input
                            type="text"
                            placeholder="UCxxxxxxxxxxxx"
                            value={channelId}
                            onChange={(e) => setChannelId(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                        />
                        <button onClick={handleStart} className="btn-primary">Connect</button>
                    </div>
                    {error && <p className="error-message">{error}</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="chat-container">
            <div className="chat-header">
                <div className="status">
                    <span className="pulse"></span>
                    Live: {liveId}
                </div>
                <button onClick={handleStop} className="btn-stop">Stop</button>
            </div>
            <div className="chat-overlay">
                {messages.map((msg) => (
                    <div key={msg.ID} className="chat-item animate-in">
                        <img src={msg.Author.Thumbnail.URL} alt={msg.Author.Name} className="avatar" />
                        <div className="chat-content">
                            <div className="author-row">
                                <span className={`author-name ${msg.IsOwner ? 'owner' : ''} ${msg.IsModerator ? 'mod' : ''}`}>
                                    {msg.Author.Name}
                                </span>
                                {msg.IsOwner && <span className="badge owner-badge">OWNER</span>}
                                {msg.IsModerator && <span className="badge mod-badge">MOD</span>}
                            </div>
                            <div className="message-text">
                                {msg.Message.map((part, i) => (
                                    part.EmojiItem ? (
                                        <img key={i} src={part.EmojiItem.URL} alt={part.EmojiItem.EmojiText} className="emoji" />
                                    ) : (
                                        <span key={i}>{part.Text}</span>
                                    )
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>
        </div>
    );
}

export default App;
