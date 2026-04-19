import React, { useState } from 'react';

interface LiveCountsUserData {
    id: string;
    username: string;
    avatar: string;
}

interface SearchResponse {
    cache: boolean;
    success: boolean;
    userData: LiveCountsUserData[];
}

interface SetupScreenProps {
    channelId: string;
    onChannelIdChange: (id: string) => void;
    twitchChannel: string;
    onTwitchChannelChange: (name: string) => void;
    onStart: () => void;
    onPreview: () => void;
    error: string | null;
    twitchError: string;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({
    channelId,
    onChannelIdChange,
    twitchChannel,
    onTwitchChannelChange,
    onStart,
    onPreview,
    error,
    twitchError
}) => {
    const [isSearchMode, setIsSearchMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<LiveCountsUserData[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState('');

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        setSearchError('');
        setSearchResults([]);
        try {
            // @ts-ignore
            const response: SearchResponse = await window['go']['main']['App']['SearchYoutubeChannel'](searchQuery);
            if (response && response.success && response.userData) {
                setSearchResults(response.userData);
            } else {
                setSearchError('No results found');
            }
        } catch (e) {
            setSearchError('Failed to search. Make sure the backend is running.');
        } finally {
            setIsSearching(false);
        }
    };

    const selectChannel = (id: string) => {
        onChannelIdChange(id);
        setIsSearchMode(false);
        setSearchResults([]);
        setSearchQuery('');
    };

    const canConnect = !!channelId || !!twitchChannel;

    return (
        <div className="container">
            <div className="setup-card">
                <h1 className="title">Chat Overlay</h1>

                {/* YouTube Section */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8A3 3 0 0 0 2.6 20c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z"/></svg>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>YouTube</span>
                        <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>optional</span>
                    </div>

                    <div className="mode-toggle" style={{ marginBottom: '0.75rem', display: 'flex', gap: '1rem' }}>
                        <button
                            className={`text-btn ${!isSearchMode ? 'active' : ''}`}
                            onClick={() => setIsSearchMode(false)}
                            style={{ background: 'none', border: 'none', color: !isSearchMode ? '#fff' : '#888', cursor: 'pointer', fontSize: '0.9rem', fontWeight: !isSearchMode ? 'bold' : 'normal', borderBottom: !isSearchMode ? '2px solid #fff' : '2px solid transparent', paddingBottom: '4px' }}
                        >
                            Enter ID
                        </button>
                        <button
                            className={`text-btn ${isSearchMode ? 'active' : ''}`}
                            onClick={() => setIsSearchMode(true)}
                            style={{ background: 'none', border: 'none', color: isSearchMode ? '#fff' : '#888', cursor: 'pointer', fontSize: '0.9rem', fontWeight: isSearchMode ? 'bold' : 'normal', borderBottom: isSearchMode ? '2px solid #fff' : '2px solid transparent', paddingBottom: '4px' }}
                        >
                            Search Channel
                        </button>
                    </div>

                    {isSearchMode ? (
                        <>
                            <div className="input-group">
                                <input
                                    type="text"
                                    placeholder="Channel Name (e.g. Tiburomzina)"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                <button onClick={handleSearch} className="btn-primary" disabled={isSearching}>
                                    {isSearching ? '...' : 'Search'}
                                </button>
                            </div>
                            {searchError && <p className="error-message">{searchError}</p>}
                            {searchResults.length > 0 && (
                                <div className="search-results" style={{ marginTop: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', overflowY: 'auto', maxHeight: '200px' }}>
                                    {searchResults.map((user) => (
                                        <div
                                            key={user.id}
                                            onClick={() => selectChannel(user.id)}
                                            style={{ display: 'flex', alignItems: 'center', padding: '10px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.1)', transition: 'background 0.2s' }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <img src={user.avatar} alt={user.username} style={{ width: '36px', height: '36px', borderRadius: '50%', marginRight: '10px' }} />
                                            <div style={{ textAlign: 'left' }}>
                                                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{user.username}</div>
                                                <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{user.id}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="input-group">
                            <input
                                type="text"
                                placeholder="UCxxxxxxxxxxxx"
                                value={channelId}
                                onChange={(e) => onChannelIdChange(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && canConnect && onStart()}
                            />
                        </div>
                    )}
                    {error && <p className="error-message">{error}</p>}
                </div>

                {/* Twitch Section */}
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
                    </div>
                    {twitchError && <p className="error-message">{twitchError}</p>}
                </div>

                {/* Actions */}
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
