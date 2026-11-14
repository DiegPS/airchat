import React from 'react';
import { PlatformId } from '../platforms';

const ICONS: Record<PlatformId, { viewBox: string; fill: string; path: string }> = {
    youtube: {
        viewBox: '0 0 24 24',
        fill: '#FF0000',
        path: 'M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8A3 3 0 0 0 2.6 20c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z',
    },
    twitch: {
        viewBox: '0 0 24 24',
        fill: '#9146FF',
        path: 'M11.6 6H13v4.5h-1.4V6zm3.8 0h1.4v4.5h-1.4V6zM4 0L.5 3.5V20.5H6V24l3.5-3.5H12L23.5 9V0H4zm18 8.5L18.5 12H16l-3 3v-3H9.5v-8H22v4.5z',
    },
    kick: {
        viewBox: '0 0 512 512',
        fill: '#53FC18',
        path: 'M37 .036h164.448v113.621h54.71v-56.82h54.731V.036h164.448v170.777h-54.73v56.82h-54.711v56.8h54.71v56.82h54.73V512.03H310.89v-56.82h-54.73v-56.8h-54.711v113.62H37V.036z',
    },
};

interface PlatformIconProps {
    platform?: PlatformId;
    size?: number;
}

/** Brand icon of a chat platform. Unknown platforms fall back to YouTube. */
export const PlatformIcon: React.FC<PlatformIconProps> = ({ platform = 'youtube', size = 12 }) => {
    const icon = ICONS[platform] ?? ICONS.youtube;
    return (
        <svg width={size} height={size} viewBox={icon.viewBox} fill={icon.fill} style={{ flexShrink: 0 }} aria-hidden="true">
            <path d={icon.path} />
        </svg>
    );
};
