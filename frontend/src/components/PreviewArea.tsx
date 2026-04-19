import React from 'react';
import { useSettings } from '../context/SettingsContext';
import { ChatItem } from '../types';
import { SubscriberGoal } from './SubscriberGoal';

const YouTubeIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="#FF0000" style={{ flexShrink: 0 }}>
        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8A3 3 0 0 0 2.6 20c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z"/>
    </svg>
);

const TwitchIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="#9146FF" style={{ flexShrink: 0 }}>
        <path d="M11.6 6H13v4.5h-1.4V6zm3.8 0h1.4v4.5h-1.4V6zM4 0L.5 3.5V20.5H6V24l3.5-3.5H12L23.5 9V0H4zm18 8.5L18.5 12H16l-3 3v-3H9.5v-8H22v4.5z"/>
    </svg>
);

// Generates a deterministic hue from a username so each user gets a consistent color
const nameToHue = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return Math.abs(hash) % 360;
};

interface AvatarProps {
    url: string;
    name: string;
    isTwitch: boolean;
    showPlatformBadge: boolean;
}

const Avatar: React.FC<AvatarProps> = ({ url, name, isTwitch, showPlatformBadge }) => {
    const hue = nameToHue(name);
    const initials = name.slice(0, 2).toUpperCase();

    return (
        <div style={{ position: 'relative', flexShrink: 0 }}>
            {url ? (
                <img src={url} alt={name} className="avatar" />
            ) : (
                <div
                    className="avatar"
                    style={{
                        background: `hsl(${hue}, 60%, 40%)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.65em',
                        color: '#fff',
                        userSelect: 'none',
                    }}
                >
                    {initials}
                </div>
            )}
            {showPlatformBadge && (
                <div style={{
                    position: 'absolute',
                    bottom: '-2px',
                    right: '-2px',
                    width: '14px',
                    height: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    {isTwitch ? <TwitchIcon /> : <YouTubeIcon />}
                </div>
            )}
        </div>
    );
};

interface PreviewAreaProps {
    messages: ChatItem[];
    scrollRef: React.RefObject<HTMLDivElement>;
    channelId: string;
    isPreviewMode: boolean;
}

export const PreviewArea: React.FC<PreviewAreaProps> = ({ messages, scrollRef, channelId, isPreviewMode }) => {
    const { settings } = useSettings();

    return (
        <main
            className={`preview-area ${settings.chromaMode ? 'chroma-active' : ''} ${!settings.showGrid ? 'no-grid' : ''} ${settings.hideScrollbar ? 'no-scrollbar' : ''}`}
            style={{
                backgroundColor: settings.chromaMode ? settings.chromaColor : `rgba(0,0,0,${settings.bgOpacity})`,
                perspective: settings.threeDEnabled ? `${settings.perspective}px` : 'none'
            }}
        >
            <div
                className="chat-overlay"
                style={{
                    fontSize: `${settings.fontSize}px`,
                    gap: `${settings.messageGap}px`,
                    alignItems: settings.textAlign === 'center' ? 'center' : settings.textAlign === 'right' ? 'flex-end' : 'flex-start',
                    transform: settings.threeDEnabled ? `
                        rotateX(${settings.rotateX}deg)
                        rotateY(${settings.rotateY}deg)
                        rotateZ(${settings.rotateZ}deg)
                        skewX(${settings.skewX}deg)
                        scale(${settings.scale})
                    ` : 'none',
                    transformStyle: 'preserve-3d'
                }}
            >
                {messages.map((msg) => {
                    const isSuperChat = !!msg.SuperChat;
                    const isMembershipEvent = msg.IsMembership && (!msg.Message || msg.Message.length === 0);
                    const isTwitch = msg.Platform === 'twitch';

                    let bgColor = settings.showBubble ? `rgba(0,0,0,${settings.messageOpacity})` : 'transparent';
                    if (isSuperChat && msg.SuperChat?.Color) {
                        bgColor = msg.SuperChat.Color;
                    } else if (isMembershipEvent) {
                        bgColor = '#0f9d58';
                    } else if (isTwitch && settings.twitchBubbleAccent && settings.showBubble) {
                        // Twitch purple tint, preserving the opacity setting
                        bgColor = `rgba(97, 25, 210, ${settings.messageOpacity})`;
                    }

                    const borderStyle = isTwitch && settings.twitchBubbleAccent && settings.showBubble
                        ? '1px solid rgba(145, 70, 255, 0.35)'
                        : settings.showBubble ? '1px solid rgba(255, 255, 255, 0.1)' : 'none';

                    return (
                        <div
                            key={msg.ID}
                            className={`chat-item ${isSuperChat ? 'superchat' : ''} ${isMembershipEvent ? 'membership' : ''}`}
                            style={{
                                backgroundColor: bgColor,
                                borderRadius: `${settings.borderRadius}px`,
                                border: borderStyle,
                                padding: settings.showBubble ? '12px 18px' : '4px 0',
                                boxShadow: settings.showBubble ? '0 8px 32px rgba(0, 0, 0, 0.3)' : 'none',
                                animation: settings.animation ? `${settings.animation} ${settings.animationDuration}s cubic-bezier(0.16, 1, 0.3, 1) both` : 'none',
                                color: (isSuperChat || isMembershipEvent) ? '#ffffff' : 'inherit'
                            }}
                        >
                            {settings.showAvatars && (
                                <Avatar
                                    url={msg.Author.Thumbnail.URL}
                                    name={msg.Author.Name}
                                    isTwitch={isTwitch}
                                    showPlatformBadge={settings.showPlatformBadge}
                                />
                            )}
                            <div className="chat-content">
                                <div className="author-row">
                                    {settings.showPlatformBadge && !settings.showAvatars && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: '4px' }}>
                                            {isTwitch ? <TwitchIcon /> : <YouTubeIcon />}
                                        </span>
                                    )}
                                    <span className={`author-name ${msg.IsOwner ? 'owner' : ''} ${msg.IsModerator ? 'mod' : ''}`}>
                                        {msg.Author.Name}
                                    </span>
                                    {settings.showBadges && (
                                        <>
                                            {msg.IsOwner && <span className="badge owner-badge">OWNER</span>}
                                            {msg.IsModerator && <span className="badge mod-badge">MOD</span>}
                                            {msg.IsMembership && !isMembershipEvent && (
                                                <span className="badge" style={{ background: isTwitch ? 'rgba(145,70,255,0.4)' : 'rgba(15,157,88,0.4)', color: '#fff', fontSize: '0.7em', padding: '1px 5px', borderRadius: '4px' }}>
                                                    {isTwitch ? 'SUB' : 'MEMBER'}
                                                </span>
                                            )}
                                            {msg.Author.Badge && (
                                                <span className="badge custom-badge" title={msg.Author.Badge.Label}>
                                                    <img src={msg.Author.Badge.Thumbnail.URL} alt="" style={{ width: '1em', height: '1em', verticalAlign: 'middle' }} />
                                                </span>
                                            )}
                                        </>
                                    )}
                                    {settings.showTimestamp && (
                                        <span className="timestamp" style={{ marginLeft: '8px', opacity: 0.6, fontSize: '0.85em' }}>
                                            {new Date(msg.Timestamp).toLocaleTimeString()}
                                        </span>
                                    )}
                                </div>

                                {isSuperChat && (
                                    <div className="superchat-amount" style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                                        {msg.SuperChat?.Amount}
                                    </div>
                                )}

                                <div
                                    className="message-text"
                                    style={{
                                        WebkitTextStroke: `${settings.textStroke}px ${settings.textStrokeColor}`,
                                        textShadow: settings.textShadow ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none',
                                        fontWeight: settings.fontWeight,
                                        lineHeight: settings.lineHeight
                                    }}
                                >
                                    {msg.Message?.map((part, i) => (
                                        part.EmojiItem ? (
                                            <img key={i} src={part.EmojiItem.URL} alt={part.EmojiItem.EmojiText} className="emoji" />
                                        ) : (
                                            <span key={i}>{part.Text}</span>
                                        )
                                    ))}

                                    {isMembershipEvent && (
                                        <div className="membership-flair">
                                            <em>{msg.Author.Badge?.Label || (isTwitch ? 'New Subscriber!' : 'Membership Update')}</em>
                                        </div>
                                    )}

                                    {isSuperChat && msg.SuperChat?.Sticker && (
                                        <div className="superchat-sticker">
                                            <img src={msg.SuperChat.Sticker.URL} alt={msg.SuperChat.Sticker.Alt} style={{ maxWidth: '100px', borderRadius: '4px' }} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={scrollRef} />
            </div>
            <SubscriberGoal channelId={channelId} isPreviewMode={isPreviewMode} />
        </main>
    );
};
