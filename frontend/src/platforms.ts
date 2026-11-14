// Single source of truth for the chat platforms the app supports. Adding a
// platform means adding one entry here (plus its backend connector).

export type PlatformId = 'youtube' | 'twitch' | 'kick';

export interface PlatformDef {
    id: PlatformId;
    label: string;
    /** Short description of what the input accepts. */
    hint: string;
    placeholder: string;
    /** localStorage key remembering the last value typed. */
    storageKey: string;
    /** CSS class of the "connected" pulse dot. */
    pulseClass: string;
}

export const PLATFORMS: readonly PlatformDef[] = [
    {
        id: 'youtube',
        label: 'YouTube',
        hint: 'handle, channel ID, or video URL',
        placeholder: '@xqc, UCxxxxxxxxxxxx, or youtube.com/watch?v=...',
        storageKey: 'airchat_last_youtube',
        pulseClass: 'pulse',
    },
    {
        id: 'twitch',
        label: 'Twitch',
        hint: 'channel name',
        placeholder: 'xqc',
        storageKey: 'airchat_last_twitch',
        pulseClass: 'pulse-twitch',
    },
    {
        id: 'kick',
        label: 'Kick',
        hint: 'channel name',
        placeholder: 'edmatthews',
        storageKey: 'airchat_last_kick',
        pulseClass: 'pulse-kick',
    },
];

export const isPlatformId = (value: unknown): value is PlatformId =>
    PLATFORMS.some((platform) => platform.id === value);
