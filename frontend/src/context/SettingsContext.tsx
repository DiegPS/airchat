import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ChatSettings } from '../types';

const defaultSettings: ChatSettings = {
    fontSize: 16,
    bgOpacity: 0.1,
    messageOpacity: 0.4,
    showAvatars: true,
    showBadges: true,
    chromaMode: false,
    chromaColor: '#00c853',
    textStroke: 0,
    textStrokeColor: '#000000',
    threeDEnabled: false,
    perspective: 1000,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
    skewX: 0,
    skewY: 0,
    scale: 1,
    showGrid: true,
    lineHeight: 1.5,
    messageGap: 15,
    fontWeight: 400,
    borderRadius: 16,
    textShadow: false,
    showBubble: true,
    animation: 'slide-up',
    animationDuration: 0.4,
    textAlign: 'left',
    showSubGoal: false,
    subGoalTitle: 'Sub Goal',
    subGoalTarget: 1000,
    obsEnabled: false,
    obsHost: 'localhost:4455',
    obsPassword: '',
    obsConnected: false,
    obsStatusMessage: 'Ready',
    obsHudPosition: 'bottom-right',
    obsHudOpacity: 0.7,
    obsHudScale: 1.0,
    obsHudShowFps: true,
    obsHudShowBitrate: true,
    obsHudShowMic: true,
    obsHudShowDesktop: false,
    ttsEnabled: false,
    ttsCommandMode: false,
    ttsCommandPrefix: '!voice',
    ttsProvider: 'browser',
    ttsVoice: '',
};

interface SettingsContextType {
    settings: ChatSettings;
    updateSettings: (newSettings: Partial<ChatSettings>) => void;
    resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
    const [settings, setSettings] = useState<ChatSettings>(defaultSettings);

    // Patch missing keys on mount/update (fixes HMR/Migration issues)
    React.useEffect(() => {
        setSettings(prev => ({ ...defaultSettings, ...prev }));
    }, []);

    const updateSettings = (newSettings: Partial<ChatSettings>) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    };

    const resetSettings = () => {
        setSettings(defaultSettings);
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
