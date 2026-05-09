import React from 'react';

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
    onStart: () => void;
    onPreview: () => void;
    error: string | null;
    twitchError: string;
    kickError: string;
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
    onStart,
    onPreview,
    error,
    twitchError,
    kickError,
}) => {
    const canConnect = !!channelId || !!twitchChannel || !!kickChannel;

    return (
        <div className="container">
            <div className="setup-card">
                <h1 className="title">Chat Overlay</h1>

                <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8A3 3 0 0 0 2.6 20c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z"/></svg>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>YouTube</span>
                        <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>optional</span>
                    </div>
                    <div style={{ marginBottom: '0.75rem', fontSize: '0.82rem', opacity: 0.65 }}>
                        Enter ID supports @handle, UC channel ID, or YouTube video URL.
                    </div>
                    <div className="input-group">
                        <input
                            type="text"
                            placeholder="@xqc, UCxxxxxxxxxxxx, or https://youtube.com/watch?v=..."
                            value={channelId}
                            onChange={(e) => onChannelIdChange(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && canConnect && onStart()}
                        />
                        {channelId && (
                            <button onClick={onClearYoutube} title="Clear" style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '0 8px', fontSize: '1rem', lineHeight: 1 }}>x</button>
                        )}
                    </div>
                    {error && <p className="error-message">{error}</p>}
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#9146FF"><path d="M11.6 6H13v4.5h-1.4V6zm3.8 0h1.4v4.5h-1.4V6zM4 0L.5 3.5V20.5H6V24l3.5-3.5H12L23.5 9V0H4zm18 8.5L18.5 12H16l-3 3v-3H9.5v-8H22v4.5z"/></svg>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Twitch</span>
                        <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>optional</span>
                    </div>
                    <div className="input-group">
                        <input
                            type="text"
                            placeholder="channel name (e.g. xqc)"
                            value={twitchChannel}
                            onChange={(e) => onTwitchChannelChange(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && canConnect && onStart()}
                        />
                        {twitchChannel && (
                            <button onClick={onClearTwitch} title="Clear" style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '0 8px', fontSize: '1rem', lineHeight: 1 }}>x</button>
                        )}
                    </div>
                    {twitchError && <p className="error-message">{twitchError}</p>}
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#53FC18" style={{ flexShrink: 0 }}>
                            <path d="M3 2h3v7.5l5-5L13.5 7 9 11.5l5 5L11.5 19l-5.5-5.5V22H3V2zm13 0h3v20h-3V2z"/>
                        </svg>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Kick</span>
                        <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>optional</span>
                    </div>
                    <div className="input-group">
                        <input
                            type="text"
                            placeholder="channel name (e.g. edmatthews)"
                            value={kickChannel}
                            onChange={(e) => onKickChannelChange(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && canConnect && onStart()}
                        />
                        {kickChannel && (
                            <button onClick={onClearKick} title="Clear" style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '0 8px', fontSize: '1rem', lineHeight: 1 }}>x</button>
                        )}
                    </div>
                    {kickError && <p className="error-message">{kickError}</p>}
                </div>

                <button
                    onClick={onStart}
                    className="btn-primary"
                    disabled={!canConnect}
                    style={{ width: '100%', marginBottom: '0.75rem', opacity: canConnect ? 1 : 0.4 }}
                >
                    Connect
                </button>

                <div className="divider"><span>OR</span></div>
                <button onClick={onPreview} className="btn-secondary">Preview Design</button>
            </div>
        </div>
    );
};
