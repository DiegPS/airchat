import React, { createContext, useContext, useState, useMemo, useCallback, ReactNode } from 'react';
import { ChatSettings } from '../types';

const defaultSettings: ChatSettings = {
    fontSize: 16,
    bgOpacity: 0.1,
    messageOpacity: 0.4,
    showAvatars: true,
    showBadges: true, showTimestamp: false, chromaMode: false,
    chromaColor: '#00c853',
    textStroke: 0,
    textStrokeColor: '#000000',
    threeDEnabled: false,
    hideScrollbar: false,
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
    maxMessages: 100,
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
    obsHudShowScene: false,
    showPlatformBadge: true,
    twitchBubbleAccent: true,
    ttsEnabled: false,
    ttsMembersOnly: false,
    ttsAllowCustomUsers: false,
    ttsCustomUsersList: '',
    ttsCommandMode: false,
    ttsCommandPrefix: '!voice',
    ttsSeparatorText: 'says:',
    ttsRandomVoice: false,
    ttsProvider: 'browser',
    ttsVoice: '',
    supertonicVoiceStyle: 'M1.json',
    supertonicLang: 'en',
    supertonicTotalStep: 5,
    supertonicSpeed: 1.05,
};

interface SettingsContextType {
    settings: ChatSettings;
    updateSettings: (newSettings: Partial<ChatSettings>) => void;
    resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
    // 1. Initialize from localStorage (lazy initialization)
    const [settings, setSettings] = useState<ChatSettings>(() => {
        try {
            const saved = localStorage.getItem('AIRCHAT_SETTINGS');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Merge with defaultSettings to ensure new keys are added if missing in localStorage
                return { ...defaultSettings, ...parsed };
            }
        } catch (e) {
            console.error("Failed to load settings from localStorage:", e);
        }
        return defaultSettings;
    });

    // 2. Save to localStorage whenever settings change
    React.useEffect(() => {
        localStorage.setItem('AIRCHAT_SETTINGS', JSON.stringify(settings));
    }, [settings]);

    const updateSettings = useCallback((newSettings: Partial<ChatSettings>) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    }, []);

    const resetSettings = useCallback(() => {
        setSettings(defaultSettings);
    }, []);

    const value = useMemo(
        () => ({ settings, updateSettings, resetSettings }),
        [settings, updateSettings, resetSettings]
    );

    return (
        <SettingsContext.Provider value={value}>
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
