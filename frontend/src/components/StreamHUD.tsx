import React, { useState } from 'react';
import { OBSStatus } from '../hooks/useChat';
import { useSettings } from '../context/SettingsContext';
import { useOBSAudio } from '../hooks/useOBSAudio';

export const StreamHUD: React.FC<{ status: OBSStatus | null }> = ({ status }) => {
    const { settings } = useSettings();
    const { audioInputs, toggleMute, setVolumeLocal, startDragging, stopDragging } = useOBSAudio(status?.connected || false);

    if (!status || !status.connected) return null;

    // Determine border color based on status
    const borderColor =
        status.statusColor === 'RED' ? '#ff4d4d' :
            status.statusColor === 'YELLOW' ? '#ffca28' :
                status.statusColor === 'GRAY' ? '#757575' :
                    '#00e676'; // GREEN

    // Determine dot animation
    const dotClass =
        status.statusColor === 'RED' ? 'blink-fast' :
            status.statusColor === 'YELLOW' ? 'pulse-slow' : 'pulse-slow';

    // Determine position styles
    const positionStyle: React.CSSProperties = {
        position: 'fixed',
        zIndex: 9999,
        top: settings.obsHudPosition.includes('top') ? '20px' : undefined,
        bottom: settings.obsHudPosition.includes('bottom') ? '20px' : undefined,
        left: settings.obsHudPosition.includes('left') ? '20px' : undefined,
        right: settings.obsHudPosition.includes('right') ? '20px' : undefined,
        transformOrigin: `${settings.obsHudPosition.includes('bottom') ? 'bottom' : 'top'} ${settings.obsHudPosition.includes('right') ? 'right' : 'left'}`
    };

    const handleVolumeChange = (inputName: string, value: number) => {
        // Convert 0-100 slider to -100dB to 0dB range
        const volumeDb = (value - 100); // 0 -> -100dB, 100 -> 0dB
        setVolumeLocal(inputName, volumeDb);
    };

    return (
        <div style={{
            ...positionStyle,
            transform: `scale(${settings.obsHudScale})`,
            background: `rgba(0, 0, 0, ${settings.obsHudOpacity})`,
            backdropFilter: 'blur(10px)',
            padding: '8px 14px',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            border: `1px solid ${borderColor}`,
            fontSize: '0.8rem',
            fontFamily: 'monospace',
            color: 'white',
            pointerEvents: 'auto', // Always allow interaction with audio controls
            transition: 'all 0.3s ease',
            boxShadow: `0 4px 15px ${borderColor}40`,
            minWidth: '200px'
        }}>
            {/* Main Status Row */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {status.outputActive ? (
                    <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div className={dotClass} style={{
                                    width: '8px', height: '8px', borderRadius: '50%',
                                    background: borderColor,
                                    boxShadow: `0 0 8px ${borderColor}`
                                }} />
                                <span style={{ fontWeight: 'bold' }}>LIVE</span>
                            </div>
                        </div>

                        {(settings.obsHudShowBitrate || settings.obsHudShowFps) && (
                            <>
                                <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.2)' }} />

                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '70px' }}>
                                    {settings.obsHudShowBitrate && (
                                        <span style={{ color: '#fff', fontWeight: 600 }}>
                                            {Math.round(status.bitrateKbps)} <span style={{ color: '#aaa', fontSize: '0.7em' }}>kbps</span>
                                        </span>
                                    )}
                                    {settings.obsHudShowFps && (
                                        <span style={{ color: '#fff', fontWeight: 600 }}>
                                            {status.fps.toFixed(0)} <span style={{ color: '#aaa', fontSize: '0.7em' }}>FPS</span>
                                        </span>
                                    )}
                                </div>
                            </>
                        )}

                        {status.dropPercentage > 0 && (
                            <>
                                <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.2)' }} />
                                <div style={{ color: '#ff4d4d', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <span>{status.dropPercentage.toFixed(1)}%</span>
                                    <span style={{ fontSize: '0.55em', textTransform: 'uppercase' }}>DROP</span>
                                </div>
                            </>
                        )}
                    </>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#888' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#888' }} />
                        <span>OFFLINE</span>
                    </div>
                )}
            </div>

            {/* Audio Controls */}
            {settings.obsHudShowMic && audioInputs.microphone && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    paddingTop: '6px',
                    pointerEvents: 'auto'
                }}>
                    <button
                        onClick={() => toggleMute(audioInputs.microphone!.name, audioInputs.microphone!.muted)}
                        style={{
                            background: audioInputs.microphone.muted ? '#ff4d4d' : '#00e676',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '0.7em',
                            fontWeight: 'bold'
                        }}
                    >
                        🎤 {audioInputs.microphone.muted ? 'MUTED' : 'ON'}
                    </button>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(audioInputs.microphone.volume + 100)}
                        onChange={(e) => handleVolumeChange(audioInputs.microphone!.name, parseInt(e.target.value))}
                        onMouseDown={() => startDragging('microphone')}
                        onMouseUp={() => stopDragging('microphone')}
                        style={{ flex: 1, cursor: 'pointer' }}
                    />
                </div>
            )}

            {settings.obsHudShowDesktop && audioInputs.desktop && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    paddingTop: '6px',
                    pointerEvents: 'auto'
                }}>
                    <button
                        onClick={() => toggleMute(audioInputs.desktop!.name, audioInputs.desktop!.muted)}
                        style={{
                            background: audioInputs.desktop.muted ? '#ff4d4d' : '#00e676',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '0.7em',
                            fontWeight: 'bold'
                        }}
                    >
                        🔊 {audioInputs.desktop.muted ? 'MUTED' : 'ON'}
                    </button>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(audioInputs.desktop.volume + 100)}
                        onChange={(e) => handleVolumeChange(audioInputs.desktop!.name, parseInt(e.target.value))}
                        onMouseDown={() => startDragging('desktop')}
                        onMouseUp={() => stopDragging('desktop')}
                        style={{ flex: 1, cursor: 'pointer' }}
                    />
                </div>
            )}

            <style>{`
                @keyframes blink-fast {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }
                @keyframes pulse-slow {
                    0% { transform: scale(0.95); opacity: 0.8; }
                    50% { transform: scale(1.1); opacity: 1; }
                    100% { transform: scale(0.95); opacity: 0.8; }
                }
                .blink-fast { animation: blink-fast 0.5s infinite; }
                .pulse-slow { animation: pulse-slow 2s infinite; }
            `}</style>
        </div>
    );
};
