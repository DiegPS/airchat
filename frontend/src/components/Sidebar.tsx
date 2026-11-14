import React from 'react';
import { useSettings } from '../context/SettingsContext';
import { SETTINGS_SCHEMA } from '../config/settingsSchema';
import { SettingControl } from './SettingControl';
import { PlatformView } from '../hooks/usePlatforms';

interface SidebarProps {
    showSidebar: boolean;
    platforms: PlatformView[];
    isPreviewMode: boolean;
    onStop: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ showSidebar, platforms, isPreviewMode, onStop }) => {
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
                        {platforms.filter(({ state }) => state.active).map(({ def, input, state }) => (
                            <div className="live-badge" key={def.id}>
                                <span className={def.pulseClass}></span>
                                {def.label} · {state.detail || input}
                            </div>
                        ))}
                        {platforms.map(({ def, state }) => (
                            <React.Fragment key={def.id}>
                                {state.error && <div className="platform-error">{def.label}: {state.error}</div>}
                                {state.warning && <div className="platform-warning">{def.label}: {state.warning}</div>}
                            </React.Fragment>
                        ))}
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
