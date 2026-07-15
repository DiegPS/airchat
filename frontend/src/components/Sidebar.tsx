import React from 'react';
import { useSettings } from '../context/SettingsContext';
import { SETTINGS_SCHEMA } from '../config/settingsSchema';
import { SettingControl } from './SettingControl';

interface SidebarProps {
    showSidebar: boolean;
    channelId: string;
    liveId: string;
    isPreviewMode: boolean;
    isStarted: boolean;
    isTwitchStarted: boolean;
    isKickStarted: boolean;
    isTikTokStarted: boolean;
    twitchChannel: string;
    kickChannel: string;
    tiktokChannel: string;
    error: string;
    twitchError: string;
    kickError: string;
    tiktokError: string;
    onStop: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    showSidebar,
    channelId,
    liveId,
    isPreviewMode,
    isStarted,
    isTwitchStarted,
    isKickStarted,
    isTikTokStarted,
    twitchChannel,
    kickChannel,
    tiktokChannel,
    error,
    twitchError,
    kickError,
    tiktokError,
    onStop
}) => {
    const { settings, updateSettings } = useSettings();

    return (
        <aside className={`sidebar ${!showSidebar ? 'hidden' : ''}`}>
            <div className="sidebar-header">
                <div className="header-top">
                    <h3>{isPreviewMode ? 'Design Preview' : 'Dashboard'}</h3>
                    <span className="shortcut-hint">Ctrl+B</span>
                </div>
                {isPreviewMode ? (
                    <div className="live-badge">
                        <span className="dot-preview"></span>
                        Preview Mode Active
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {isStarted && (
                            <div className="live-badge">
                                <span className="pulse"></span>
                                YouTube · {liveId || channelId}
                            </div>
                        )}
                        {isTwitchStarted && (
                            <div className="live-badge">
                                <span className="pulse-twitch"></span>
                                Twitch · {twitchChannel}
                            </div>
                        )}
                        {isKickStarted && (
                            <div className="live-badge">
                                <span className="pulse-kick"></span>
                                Kick · {kickChannel}
                            </div>
                        )}
                        {isTikTokStarted && (
                            <div className="live-badge">
                                <span className="pulse"></span>
                                TikTok · {tiktokChannel}
                            </div>
                        )}
                        {error && (
                            <div className="platform-error">YouTube: {error}</div>
                        )}
                        {twitchError && (
                            <div className="platform-error">Twitch: {twitchError}</div>
                        )}
                        {kickError && (
                            <div className="platform-error">Kick: {kickError}</div>
                        )}
                        {tiktokError && (
                            <div className="platform-error">TikTok: {tiktokError}</div>
                        )}
                    </div>
                )}
            </div>

            <div className="settings-container">
                {SETTINGS_SCHEMA.map((section) => {
                    // Verificar si se debe mostrar toda la sección
                    if (section.showIf && !section.showIf(settings)) {
                        return null;
                    }

                    return (
                        <div key={section.id} className={section.id === '3d-controls' ? 'animate-in' : ''}>
                            {section.title && <div className="section-title">{section.title}</div>}

                            {section.items.map((item) => {
                                // Verificar si se debe mostrar el item individual
                                if (item.showIf && !item.showIf(settings)) {
                                    return null;
                                }

                                return (
                                    <SettingControl
                                        key={item.renderKey || item.key}
                                        config={item}
                                        value={settings[item.key]}
                                        onChange={(val) => updateSettings({ [item.key]: val })}
                                    />
                                );
                            })}
                        </div>
                    );
                })}
            </div>

            <button onClick={onStop} className="btn-disconnect">Disconnect</button>
        </aside>
    );
};
