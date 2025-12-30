import React from 'react';
import { useSettings } from '../context/SettingsContext';
import { ChatItem } from '../types';

interface PreviewAreaProps {
    messages: ChatItem[];
    scrollRef: React.RefObject<HTMLDivElement>;
}

export const PreviewArea: React.FC<PreviewAreaProps> = ({ messages, scrollRef }) => {
    const { settings } = useSettings();

    return (
        <main
            className={`preview-area ${settings.chromaMode ? 'chroma-active' : ''} ${!settings.showGrid ? 'no-grid' : ''}`}
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
                {messages.map((msg) => (
                    <div
                        key={msg.ID}
                        className="chat-item animate-in"
                        style={{
                            backgroundColor: `rgba(0,0,0,${settings.messageOpacity})`,
                            borderRadius: `${settings.borderRadius}px`
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
                                    </>
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
                                {msg.Message.map((part, i) => (
                                    part.EmojiItem ? (
                                        <img key={i} src={part.EmojiItem.URL} alt={part.EmojiItem.EmojiText} className="emoji" />
                                    ) : (
                                        <span key={i}>{part.Text}</span>
                                    )
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={scrollRef} />
            </div>
        </main>
    );
};
