import React, { useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { TIKTOK_CONNECTION_SECTION } from '../config/settingsSchema';
import { SettingControl } from './SettingControl';

interface SetupScreenProps {
    channelId: string;
    onChannelIdChange: (id: string) => void;
    onClearYoutube: () => void;
    twitchChannel: string;
    onTwitchChannelChange: (name: string) => void;
    onClearTwitch: () => void;
    kickChannel: string;
    onKickChannelChange: (name: string) => void;
    onClearKick: () => void;
    tiktokChannel: string;
    onTikTokChannelChange: (name: string) => void;
    onClearTikTok: () => void;
    onStart: () => void;
    onPreview: () => void;
    error: string | null;
    twitchError: string;
    kickError: string;
    tiktokError: string;
    isTikTokConnecting: boolean;
    tiktokConnectionStatus: string;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({
    channelId,
    onChannelIdChange,
    onClearYoutube,
    twitchChannel,
    onTwitchChannelChange,
    onClearTwitch,
    kickChannel,
    onKickChannelChange,
    onClearKick,
    tiktokChannel,
    onTikTokChannelChange,
    onClearTikTok,
    onStart,
    onPreview,
    error,
    twitchError,
    kickError,
    tiktokError,
    isTikTokConnecting,
    tiktokConnectionStatus,
}) => {
    const { settings, updateSettings } = useSettings();
    const [showTikTokOptions, setShowTikTokOptions] = useState(false);
    const canConnect = !!channelId || !!twitchChannel || !!kickChannel || !!tiktokChannel;

    return (
        <div className="container">
            <div
                className="setup-card"
                style={showTikTokOptions ? { maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' } : undefined}
            >
                <header className="setup-header">
                    <h1 className="title">Connect live chat</h1>
                    <p className="subtitle">
                        Add one or more stream chats, then customize how messages appear in your overlay.
                    </p>
                </header>

                <div className="platform-list">
                    <section className="platform-field">
                        <div className="platform-label-row">
                            <div className="platform-label">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8A3 3 0 0 0 2.6 20c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z"/></svg>
                                <span>YouTube</span>
                            </div>
                            <span className="platform-hint">handle, channel ID, or video URL</span>
                        </div>
                        <div className="input-group">
                            <input
                                type="text"
                                placeholder="@xqc, UCxxxxxxxxxxxx, or youtube.com/watch?v=..."
                                value={channelId}
                                onChange={(e) => onChannelIdChange(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && canConnect && onStart()}
                            />
                            {channelId && (
                                <button className="input-clear" onClick={onClearYoutube} title="Clear">x</button>
                            )}
                        </div>
                        {error && <p className="error-message">{error}</p>}
                    </section>

                    <section className="platform-field">
                        <div className="platform-label-row">
                            <div className="platform-label">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="#9146FF"><path d="M11.6 6H13v4.5h-1.4V6zm3.8 0h1.4v4.5h-1.4V6zM4 0L.5 3.5V20.5H6V24l3.5-3.5H12L23.5 9V0H4zm18 8.5L18.5 12H16l-3 3v-3H9.5v-8H22v4.5z"/></svg>
                                <span>Twitch</span>
                            </div>
                            <span className="platform-hint">channel name</span>
                        </div>
                        <div className="input-group">
                            <input
                                type="text"
                                placeholder="xqc"
                                value={twitchChannel}
                                onChange={(e) => onTwitchChannelChange(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && canConnect && onStart()}
                            />
                            {twitchChannel && (
                                <button className="input-clear" onClick={onClearTwitch} title="Clear">x</button>
                            )}
                        </div>
                        {twitchError && <p className="error-message">{twitchError}</p>}
                    </section>

                    <section className="platform-field">
                        <div className="platform-label-row">
                            <div className="platform-label">
                                <svg width="18" height="18" viewBox="0 0 512 512" fill="#53FC18">
                                    <path d="M37 .036h164.448v113.621h54.71v-56.82h54.731V.036h164.448v170.777h-54.73v56.82h-54.711v56.8h54.71v56.82h54.73V512.03H310.89v-56.82h-54.73v-56.8h-54.711v113.62H37V.036z" />
                                </svg>
                                <span>Kick</span>
                            </div>
                            <span className="platform-hint">channel name</span>
                        </div>
                        <div className="input-group">
                            <input
                                type="text"
                                placeholder="edmatthews"
                                value={kickChannel}
                                onChange={(e) => onKickChannelChange(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && canConnect && onStart()}
                            />
                            {kickChannel && (
                                <button className="input-clear" onClick={onClearKick} title="Clear">x</button>
                            )}
                        </div>
                        {kickError && <p className="error-message">{kickError}</p>}
                    </section>

                    <section className="platform-field">
                        <div className="platform-label-row">
                            <div className="platform-label">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="M16.7 2c.3 2.4 1.8 3.8 4.3 4v3.1c-1.5.1-2.9-.3-4.2-1.2v6.3a6.2 6.2 0 1 1-5.4-6.1v3.2a3.1 3.1 0 1 0 2.1 2.9V2h3.2z" />
                                </svg>
                                <span>TikTok LIVE</span>
                            </div>
                            <span className="platform-hint">username or profile URL</span>
                        </div>
                        <div className="input-group">
                            <input
                                type="text"
                                placeholder="@creator or tiktok.com/@creator"
                                value={tiktokChannel}
                                onChange={(e) => onTikTokChannelChange(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && canConnect && onStart()}
                            />
                            {tiktokChannel && (
                                <button className="input-clear" onClick={onClearTikTok} title="Clear">x</button>
                            )}
                        </div>
                        {tiktokError && <p className="error-message">{tiktokError}</p>}
                        {isTikTokConnecting && tiktokConnectionStatus && (
                            <p className="platform-hint">{tiktokConnectionStatus}</p>
                        )}

                        <details onToggle={(event) => setShowTikTokOptions(event.currentTarget.open)}>
                            <summary className="platform-hint tiktok-options-toggle">TikTok connection options</summary>
                            {TIKTOK_CONNECTION_SECTION.items.map((item) => {
                                if (item.showIf && !item.showIf(settings)) return null;
                                return (
                                    <SettingControl
                                        key={item.renderKey || item.key}
                                        config={item}
                                        value={settings[item.key]}
                                        onChange={(value) => updateSettings({ [item.key]: value })}
                                    />
                                );
                            })}
                        </details>
                    </section>
                </div>

                <div className="setup-actions">
                    <button
                        onClick={onStart}
                        className="btn-primary setup-connect"
                        disabled={!canConnect || isTikTokConnecting}
                    >
                        {isTikTokConnecting ? 'Connecting...' : 'Connect chats'}
                    </button>
                    <button onClick={onPreview} className="btn-secondary setup-preview">Preview design</button>
                </div>
                <p className="setup-footnote">You can connect any combination of platforms.</p>
            </div>
        </div>
    );
};
