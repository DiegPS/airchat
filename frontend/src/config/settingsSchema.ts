import { ChatSettings } from '../types';

export type SettingType = 'toggle' | 'range' | 'color' | 'select' | 'text' | 'password' | 'textarea' | 'number' | 'button' | 'voice-select' | 'tts-test' | 'supertonic-status';

export interface SettingConfig {
    key: keyof ChatSettings;
    renderKey?: string;
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

export const TIKTOK_CONNECTION_SECTION: SettingsSection = {
    id: 'tiktok-connection',
    title: 'TikTok Connection',
    items: [
        {
            key: 'tiktokCDN',
            label: 'CDN',
            type: 'select',
            options: [
                { label: 'Global', value: 'global' },
                { label: 'Europe', value: 'eu' },
                { label: 'United States', value: 'us' },
                { label: 'Custom', value: 'custom' }
            ]
        },
        {
            key: 'tiktokCustomCDN',
            label: 'Custom CDN Host',
            type: 'text',
            showIf: (s) => s.tiktokCDN === 'custom'
        },
        { key: 'tiktokTimeoutSeconds', label: 'HTTP Timeout', type: 'number', min: 1, max: 120, step: 1, unit: 's' },
        { key: 'tiktokMaxRetries', label: 'Reconnect Attempts', type: 'number', min: 0, max: 100, step: 1 },
        { key: 'tiktokStaleTimeoutSeconds', label: 'Stale Connection Timeout', type: 'number', min: 10, max: 300, step: 1, unit: 's' },
        { key: 'tiktokCompress', label: 'Compressed WebSocket Messages', type: 'toggle' },
        { key: 'tiktokLanguage', label: 'Language Override (for example: es)', type: 'text' },
        { key: 'tiktokRegion', label: 'Region Override (for example: MX)', type: 'text' },
        { key: 'tiktokUserAgent', label: 'User-Agent Override', type: 'textarea' },
        { key: 'tiktokProxy', label: 'HTTP CONNECT Proxy URL', type: 'text' },
        { key: 'tiktokSessionCookies', label: 'Session Cookies (memory only)', type: 'password' },
    ]
};

export const SETTINGS_SCHEMA: SettingsSection[] = [
    {
        id: 'overlay',
        title: 'Overlay Mode',
        items: [
            {
                key: 'settingsStatusMessage',
                label: 'Settings Status',
                type: 'text',
                readOnly: true,
                showIf: (s) => !!s.settingsStatusMessage
            },
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
        id: 'tiktok-content',
        title: 'TikTok LIVE',
        items: [
            { key: 'tiktokShowChat', label: 'Show Chat Messages', type: 'toggle' },
            { key: 'tiktokShowEmotes', label: 'Show Emote Messages', type: 'toggle' },
            { key: 'tiktokShowGifts', label: 'Show Gifts', type: 'toggle' },
            { key: 'tiktokShowSubscriptions', label: 'Show Subscriptions', type: 'toggle' },
            { key: 'tiktokShowFollows', label: 'Show Follows', type: 'toggle' },
            { key: 'tiktokShowShares', label: 'Show Shares', type: 'toggle' },
            { key: 'tiktokShowJoins', label: 'Show Joins', type: 'toggle' },
            { key: 'tiktokShowQuestions', label: 'Show Questions', type: 'toggle' },
            { key: 'tiktokShowMetrics', label: 'Show Like and Viewer Updates', type: 'toggle' },
        ]
    },
    {
        id: 'tiktok-events',
        title: 'TikTok Event Categories',
        items: [
            { key: 'tiktokShowActivityEvents', label: 'Show Member and Social Events', type: 'toggle' },
            { key: 'tiktokShowContent', label: 'Show Captions and Content', type: 'toggle' },
            { key: 'tiktokShowGoals', label: 'Show Goals', type: 'toggle' },
            { key: 'tiktokShowInteraction', label: 'Show Polls, Pins and Interaction', type: 'toggle' },
            { key: 'tiktokShowRankings', label: 'Show Rankings', type: 'toggle' },
            { key: 'tiktokShowLinkMic', label: 'Show Link Mic and Battles', type: 'toggle' },
            { key: 'tiktokShowSystem', label: 'Show System Events', type: 'toggle' },
            { key: 'tiktokShowCommerce', label: 'Show Shopping Events', type: 'toggle' },
            { key: 'tiktokShowGames', label: 'Show Game Events', type: 'toggle' },
            { key: 'tiktokShowPartnerships', label: 'Show Partnership Events', type: 'toggle' },
            { key: 'tiktokShowModeration', label: 'Show Moderation Events', type: 'toggle' },
            { key: 'tiktokShowProfileEvents', label: 'Show Room and Profile Events', type: 'toggle' },
            { key: 'tiktokShowDiagnosticEvents', label: 'Show Diagnostic Events', type: 'toggle' },
            { key: 'tiktokShowUnknown', label: 'Show Unknown Events', type: 'toggle' },
        ]
    },
    {
        id: 'tiktok-flow',
        title: 'TikTok Flow and Filters',
        items: [
            {
                key: 'tiktokJoinRateLimit',
                label: 'Maximum Joins per Minute',
                type: 'range',
                min: 1,
                max: 120,
                step: 1,
                formatDisplay: (v) => `${v}`
            },
            {
                key: 'tiktokMetricIntervalSeconds',
                label: 'Metrics Update Interval',
                type: 'range',
                min: 1,
                max: 60,
                step: 1,
                unit: 's'
            },
            { key: 'tiktokMinGiftDiamonds', label: 'Minimum Gift Diamonds', type: 'number', min: 0, max: 1000000, step: 1 },
            { key: 'tiktokMinGifterLevel', label: 'Minimum Gifter Level', type: 'number', min: 0, max: 50, step: 1 },
            { key: 'tiktokOnlyFollowers', label: 'Only Followers', type: 'toggle' },
            { key: 'tiktokOnlySubscribers', label: 'Only Subscribers', type: 'toggle' },
            { key: 'tiktokOnlyModerators', label: 'Only Moderators', type: 'toggle' },
        ]
    },
    TIKTOK_CONNECTION_SECTION,
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
            { key: 'superChatBarEnabled', label: 'Show SuperChat Color Bar', type: 'toggle', showIf: (s) => s.showBubble },
            {
                key: 'superChatBarColor',
                label: 'SuperChat Bar Color',
                type: 'color',
                showIf: (s) => s.showBubble && s.superChatBarEnabled
            },
            {
                key: 'superChatBarWidth',
                label: 'SuperChat Bar Width',
                type: 'range',
                min: 1,
                max: 8,
                step: 1,
                unit: 'px',
                showIf: (s) => s.showBubble && s.superChatBarEnabled
            },
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
                type: 'password',
                showIf: (s) => s.obsEnabled
            },
            {
                key: 'obsConnected',
                label: 'Connection',
                type: 'button',
                showIf: (s) => s.obsEnabled
            },
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
        id: 'filters',
        title: 'Filters',
        items: [
            {
                key: 'blockedUsers',
                label: 'Blocked Users (comma separated)',
                type: 'textarea'
            },
            {
                key: 'blockedWords',
                label: 'Blocked Words (comma separated)',
                type: 'textarea'
            },
        ]
    },
    {
        id: 'tts',
        title: 'Text to Speech (TTS)',
        items: [
            { key: 'ttsEnabled', label: 'Enable TTS', type: 'toggle' },
            { key: 'ttsReadTikTokGifts', label: 'Read TikTok Gifts', type: 'toggle', showIf: (s) => s.ttsEnabled },
            { key: 'ttsReadTikTokActivity', label: 'Read TikTok Activity', type: 'toggle', showIf: (s) => s.ttsEnabled },
            { key: 'ttsReadTikTokAdvanced', label: 'Read Advanced TikTok Events', type: 'toggle', showIf: (s) => s.ttsEnabled },
            {
                key: 'ttsStatusMessage',
                label: 'TTS Status',
                type: 'text',
                readOnly: true,
                showIf: (s) => s.ttsEnabled && !!s.ttsStatusMessage
            },
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
                    { label: 'Supertonic 3 (Neural TTS)', value: 'supertonic3' }
                ],
                showIf: (s) => s.ttsEnabled
            },
            {
                key: 'ttsVoiceTest' as any,
                renderKey: 'supertonicStatus',
                label: 'Supertonic Status',
                type: 'supertonic-status',
                showIf: (s) => s.ttsEnabled && (s.ttsProvider === 'supertonic' || s.ttsProvider === 'supertonic3')
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
                showIf: (s) => s.ttsEnabled && (s.ttsProvider === 'browser' || s.ttsProvider === 'supertonic' || s.ttsProvider === 'supertonic3')
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
                showIf: (s) => s.ttsEnabled && (s.ttsProvider === 'supertonic' || s.ttsProvider === 'supertonic3')
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
                key: 'supertonicLang',
                renderKey: 'supertonic3Lang',
                label: 'Language',
                type: 'select',
                options: [
                    { label: 'English (en)', value: 'en' },
                    { label: 'Korean (ko)', value: 'ko' },
                    { label: 'Japanese (ja)', value: 'ja' },
                    { label: 'Arabic (ar)', value: 'ar' },
                    { label: 'Bulgarian (bg)', value: 'bg' },
                    { label: 'Czech (cs)', value: 'cs' },
                    { label: 'Danish (da)', value: 'da' },
                    { label: 'German (de)', value: 'de' },
                    { label: 'Greek (el)', value: 'el' },
                    { label: 'Spanish (es)', value: 'es' },
                    { label: 'Estonian (et)', value: 'et' },
                    { label: 'Finnish (fi)', value: 'fi' },
                    { label: 'French (fr)', value: 'fr' },
                    { label: 'Hindi (hi)', value: 'hi' },
                    { label: 'Croatian (hr)', value: 'hr' },
                    { label: 'Hungarian (hu)', value: 'hu' },
                    { label: 'Indonesian (id)', value: 'id' },
                    { label: 'Italian (it)', value: 'it' },
                    { label: 'Lithuanian (lt)', value: 'lt' },
                    { label: 'Latvian (lv)', value: 'lv' },
                    { label: 'Dutch (nl)', value: 'nl' },
                    { label: 'Polish (pl)', value: 'pl' },
                    { label: 'Portuguese (pt)', value: 'pt' },
                    { label: 'Romanian (ro)', value: 'ro' },
                    { label: 'Russian (ru)', value: 'ru' },
                    { label: 'Slovak (sk)', value: 'sk' },
                    { label: 'Slovenian (sl)', value: 'sl' },
                    { label: 'Swedish (sv)', value: 'sv' },
                    { label: 'Turkish (tr)', value: 'tr' },
                    { label: 'Ukrainian (uk)', value: 'uk' },
                    { label: 'Vietnamese (vi)', value: 'vi' }
                ],
                showIf: (s) => s.ttsEnabled && s.ttsProvider === 'supertonic3'
            },
            {
                key: 'supertonicTotalStep',
                label: 'Quality Steps (higher = better)',
                type: 'range',
                min: 1,
                max: 20,
                step: 1,
                showIf: (s) => s.ttsEnabled && (s.ttsProvider === 'supertonic' || s.ttsProvider === 'supertonic3')
            },
            {
                key: 'supertonicSpeed',
                label: 'Speed',
                type: 'range',
                min: 0.5,
                max: 2.0,
                step: 0.05,
                formatDisplay: (v) => `${v.toFixed(2)}x`,
                showIf: (s) => s.ttsEnabled && (s.ttsProvider === 'supertonic' || s.ttsProvider === 'supertonic3')
            }
        ]
    }
];
