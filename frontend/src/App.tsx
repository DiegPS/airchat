import { useState, useEffect, useRef } from 'react';
import './App.css';
import { StartChat, StopChat } from "../wailsjs/go/main/App";
import { EventsOn, EventsOff } from "../wailsjs/runtime";
import { ChatItem, ChatSettings } from './types';

function App() {
    const [channelId, setChannelId] = useState('');
    const [messages, setMessages] = useState<ChatItem[]>([]);
    const [isStarted, setIsStarted] = useState(false);
    const [error, setError] = useState('');
    const [liveId, setLiveId] = useState('');
    const [settings, setSettings] = useState<ChatSettings>({
        fontSize: 16,
        bgOpacity: 0.1,
        messageOpacity: 0.4,
        showAvatars: true,
        showBadges: true,
        chromaMode: false,
        chromaColor: '#00c853',
        textStroke: 0,
        textStrokeColor: '#000000',
        threeDEnabled: false,
        perspective: 1000,
        rotateX: 0,
        rotateY: 0,
        rotateZ: 0,
        skewX: 0,
        skewY: 0,
        scale: 1,
        showGrid: true
    });

    const [showSidebar, setShowSidebar] = useState(true);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key.toLowerCase() === 'b') {
                setShowSidebar(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, []);

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
        <div className={`dashboard-layout ${!showSidebar ? 'sidebar-hidden' : ''}`}>
            <aside className={`sidebar ${!showSidebar ? 'hidden' : ''}`}>
                <div className="sidebar-header">
                    <div className="header-top">
                        <h3>Dashboard</h3>
                        <span className="shortcut-hint">Ctrl+B</span>
                    </div>
                    <p className="channel-display">{channelId}</p>
                    <div className="live-badge">
                        <span className="pulse"></span>
                        Live: {liveId}
                    </div>
                </div>

                <div className="settings-container">
                    <div className="section-title">Overlay Mode</div>
                    <div className="setting-toggle">
                        <label>Chroma Key Mode</label>
                        <input
                            type="checkbox"
                            checked={settings.chromaMode}
                            onChange={(e) => setSettings({ ...settings, chromaMode: e.target.checked })}
                        />
                    </div>

                    <div className="setting-toggle">
                        <label>Show Preview Grid</label>
                        <input
                            type="checkbox"
                            checked={settings.showGrid}
                            onChange={(e) => setSettings({ ...settings, showGrid: e.target.checked })}
                        />
                    </div>

                    {settings.chromaMode && (
                        <div className="setting-group animate-in">
                            <label>Chroma Color</label>
                            <input
                                type="color"
                                value={settings.chromaColor}
                                onChange={(e) => setSettings({ ...settings, chromaColor: e.target.value })}
                            />
                        </div>
                    )}

                    <div className="section-title">Style Settings</div>

                    <div className="setting-group">
                        <label>Text Outline ({settings.textStroke}px)</label>
                        <input
                            type="range" min="0" max="4" step="0.5"
                            value={settings.textStroke}
                            onChange={(e) => setSettings({ ...settings, textStroke: parseFloat(e.target.value) })}
                        />
                    </div>

                    {settings.textStroke > 0 && (
                        <div className="setting-group animate-in">
                            <label>Outline Color</label>
                            <input
                                type="color"
                                value={settings.textStrokeColor}
                                onChange={(e) => setSettings({ ...settings, textStrokeColor: e.target.value })}
                            />
                        </div>
                    )}

                    <div className="setting-group">
                        <label>Font Size ({settings.fontSize}px)</label>
                        <input
                            type="range" min="12" max="32"
                            value={settings.fontSize}
                            onChange={(e) => setSettings({ ...settings, fontSize: parseInt(e.target.value) })}
                        />
                    </div>

                    <div className="setting-group">
                        <label>Background Opacity ({Math.round(settings.bgOpacity * 100)}%)</label>
                        <input
                            type="range" min="0" max="1" step="0.1"
                            value={settings.bgOpacity}
                            onChange={(e) => setSettings({ ...settings, bgOpacity: parseFloat(e.target.value) })}
                        />
                    </div>

                    <div className="setting-group">
                        <label>Message Opacity ({Math.round(settings.messageOpacity * 100)}%)</label>
                        <input
                            type="range" min="0" max="1" step="0.1"
                            value={settings.messageOpacity}
                            onChange={(e) => setSettings({ ...settings, messageOpacity: parseFloat(e.target.value) })}
                        />
                    </div>

                    <div className="setting-toggle">
                        <label>Show Avatars</label>
                        <input
                            type="checkbox"
                            checked={settings.showAvatars}
                            onChange={(e) => setSettings({ ...settings, showAvatars: e.target.checked })}
                        />
                    </div>

                    <div className="setting-toggle">
                        <label>Show Badges</label>
                        <input
                            type="checkbox"
                            checked={settings.showBadges}
                            onChange={(e) => setSettings({ ...settings, showBadges: e.target.checked })}
                        />
                    </div>
                    <div className="section-title">3D Transform</div>
                    <div className="setting-toggle">
                        <label>Enable 3D Effect</label>
                        <input
                            type="checkbox"
                            checked={settings.threeDEnabled}
                            onChange={(e) => setSettings({ ...settings, threeDEnabled: e.target.checked })}
                        />
                    </div>

                    {settings.threeDEnabled && (
                        <div className="animate-in">
                            <div className="setting-group">
                                <label>Perspective ({settings.perspective}px)</label>
                                <input
                                    type="range" min="500" max="2500" step="10"
                                    value={settings.perspective}
                                    onChange={(e) => setSettings({ ...settings, perspective: parseInt(e.target.value) })}
                                />
                            </div>
                            <div className="setting-group">
                                <label>Rotate X ({settings.rotateX}deg)</label>
                                <input
                                    type="range" min="-180" max="180"
                                    value={settings.rotateX}
                                    onChange={(e) => setSettings({ ...settings, rotateX: parseInt(e.target.value) })}
                                />
                            </div>
                            <div className="setting-group">
                                <label>Rotate Y ({settings.rotateY}deg)</label>
                                <input
                                    type="range" min="-180" max="180"
                                    value={settings.rotateY}
                                    onChange={(e) => setSettings({ ...settings, rotateY: parseInt(e.target.value) })}
                                />
                            </div>
                            <div className="setting-group">
                                <label>Rotate Z ({settings.rotateZ}deg)</label>
                                <input
                                    type="range" min="-180" max="180"
                                    value={settings.rotateZ}
                                    onChange={(e) => setSettings({ ...settings, rotateZ: parseInt(e.target.value) })}
                                />
                            </div>
                            <div className="setting-group">
                                <label>Skew X ({settings.skewX}deg)</label>
                                <input
                                    type="range" min="-45" max="45"
                                    value={settings.skewX}
                                    onChange={(e) => setSettings({ ...settings, skewX: parseInt(e.target.value) })}
                                />
                            </div>
                            <div className="setting-group">
                                <label>Scale ({settings.scale})</label>
                                <input
                                    type="range" min="0.5" max="2" step="0.1"
                                    value={settings.scale}
                                    onChange={(e) => setSettings({ ...settings, scale: parseFloat(e.target.value) })}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <button onClick={handleStop} className="btn-disconnect">Disconnect</button>
            </aside>

            <main
                className={`preview-area ${settings.chromaMode ? 'chroma-active' : ''} ${!settings.showGrid ? 'no-grid' : ''}`}
                style={{
                    backgroundColor: settings.chromaMode ? settings.chromaColor : `rgba(0,0,0,${settings.bgOpacity})`,
                    perspective: settings.threeDEnabled ? `${settings.perspective}px` : 'none'
                }}
            >
                <div
                    className="chat-overlay"
                    style={{
                        fontSize: `${settings.fontSize}px`,
                        transform: settings.threeDEnabled ? `
                            rotateX(${settings.rotateX}deg) 
                            rotateY(${settings.rotateY}deg) 
                            rotateZ(${settings.rotateZ}deg)
                            skewX(${settings.skewX}deg)
                            scale(${settings.scale})
                        ` : 'none',
                        transformStyle: 'preserve-3d'
                    }}
                >
                    {messages.map((msg) => (
                        <div
                            key={msg.ID}
                            className="chat-item animate-in"
                            style={{ backgroundColor: `rgba(0,0,0,${settings.messageOpacity})` }}
                        >
                            {settings.showAvatars && (
                                <img src={msg.Author.Thumbnail.URL} alt={msg.Author.Name} className="avatar" />
                            )}
                            <div className="chat-content">
                                <div className="author-row">
                                    <span
                                        className={`author-name ${msg.IsOwner ? 'owner' : ''} ${msg.IsModerator ? 'mod' : ''}`}
                                    >
                                        {msg.Author.Name}
                                    </span>
                                    {settings.showBadges && (
                                        <>
                                            {msg.IsOwner && <span className="badge owner-badge">OWNER</span>}
                                            {msg.IsModerator && <span className="badge mod-badge">MOD</span>}
                                        </>
                                    )}
                                </div>
                                <div
                                    className="message-text"
                                    style={{
                                        WebkitTextStroke: `${settings.textStroke}px ${settings.textStrokeColor}`
                                    }}
                                >
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
            </main>
        </div>
    );
}

export default App;
