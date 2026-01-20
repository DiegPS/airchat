import React, { useState } from 'react';

// Define the response types locally as they are not yet in generated bindings
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
    onStart: () => void;
    onPreview: () => void;
    onVtuber?: () => void;
    error: string | null;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({
    channelId,
    onChannelIdChange,
    onStart,
    onPreview,
    onVtuber,
    error
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
            // Using window object to access Wails backend function
            // @ts-ignore
            const response: SearchResponse = await window['go']['main']['App']['SearchYoutubeChannel'](searchQuery);
            
            if (response && response.success && response.userData) {
                setSearchResults(response.userData);
            } else {
                setSearchResults([]);
                setSearchError('No results found');
            }
        } catch (e) {
            console.error('Search failed:', e);
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

    return (
        <div className="container">
            <div className="setup-card">
                <h1 className="title">YouTube Chat Overlay</h1>
                
                <div className="mode-toggle" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                    <button 
                        className={`text-btn ${!isSearchMode ? 'active' : ''}`}
                        onClick={() => setIsSearchMode(false)}
                        style={{ background: 'none', border: 'none', color: !isSearchMode ? '#fff' : '#888', cursor: 'pointer', fontSize: '1rem', fontWeight: !isSearchMode ? 'bold' : 'normal', borderBottom: !isSearchMode ? '2px solid #fff' : '2px solid transparent', paddingBottom: '5px' }}
                    >
                        Enter ID
                    </button>
                    
                    <button 
                        className={`text-btn ${isSearchMode ? 'active' : ''}`}
                        onClick={() => setIsSearchMode(true)}
                        style={{ background: 'none', border: 'none', color: isSearchMode ? '#fff' : '#888', cursor: 'pointer', fontSize: '1rem', fontWeight: isSearchMode ? 'bold' : 'normal', borderBottom: isSearchMode ? '2px solid #fff' : '2px solid transparent', paddingBottom: '5px' }}
                    >
                        Search Channel
                    </button>
                </div>

                {isSearchMode ? (
                    <>
                        <p className="subtitle">Search for a YouTube channel by name</p>
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
                            <div className="search-results" style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', overflowY: 'auto', maxHeight: '300px' }}>
                                {searchResults.map((user) => (
                                    <div 
                                        key={user.id} 
                                        onClick={() => selectChannel(user.id)}
                                        style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            padding: '10px', 
                                            cursor: 'pointer', 
                                            borderBottom: '1px solid rgba(255,255,255,0.1)',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <img 
                                            src={user.avatar} 
                                            alt={user.username} 
                                            style={{ width: '40px', height: '40px', borderRadius: '50%', marginRight: '12px' }} 
                                        />
                                        <div style={{ textAlign: 'left' }}>
                                            <div style={{ fontWeight: 'bold' }}>{user.username}</div>
                                            <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{user.id}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <p className="subtitle">Enter a Channel ID to start capturing live chat</p>
                        <div className="input-group">
                            <input
                                type="text"
                                placeholder="UCxxxxxxxxxxxx"
                                value={channelId}
                                onChange={(e) => onChannelIdChange(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && onStart()}
                            />
                            <button onClick={onStart} className="btn-primary">Connect</button>
                        </div>
                    </>
                )}

                {!isSearchMode && (
                    <>
                        <div className="divider"><span>OR</span></div>
                        <button onClick={onPreview} className="btn-secondary">Preview Design</button>
                        {onVtuber && (
                            <>
                                <div className="divider"><span>OR</span></div>
                                <button onClick={onVtuber} className="btn-secondary">VTuber Mode 🎭</button>
                            </>
                        )}
                    </>
                )}
                
                {error && !isSearchMode && <p className="error-message">{error}</p>}
            </div>
        </div>
    );
};
