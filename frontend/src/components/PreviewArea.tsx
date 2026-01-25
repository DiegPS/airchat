import React from 'react';
import { useSettings } from '../context/SettingsContext';
import { ChatItem } from '../types';
import { SubscriberGoal } from './SubscriberGoal';

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

                    // Determine background color
                    let bgColor = settings.showBubble ? `rgba(0,0,0,${settings.messageOpacity})` : 'transparent';
                    if (isSuperChat && msg.SuperChat?.Color) {
                        bgColor = msg.SuperChat.Color; // Use SuperChat color
                    } else if (isMembershipEvent) {
                        bgColor = '#0f9d58'; // Default Green for Membership events if bubble
                    }

                    return (
                        <div
                            key={msg.ID}
                            className={`chat-item ${isSuperChat ? 'superchat' : ''} ${isMembershipEvent ? 'membership' : ''}`}
                            style={{
                                backgroundColor: bgColor,
                                borderRadius: `${settings.borderRadius}px`,
                                border: settings.showBubble ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                                padding: settings.showBubble ? '12px 18px' : '4px 0',
                                boxShadow: settings.showBubble ? '0 8px 32px rgba(0, 0, 0, 0.3)' : 'none',
                                animation: settings.animation ? `${settings.animation} ${settings.animationDuration}s cubic-bezier(0.16, 1, 0.3, 1) both` : 'none',
                                // Ensure text is readable on colored backgrounds
                                color: (isSuperChat || isMembershipEvent) ? '#ffffff' : 'inherit'
                            }}
                        >
                            {settings.showAvatars && (
                                <img src={msg.Author.Thumbnail.URL} alt={msg.Author.Name} className="avatar" />
                            )}
                            <div className="chat-content">
                                <div className="author-row">
                                    <span
                                        className={`author-name ${msg.IsOwner ? 'owner' : ''} ${msg.IsModerator ? 'mod' : ''}`}
                                    >
                                        {msg.Author.Name}
                                    </span>
                                    {settings.showBadges && (
                                        <>
                                            {msg.IsOwner && <span className="badge owner-badge">OWNER</span>}
                                            {msg.IsModerator && <span className="badge mod-badge">MOD</span>}
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

                                {/* SuperChat Header / Amount */}
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

                                    {/* Fallback/Content for Membership Events or SuperChat with no message */}
                                    {isMembershipEvent && (
                                        <div className="membership-flair">
                                            <em>{msg.Author.Badge?.Label || 'Membership Update'}</em>
                                        </div>
                                    )}

                                    {/* SuperChat Sticker */}
                                    {isSuperChat && msg.SuperChat?.Sticker && (
                                        <div className="superchat-sticker">
                                            <img src={msg.SuperChat.Sticker.URL} alt={msg.SuperChat.Sticker.Alt} style={{ maxWidth: '100px', borderRadius: '4px' }} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
                <div ref={scrollRef} />
            </div>
            <SubscriberGoal channelId={channelId} isPreviewMode={isPreviewMode} />
        </main>
    );
};
