import React from 'react';

interface SetupScreenProps {
    channelId: string;
    onChannelIdChange: (id: string) => void;
    onStart: () => void;
    onPreview: () => void;
    error: string;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({
    channelId,
    onChannelIdChange,
    onStart,
    onPreview,
    error
}) => {
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
                        onChange={(e) => onChannelIdChange(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && onStart()}
                    />
                    <button onClick={onStart} className="btn-primary">Connect</button>
                </div>
                <div className="divider"><span>OR</span></div>
                <button onClick={onPreview} className="btn-secondary">Preview Design</button>
                {error && <p className="error-message">{error}</p>}
            </div>
        </div>
    );
};
