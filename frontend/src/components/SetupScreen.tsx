import React from 'react';
import { PlatformId } from '../platforms';
import { PlatformView } from '../hooks/usePlatforms';
import { PlatformIcon } from './PlatformIcon';

interface SetupScreenProps {
    platforms: PlatformView[];
    notice: string;
    onInputChange: (id: PlatformId, value: string) => void;
    onClear: (id: PlatformId) => void;
    onStart: () => void;
    onPreview: () => void;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({
    platforms,
    notice,
    onInputChange,
    onClear,
    onStart,
    onPreview,
}) => {
    const canConnect = platforms.some((p) => p.input.trim() !== '');

    return (
        <div className="container">
            <div className="setup-card">
                <header className="setup-header">
                    <div className="setup-kicker">AirChat overlay</div>
                    <h1 className="title">Connect live chat</h1>
                    <p className="subtitle">
                        Add one or more stream chats, then customize how messages appear in your overlay.
                    </p>
                </header>

                <div className="platform-list">
                    {platforms.map(({ def, input, state }) => (
                        <section className="platform-field" key={def.id}>
                            <div className="platform-label-row">
                                <div className="platform-label">
                                    <PlatformIcon platform={def.id} size={18} />
                                    <span>{def.label}</span>
                                </div>
                                <span className="platform-hint">{def.hint}</span>
                            </div>
                            <div className="input-group">
                                <input
                                    type="text"
                                    placeholder={def.placeholder}
                                    value={input}
                                    onChange={(e) => onInputChange(def.id, e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && canConnect && onStart()}
                                />
                                {input && (
                                    <button className="input-clear" onClick={() => onClear(def.id)} title="Clear">x</button>
                                )}
                            </div>
                            {state.error && <p className="error-message">{state.error}</p>}
                        </section>
                    ))}
                    {notice && <p className="error-message">{notice}</p>}
                </div>

                <div className="setup-actions">
                    <button
                        onClick={onStart}
                        className="btn-primary setup-connect"
                        disabled={!canConnect}
                    >
                        Connect chats
                    </button>
                    <button onClick={onPreview} className="btn-secondary setup-preview">Preview design</button>
                </div>
                <p className="setup-footnote">You can connect any combination of platforms.</p>
            </div>
        </div>
    );
};
