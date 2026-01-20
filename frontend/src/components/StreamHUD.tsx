import React from 'react';
import { OBSStatus } from '../hooks/useChat';
import { useSettings } from '../context/SettingsContext';

export const StreamHUD: React.FC<{ status: OBSStatus | null }> = ({ status }) => {
    const { settings } = useSettings();
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

    return (
        <div style={{
            ...positionStyle,
            transform: `scale(${settings.obsHudScale})`,
            background: `rgba(0, 0, 0, ${settings.obsHudOpacity})`,
            backdropFilter: 'blur(10px)',
            padding: '8px 14px',
            borderRadius: '12px',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            border: `1px solid ${borderColor}`,
            fontSize: '0.8rem',
            fontFamily: 'monospace',
            color: 'white',
            pointerEvents: 'none', // Ensure clicks pass through even if overlay is active
            transition: 'all 0.3s ease',
            boxShadow: `0 4px 15px ${borderColor}40`
        }}>
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
