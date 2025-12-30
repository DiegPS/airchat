import React from 'react';
import { useSettings } from '../context/SettingsContext';
import { SETTINGS_SCHEMA } from '../config/settingsSchema';
import { SettingControl } from './SettingControl';

interface SidebarProps {
    showSidebar: boolean;
    channelId: string;
    liveId: string;
    isPreviewMode: boolean;
    onStop: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    showSidebar,
    channelId,
    liveId,
    isPreviewMode,
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
                <p className="channel-display">{isPreviewMode ? 'DEMO MODE' : channelId}</p>
                <div className="live-badge">
                    <span className={isPreviewMode ? 'dot-preview' : 'pulse'}></span>
                    {isPreviewMode ? 'Preview Mode Active' : `Live: ${liveId}`}
                </div>
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
                                        key={item.key}
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
