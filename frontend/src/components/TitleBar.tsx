import { WindowMinimise, WindowToggleMaximise, Quit, WindowSetAlwaysOnTop } from '../../wailsjs/runtime/runtime';
import './TitleBar.css';
import { useState } from 'react';

interface TitleBarProps {
    show?: boolean;
}

export function TitleBar({ show = true }: TitleBarProps) {
    const [isPinned, setIsPinned] = useState(false);

    const togglePin = () => {
        const newState = !isPinned;
        setIsPinned(newState);
        WindowSetAlwaysOnTop(newState);
    };

    return (
        <div className={`title-bar ${!show ? 'hidden' : ''}`}>
            <div className={`window-title ${!show ? 'visible' : ''}`}>AirChat</div>
            <div className="window-controls">
                <button
                    className={`control-btn ${isPinned ? 'pinned' : ''}`}
                    onClick={togglePin}
                    title={isPinned ? "Unpin from top" : "Pin to top"}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(45deg)' }}>
                        <line x1="12" y1="17" x2="12" y2="3"></line>
                        <path d="M5 17h14v4H5z"></path>
                    </svg>
                </button>
                <button className="control-btn" onClick={WindowMinimise} title="Minimize">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
                <button className="control-btn" onClick={WindowToggleMaximise} title="Maximize">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    </svg>
                </button>
                <button className="control-btn close" onClick={Quit} title="Close">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        </div>
    );
}
