import React from 'react';
import { useSettings } from '../context/SettingsContext';
import { ChatItem } from '../types';
import { PlatformId } from '../platforms';
import { PlatformIcon } from './PlatformIcon';

// Generates a deterministic hue from a username so each user gets a consistent color
const nameToHue = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return Math.abs(hash) % 360;
};

interface AvatarProps {
    url: string;
    name: string;
    platform?: PlatformId;
    showPlatformBadge: boolean;
}

const Avatar: React.FC<AvatarProps> = ({ url, name, platform, showPlatformBadge }) => {
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
                    <PlatformIcon platform={platform} />
                </div>
            )}
        </div>
    );
};

interface PreviewAreaProps {
    messages: ChatItem[];
    scrollRef: React.RefObject<HTMLDivElement>;
}

export const PreviewArea: React.FC<PreviewAreaProps> = ({ messages, scrollRef }) => {
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
                {messages.map((msg, index) => {
                    const authorName = msg.Author?.Name || 'Unknown';
                    const thumbnail = msg.Author?.Thumbnail || { URL: '', Alt: authorName };
                    const messageParts = Array.isArray(msg.Message) ? msg.Message : [];
                    const isSuperChat = !!msg.SuperChat;
                    const isMembershipEvent = msg.IsMembership && messageParts.length === 0;
                    const isTwitch = msg.Platform === 'twitch';
                    const isKick = msg.Platform === 'kick';

                    // YouTube sends SuperChat color as AARRGGBB hex (no #), strip alpha and add #
                    const superChatColor = msg.SuperChat?.Color
                        ? `#${msg.SuperChat.Color.replace('#', '').slice(-6)}`
                        : null;

                    let bgColor = settings.showBubble ? `rgba(0,0,0,${settings.messageOpacity})` : 'transparent';
                    if (isMembershipEvent) {
                        bgColor = '#0f9d58';
                    } else if (isTwitch && settings.twitchBubbleAccent && settings.showBubble) {
                        bgColor = `rgba(97, 25, 210, ${settings.messageOpacity})`;
                    } else if (isKick && settings.kickBubbleAccent && settings.showBubble) {
                        bgColor = `rgba(30, 90, 10, ${settings.messageOpacity})`;
                    }

                    const defaultBorderStyle = settings.showBubble ? '1px solid rgba(255, 255, 255, 0.1)' : 'none';
                    const superChatBarStyle = isSuperChat && settings.showBubble && settings.superChatBarEnabled
                        ? `${settings.superChatBarWidth}px solid ${settings.superChatBarColor}`
                        : null;

                    return (
                        <div
                            key={msg.ID ? `${msg.Platform || 'chat'}-${msg.ID}` : `${msg.Platform || 'chat'}-${index}`}
                            className={`chat-item ${isSuperChat ? 'superchat' : ''} ${isMembershipEvent ? 'membership' : ''}`}
                            style={{
                                backgroundColor: bgColor,
                                borderRadius: `${settings.borderRadius}px`,
                                border: defaultBorderStyle,
                                ...(superChatBarStyle ? { borderBottom: superChatBarStyle } : {}),
                                padding: settings.showBubble ? '12px 18px' : '4px 0',
                                boxShadow: settings.showBubble ? '0 8px 32px rgba(0, 0, 0, 0.3)' : 'none',
                                animation: settings.animation ? `${settings.animation} ${settings.animationDuration}s cubic-bezier(0.16, 1, 0.3, 1) both` : 'none',
                                color: (isSuperChat || isMembershipEvent) ? '#ffffff' : 'inherit'
                            }}
                        >
                            {settings.showAvatars && (
                                <Avatar
                                    url={thumbnail.URL}
                                    name={authorName}
                                    platform={msg.Platform}
                                    showPlatformBadge={settings.showPlatformBadge}
                                />
                            )}
                            <div className="chat-content">
                                <div className="author-row">
                                    {settings.showPlatformBadge && !settings.showAvatars && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: '4px' }}>
                                            <PlatformIcon platform={msg.Platform} />
                                        </span>
                                    )}
                                    <span className={`author-name ${msg.IsOwner ? 'owner' : ''} ${msg.IsModerator ? 'mod' : ''}`}>
                                        {authorName}
                                    </span>
                                    {settings.showBadges && (
                                        <>
                                            {msg.IsOwner && <span className="badge owner-badge">OWNER</span>}
                                            {msg.IsModerator && <span className="badge mod-badge">MOD</span>}
                                            {msg.IsMembership && !isMembershipEvent && (
                                                <span className={`badge ${isTwitch ? 'twitch-sub-badge' : isKick ? 'kick-sub-badge' : 'member-badge'}`}>
                                                    {isTwitch ? 'SUB' : isKick ? 'SUB' : 'MEMBER'}
                                                </span>
                                            )}
                                            {isSuperChat && msg.SuperChat?.Amount && (
                                                <span className="badge superchat-badge">{msg.SuperChat.Amount}</span>
                                            )}
                                            {msg.Author?.Badge?.Thumbnail?.URL && (
                                                <span className="badge custom-badge" title={msg.Author.Badge.Label}>
                                                    <img src={msg.Author.Badge.Thumbnail.URL} alt="" style={{ width: '1em', height: '1em', verticalAlign: 'middle' }} />
                                                </span>
                                            )}
                                        </>
                                    )}
                                    {settings.showTimestamp && (
                                        <span className="timestamp" style={{ marginLeft: '8px', opacity: 0.6, fontSize: '0.85em' }}>
                                            {msg.Timestamp ? new Date(msg.Timestamp).toLocaleTimeString() : ''}
                                        </span>
                                    )}
                                </div>

                                <div
                                    className="message-text"
                                    style={{
                                        WebkitTextStroke: `${settings.textStroke}px ${settings.textStrokeColor}`,
                                        textShadow: settings.textShadow ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none',
                                        fontWeight: settings.fontWeight,
                                        lineHeight: settings.lineHeight
                                    }}
                                >
                                    {messageParts.map((part, i) => (
                                        part.EmojiItem ? (
                                            <img key={i} src={part.EmojiItem.URL} alt={part.EmojiItem.EmojiText} className="emoji" />
                                        ) : (
                                            <span key={i}>{part.Text}</span>
                                        )
                                    ))}

                                    {isMembershipEvent && (
                                        <div className="membership-flair">
                                            <em>{msg.Author?.Badge?.Label || (isTwitch ? 'New Subscriber!' : 'Membership Update')}</em>
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
        </main>
    );
};
