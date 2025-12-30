import { ChatSettings } from '../types';

export type SettingType = 'toggle' | 'range' | 'color';

export interface SettingConfig {
    key: keyof ChatSettings;
    label: string;
    type: SettingType;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    // Función opcional para formatear el valor mostrado (ej: 0.5 -> 50%)
    formatDisplay?: (value: any) => string;
    // Función opcional para decidir si este control se muestra
    showIf?: (settings: ChatSettings) => boolean;
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
            {
                key: 'chromaColor',
                label: 'Chroma Color',
                type: 'color',
                showIf: (s) => s.chromaMode
            },
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
        ]
    },
    {
        id: 'message-design',
        title: 'Message Design',
        items: [
            {
                key: 'messageOpacity',
                label: 'Bubble Opacity',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.1,
                formatDisplay: (v) => `${Math.round(v * 100)}%`
            },
            { key: 'borderRadius', label: 'Corner Radius', type: 'range', min: 0, max: 30, unit: 'px' },
            { key: 'messageGap', label: 'Vertical Gap', type: 'range', min: 0, max: 30, unit: 'px' },
            { key: 'textShadow', label: 'Drop Shadow', type: 'toggle' },
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
    }
];
