import { ChatSettings } from '../types';

export type SettingType = 'toggle' | 'range' | 'color' | 'select' | 'text' | 'textarea' | 'number' | 'button' | 'voice-select' | 'tts-test';

export interface SettingConfig {
    key: keyof ChatSettings;
    label: string;
    type: SettingType;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    options?: { label: string; value: string }[];
    // Función opcional para formatear el valor mostrado (ej: 0.5 -> 50%)
    formatDisplay?: (value: any) => string;
    // Función opcional para decidir si este control se muestra
    showIf?: (settings: ChatSettings) => boolean;
    // Campo de solo lectura
    readOnly?: boolean;
}

export interface SettingsSection {
    id: string;
    title?: string;
    items: SettingConfig[];
    // Función opcional para decidir si toda la sección se muestra
    showIf?: (settings: ChatSettings) => boolean;
}

export const SETTINGS_SCHEMA: SettingsSection[] = [
    {
        id: 'overlay',
        title: 'Overlay Mode',
        items: [
            { key: 'chromaMode', label: 'Chroma Key Mode', type: 'toggle' },
            { key: 'showGrid', label: 'Show Preview Grid', type: 'toggle' },
            { key: 'hideScrollbar', label: 'Hide Scrollbar', type: 'toggle' },
            {
                key: 'chromaColor',
                label: 'Chroma Color',
                type: 'color',
                showIf: (s) => s.chromaMode
            },
        ]
    },
    {
        id: 'platforms',
        title: 'Platform Display',
        items: [
            { key: 'showPlatformBadge', label: 'Show Platform Icon (YouTube/Twitch)', type: 'toggle' },
            { key: 'twitchBubbleAccent', label: 'Twitch Purple Accent', type: 'toggle' },
            { key: 'kickBubbleAccent', label: 'Kick Green Accent', type: 'toggle' },
        ]
    },
    {
        id: 'style',
        title: 'Style Settings',
        items: [
            {
                key: 'textStroke',
                label: 'Text Outline',
                type: 'range',
                min: 0,
                max: 4,
                step: 0.5,
                unit: 'px'
            },
            {
                key: 'textStrokeColor',
                label: 'Outline Color',
                type: 'color',
                showIf: (s) => s.textStroke > 0
            },
            { key: 'fontSize', label: 'Font Size', type: 'range', min: 12, max: 32, unit: 'px' },
            { key: 'lineHeight', label: 'Line Height', type: 'range', min: 1, max: 2, step: 0.1 },
            {
                key: 'fontWeight',
                label: 'Font Weight',
                type: 'range',
                min: 100,
                max: 900,
                step: 100,
                formatDisplay: (v) => v === 400 ? 'Normal' : v === 700 ? 'Bold' : v
            },
            {
                key: 'bgOpacity',
                label: 'Background Opacity',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.1,
                formatDisplay: (v) => `${Math.round(v * 100)}%`
            },
            { key: 'showAvatars', label: 'Show Avatars', type: 'toggle' },
            { key: 'showBadges', label: 'Show Badges', type: 'toggle' },
            { key: 'showTimestamp', label: 'Show Timestamps', type: 'toggle' },
        ]
    },
    {
        id: 'message-design',
        title: 'Message Design',
        items: [
            { key: 'showBubble', label: 'Show Bubble Background', type: 'toggle' },
            {
                key: 'textAlign',
                label: 'Text Alignment',
                type: 'select',
                options: [
                    { label: 'Left', value: 'left' },
                    { label: 'Center', value: 'center' },
                    { label: 'Right', value: 'right' }
                ]
            },
            {
                key: 'messageOpacity',
                label: 'Bubble Opacity',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.1,
                formatDisplay: (v) => `${Math.round(v * 100)}%`,
                showIf: (s) => s.showBubble
            },
            {
                key: 'borderRadius',
                label: 'Corner Radius',
                type: 'range',
                min: 0,
                max: 30,
                unit: 'px',
                showIf: (s) => s.showBubble
            },
            { key: 'messageGap', label: 'Vertical Gap', type: 'range', min: 0, max: 30, unit: 'px' },
            {
                key: 'maxMessages',
                label: 'Max Messages',
                type: 'range',
                min: 10,
                max: 500,
                step: 10,
                formatDisplay: (v) => `${v}`
            },
            { key: 'textShadow', label: 'Drop Shadow', type: 'toggle' },
        ]
    },
    {
        id: 'animation',
        title: 'Animation',
        items: [
            {
                key: 'animation',
                label: 'Entrance Animation',
                type: 'select',
                options: [
                    { label: 'Slide Up', value: 'slide-up' },
                    { label: 'Slide Left', value: 'slide-left' },
                    { label: 'Fade In', value: 'fade-in' },
                    { label: 'Zoom In', value: 'zoom-in' }
                ]
            },
            {
                key: 'animationDuration',
                label: 'Duration (Speed)',
                type: 'range',
                min: 0.1,
                max: 2,
                step: 0.1,
                formatDisplay: (v) => `${v}s`
            },
        ]
    },
    {
        id: '3d-toggle',
        title: '3D Transform',
        items: [
            { key: 'threeDEnabled', label: 'Enable 3D Effect', type: 'toggle' }
        ]
    },
    {
        id: '3d-controls',
        // Sin título para que parezca continuación del anterior
        showIf: (s) => s.threeDEnabled,
        items: [
            { key: 'perspective', label: 'Perspective', type: 'range', min: 500, max: 2500, step: 10, unit: 'px' },
            { key: 'rotateX', label: 'Rotate X', type: 'range', min: -180, max: 180, unit: 'deg' },
            { key: 'rotateY', label: 'Rotate Y', type: 'range', min: -180, max: 180, unit: 'deg' },
            { key: 'rotateZ', label: 'Rotate Z', type: 'range', min: -180, max: 180, unit: 'deg' },
            { key: 'skewX', label: 'Skew X', type: 'range', min: -45, max: 45, unit: 'deg' },
            { key: 'scale', label: 'Scale', type: 'range', min: 0.5, max: 2, step: 0.1 },
        ]
    },
    {
        id: 'sub-goal',
        title: 'Subscriber Goal',
        items: [
            { key: 'showSubGoal', label: 'Show Goal Overlay', type: 'toggle' },
            {
                key: 'subGoalTitle',
                label: 'Goal Title',
                type: 'text',
                showIf: (s) => s.showSubGoal
            },
            {
                key: 'subGoalTarget',
                label: 'Goal Target',
                type: 'number',
                showIf: (s) => s.showSubGoal
            },
        ]
    },
    {
        id: 'obs',
        title: 'OBS Integration',
        items: [
            { key: 'obsEnabled', label: 'Enable Integration', type: 'toggle' },
            {
                key: 'obsHost',
                label: 'WebSocket Host',
                type: 'text',
                showIf: (s) => s.obsEnabled
            },
            {
                key: 'obsPassword',
                label: 'WebSocket Password',
                type: 'text',
                showIf: (s) => s.obsEnabled
            },
            {
                key: 'obsConnected',
                label: 'Connection',
                type: 'button',
                showIf: (s) => s.obsEnabled
            },
            {
                key: 'obsStatusMessage',
                label: 'Status',
                type: 'text',
                readOnly: true,
                showIf: (s) => s.obsEnabled
            }
        ]
    },
    {
        id: 'obs-hud',
        title: 'HUD Settings',
        showIf: (s) => s.obsEnabled && s.obsConnected,
        items: [
            {
                key: 'obsHudPosition',
                label: 'Position',
                type: 'select',
                options: [
                    { label: 'Top Left', value: 'top-left' },
                    { label: 'Top Right', value: 'top-right' },
                    { label: 'Bottom Left', value: 'bottom-left' },
                    { label: 'Bottom Right', value: 'bottom-right' }
                ]
            },
            {
                key: 'obsHudScale',
                label: 'Size (Scale)',
                type: 'range',
                min: 0.5,
                max: 2.0,
                step: 0.1,
                formatDisplay: (v) => `${Math.round(v * 100)}%`
            },
            {
                key: 'obsHudOpacity',
                label: 'Background Opacity',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.1,
                formatDisplay: (v) => `${Math.round(v * 100)}%`
            },
            { key: 'obsHudShowBitrate', label: 'Show Bitrate', type: 'toggle' },
            { key: 'obsHudShowFps', label: 'Show FPS', type: 'toggle' },
            { key: 'obsHudShowMic', label: 'Show Microphone Controls', type: 'toggle' },
            { key: 'obsHudShowDesktop', label: 'Show Desktop Audio Controls', type: 'toggle' },
            { key: 'obsHudShowScene', label: 'Show Current Scene', type: 'toggle' },
        ]
    },
    {
        id: 'tts',
        title: 'Text to Speech (TTS)',
        items: [
            { key: 'ttsEnabled', label: 'Enable TTS', type: 'toggle' },
            { key: 'ttsMembersOnly', label: 'Members Only', type: 'toggle', showIf: (s) => s.ttsEnabled },
            { key: 'ttsAllowCustomUsers', label: 'Allow Custom Users (Bypass Members Mode)', type: 'toggle', showIf: (s) => s.ttsEnabled && s.ttsMembersOnly },
            { 
                key: 'ttsCustomUsersList', 
                label: 'Custom Usernames (comma separated)', 
                type: 'textarea', 
                showIf: (s) => s.ttsEnabled && s.ttsMembersOnly && s.ttsAllowCustomUsers 
            },
            { key: 'ttsCommandMode', label: 'Only read messages with command', type: 'toggle', showIf: (s) => s.ttsEnabled },
            {
                key: 'ttsCommandPrefix',
                label: 'Command Prefix',
                type: 'text',
                showIf: (s) => s.ttsEnabled && s.ttsCommandMode
            },
            {
                key: 'ttsSeparatorText',
                label: 'Separator Text (e.g., "says:")',
                type: 'text',
                showIf: (s) => s.ttsEnabled
            },
            {
                key: 'ttsRandomVoice',
                label: 'Random Voice per Message',
                type: 'toggle',
                showIf: (s) => s.ttsEnabled
            },
            {
                key: 'ttsProvider',
                label: 'Provider',
                type: 'select',
                options: [
                    { label: 'Browser API', value: 'browser' },
                    { label: 'Supertonic 2 (Neural TTS)', value: 'supertonic' },
                    { label: 'Google Cloud TTS', value: 'google' },
                    { label: 'Amazon Polly', value: 'polly' },
                    { label: 'Microsoft Azure', value: 'azure' },
                    { label: 'ElevenLabs', value: 'elevenlabs' }
                ],
                showIf: (s) => s.ttsEnabled
            },
            {
                key: 'ttsVoice',
                label: 'Voice',
                type: 'voice-select',
                showIf: (s) => s.ttsEnabled && s.ttsProvider === 'browser',
                readOnly: false
            },
            {
                key: 'ttsVoiceTest' as any,
                label: 'Test Voice',
                type: 'tts-test',
                showIf: (s) => s.ttsEnabled && (s.ttsProvider === 'browser' || s.ttsProvider === 'supertonic')
            },
            {
                key: 'supertonicVoiceStyle',
                label: 'Voice Style',
                type: 'select',
                readOnly: false,
                options: [
                    { label: 'Male 1 (M1)', value: 'M1.json' },
                    { label: 'Male 2 (M2)', value: 'M2.json' },
                    { label: 'Male 3 (M3)', value: 'M3.json' },
                    { label: 'Male 4 (M4)', value: 'M4.json' },
                    { label: 'Male 5 (M5)', value: 'M5.json' },
                    { label: 'Female 1 (F1)', value: 'F1.json' },
                    { label: 'Female 2 (F2)', value: 'F2.json' },
                    { label: 'Female 3 (F3)', value: 'F3.json' },
                    { label: 'Female 4 (F4)', value: 'F4.json' },
                    { label: 'Female 5 (F5)', value: 'F5.json' }
                ],
                showIf: (s) => s.ttsEnabled && s.ttsProvider === 'supertonic'
            },
            {
                key: 'supertonicLang',
                label: 'Language',
                type: 'select',
                options: [
                    { label: 'English (en)', value: 'en' },
                    { label: '한국어 (ko)', value: 'ko' },
                    { label: 'Español (es)', value: 'es' },
                    { label: 'Português (pt)', value: 'pt' },
                    { label: 'Français (fr)', value: 'fr' }
                ],
                showIf: (s) => s.ttsEnabled && s.ttsProvider === 'supertonic'
            },
            {
                key: 'supertonicTotalStep',
                label: 'Quality Steps (higher = better)',
                type: 'range',
                min: 1,
                max: 20,
                step: 1,
                showIf: (s) => s.ttsEnabled && s.ttsProvider === 'supertonic'
            },
            {
                key: 'supertonicSpeed',
                label: 'Speed',
                type: 'range',
                min: 0.5,
                max: 2.0,
                step: 0.05,
                formatDisplay: (v) => `${v.toFixed(2)}x`,
                showIf: (s) => s.ttsEnabled && s.ttsProvider === 'supertonic'
            }
        ]
    }
];
