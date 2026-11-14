import React, { useState, useEffect } from 'react';
import { ChatSettings } from '../types';
import { SettingConfig } from '../config/settingsSchema';
import { useSettings } from '../context/SettingsContext';
import { useSupertonic } from '../hooks/supertonic2/useSupertonic';

interface SettingControlProps {
    config: SettingConfig;
    value: any;
    onChange: (value: any) => void;
}

export const SettingControl: React.FC<SettingControlProps> = ({ config, value, onChange }) => {
    // Si la configuración tiene una unidad (ej: px) o un formateador (ej: %), lo usamos para el label
    const displayValue = config.formatDisplay
        ? config.formatDisplay(value)
        : `${value}${config.unit || ''}`;

    if (config.type === 'toggle') {
        return (
            <div className="setting-toggle animate-in">
                <label>{config.label}</label>
                <input
                    type="checkbox"
                    checked={(value ?? false) as boolean}
                    onChange={(e) => onChange(e.target.checked)}
                />
            </div>
        );
    }

    if (config.type === 'color') {
        return (
            <div className="setting-group animate-in">
                <label>{config.label}</label>
                <input
                    type="color"
                    value={(value ?? '#000000') as string}
                    onChange={(e) => onChange(e.target.value)}
                />
            </div>
        );
    }

    if (config.type === 'range') {
        const safeValue = value ?? config.min ?? 0;
        return (
            <div className="setting-group animate-in">
                <label>{config.label} ({config.formatDisplay ? config.formatDisplay(safeValue) : `${safeValue}${config.unit || ''}`})</label>
                <input
                    type="range"
                    min={config.min}
                    max={config.max}
                    step={config.step}
                    value={safeValue as number}
                    onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        // Si el step es 1, queremos un entero, si no, decimal
                        onChange(config.step === 1 || !config.step ? Math.round(val) : val);
                    }}
                />
            </div>
        );
    }

    if (config.type === 'select' && config.options) {
        return (
            <div className="setting-group animate-in">
                <label>{config.label}</label>
                <select
                    value={value as string}
                    onChange={(e) => onChange(e.target.value)}
                    style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'white',
                        padding: '8px',
                        borderRadius: '8px',
                        outline: 'none',
                        cursor: 'pointer'
                    }}
                >
                    {config.options.map(opt => (
                        <option key={opt.value} value={opt.value} style={{ background: '#222' }}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </div>
        );
    }

    if (config.type === 'password') {
        const [showPassword, setShowPassword] = useState(false);
        return (
            <div className="setting-group animate-in">
                <label>{config.label}</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                        type={showPassword ? 'text' : 'password'}
                        value={value as string}
                        onChange={(e) => onChange(e.target.value)}
                        className="setting-input"
                        style={{ paddingRight: '36px', width: '100%' }}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(p => !p)}
                        style={{
                            position: 'absolute',
                            right: '8px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'rgba(255,255,255,0.5)',
                            padding: '0',
                            display: 'flex',
                            alignItems: 'center',
                        }}
                        tabIndex={-1}
                    >
                        {showPassword ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                                <line x1="1" y1="1" x2="23" y2="23"/>
                            </svg>
                        ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                        )}
                    </button>
                </div>
            </div>
        );
    }

    if (config.type === 'text') {
        return (
            <div className="setting-group animate-in">
                <label>{config.label}</label>
                <input
                    type="text"
                    value={value as string}
                    onChange={(e) => onChange(e.target.value)}
                    className="setting-input"
                    readOnly={config.readOnly}
                    disabled={config.readOnly}
                    style={config.readOnly ? { opacity: 0.7, cursor: 'default' } : undefined}
                />
            </div>
        );
    }

    if (config.type === 'textarea') {
        return (
            <div className="setting-group animate-in">
                <label>{config.label}</label>
                <textarea
                    value={value as string || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="setting-input"
                    rows={3}
                    readOnly={config.readOnly}
                    disabled={config.readOnly}
                    style={{...(config.readOnly ? { opacity: 0.7, cursor: 'default' } : {}), resize: 'vertical'}}
                />
            </div>
        );
    }

    if (config.type === 'number') {
        return (
            <div className="setting-group animate-in">
                <label>{config.label}</label>
                <input
                    type="number"
                    value={value as number}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="setting-input"
                    min={config.min}
                    max={config.max}
                    step={config.step}
                />
            </div>
        );
    }

    if (config.type === 'button') {
        return <OBSConnectButton value={value as boolean} onChange={onChange} />;
    }

    if (config.type === 'voice-select') {
        const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

        useEffect(() => {
            const loadVoices = () => {
                const available = window.speechSynthesis.getVoices();
                setVoices(available);
            };

            loadVoices();
            const synth = window.speechSynthesis;
            synth.addEventListener('voiceschanged', loadVoices);
            return () => synth.removeEventListener('voiceschanged', loadVoices);
        }, []);

        return (
            <div className="setting-group animate-in">
                <label>{config.label}</label>
                <select
                    value={value as string}
                    onChange={(e) => onChange(e.target.value)}
                    style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'white',
                        padding: '8px',
                        borderRadius: '8px',
                        outline: 'none',
                        cursor: 'pointer',
                        width: '100%'
                    }}
                >
                    <option value="" style={{ background: '#222' }}>Default Voice</option>
                    {voices.map((voice) => (
                        <option key={voice.name} value={voice.name} style={{ background: '#222' }}>
                            {voice.name} ({voice.lang})
                        </option>
                    ))}
                </select>
            </div>
        );
    }

    if (config.type === 'supertonic-status') {
        return <SupertonicStatusControl />;
    }

    if (config.type === 'tts-test') {
        const [text, setText] = useState('Hello, this is a test.');
        
        const handleTest = () => {
             if (!window.speechSynthesis) return;
             
             // Stop previous
             window.speechSynthesis.cancel();
             
             const utterance = new SpeechSynthesisUtterance(text);
             // Use the selected voice from the current value (which is likely passed differently or we can't access it easily here without context)
             // Wait, 'value' passed to this control IS the value of the config.key. 
             // But for 'tts-test' key, the value might be irrelevant or we need to access the stored 'ttsVoice'.
             // This component receives 'value' corresponding to 'config.key'.
             // We need to access the global settings or pass the voice.
             // Since we don't have direct access to 'all settings' here easily without context modification,
             // we will assume the user has selected a voice and it is stored. 
             // Actually, this specific control might need to know the selected voice.
             // Let's rely on the browser's default if not, but better: 
             // We can check if settings are available or just let the user pick in the voice selector.
             // Wait, how do I get the selected voice here? 
             // I'll make this control just trigger the speak. 
             // BUT, I need the selected voice name. 
             // The simplest way is to read the settings from context again OR 
             // assume the voice-select updated the global state and we can access it using the hook if we wrap this.
             // But SettingControl is a dumb component. 
             // However, I can import useSettings here.
        };

        return <TTSTestControl />;
    }

    return null;
};

const SupertonicStatusControl: React.FC = () => {
    const { state } = useSupertonic();
    const { settings } = useSettings();
    const isVoiceSynced = settings.supertonicVoiceStyle === state.currentVoiceStyle;

    const statusClass = state.error
        ? 'error'
        : state.isReady
            ? 'ready'
            : state.isLoading
                ? 'loading'
                : 'idle';

    const title = state.error
        ? 'Load failed'
        : state.isReady
            ? 'Ready'
            : state.isLoading
                ? 'Loading'
                : 'Idle';

    const detail = state.error || state.loadingStatus;

    return (
        <div className={`supertonic-status ${statusClass}`}>
            <div className="supertonic-status-header">
                <span className="supertonic-status-dot" />
                <span>{title}</span>
            </div>
            <div className="supertonic-status-detail">{detail}</div>
            <div className="supertonic-status-meta">
                <span>Model: {state.modelName}</span>
                <span>Backend: {state.backendType ? state.backendType.toUpperCase() : 'not selected yet'}</span>
                <span>Selected voice: {settings.supertonicVoiceStyle}</span>
                <span>Loaded voice: {state.currentVoiceStyle}{isVoiceSynced ? '' : ' (syncing)'}</span>
            </div>
        </div>
    );
};

const OBSConnectButton: React.FC<{ value: boolean; onChange: (v: boolean) => void }> = ({ value, onChange }) => {
    const { settings } = useSettings();
    const statusMsg = settings.obsStatusMessage ?? '';
    const isConnecting = statusMsg === 'Connecting...';
    const isError = statusMsg.startsWith('Error:');
    const isLostConnection = statusMsg === 'Disconnected (Lost connection)';

    return (
        <div className="setting-group animate-in">
            <button
                onClick={() => onChange(!value)}
                disabled={isConnecting}
                className={value ? 'btn-obs-disconnect' : 'btn-obs-connect'}
                style={isConnecting ? { opacity: 0.7, cursor: 'not-allowed' } : undefined}
            >
                {isConnecting ? 'Connecting...' : value ? 'Disconnect OBS' : 'Connect OBS'}
            </button>
            {isError && (
                <span style={{ fontSize: '0.75rem', color: '#ff6b6b', marginTop: '4px', display: 'block' }}>
                    {statusMsg}
                </span>
            )}
            {isLostConnection && (
                <span style={{ fontSize: '0.75rem', color: '#ffa94d', marginTop: '4px', display: 'block' }}>
                    Lost connection — click to reconnect
                </span>
            )}
        </div>
    );
};

const TTSTestControl: React.FC = () => {
    const { settings } = useSettings(); 
    const { state: supertonicState, generateSpeech } = useSupertonic();
    const [text, setText] = useState('Welcome to the stream!');
    const [isTesting, setIsTesting] = useState(false);
    const [testError, setTestError] = useState('');
    const isSupertonicProvider = settings.ttsProvider === 'supertonic' || settings.ttsProvider === 'supertonic3';

    const speak = async () => {
        if (!text.trim() || isTesting) return;
        
        setIsTesting(true);
        setTestError('');

        try {
            if (isSupertonicProvider) {
                if (!supertonicState.isReady) {
                    setTestError('Supertonic is not ready yet.');
                    setIsTesting(false);
                    return;
                }

                let voiceStyle = settings.supertonicVoiceStyle;
                if (settings.ttsRandomVoice) {
                    const voiceOptions = ['M1.json', 'M2.json', 'M3.json', 'M4.json', 'M5.json', 'F1.json', 'F2.json', 'F3.json', 'F4.json', 'F5.json'];
                    voiceStyle = voiceOptions[Math.floor(Math.random() * voiceOptions.length)];
                }

                const result = await generateSpeech({
                    text,
                    lang: settings.supertonicLang,
                    voiceStyle: voiceStyle,
                    totalStep: settings.supertonicTotalStep,
                    speed: settings.supertonicSpeed
                });

                const audio = new Audio(result.audioUrl);
                audio.onended = () => {
                    URL.revokeObjectURL(result.audioUrl);
                    setIsTesting(false);
                };
                audio.onerror = () => {
                    URL.revokeObjectURL(result.audioUrl);
                    setTestError('Test audio playback failed.');
                    setIsTesting(false);
                };
                audio.play().catch(() => {
                    URL.revokeObjectURL(result.audioUrl);
                    setTestError('Test audio playback was blocked or failed.');
                    setIsTesting(false);
                });
                
            } else {
                if (!window.speechSynthesis) {
                    setTestError('Browser TTS is not supported in this webview.');
                    setIsTesting(false);
                    return;
                }
                window.speechSynthesis.cancel();
                
                const utterance = new SpeechSynthesisUtterance(text);
                
                if (settings.ttsVoice) {
                    const voices = window.speechSynthesis.getVoices();
                    const selectedVoice = voices.find(v => v.name === settings.ttsVoice);
                    if (selectedVoice) utterance.voice = selectedVoice;
                }
                
                utterance.onend = () => setIsTesting(false);
                utterance.onerror = () => {
                    setTestError('Browser TTS test failed.');
                    setIsTesting(false);
                };
                
                window.speechSynthesis.speak(utterance);
            }
        } catch (error) {
            console.error("Test TTS Error:", error);
            setTestError(error instanceof Error ? error.message : String(error));
            setIsTesting(false);
        }
    };

    return (
        <div className="setting-group animate-in" style={{ gap: '10px' }}>
             <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                    type="text" 
                    value={text} 
                    onChange={e => setText(e.target.value)}
                    className="setting-input"
                    placeholder="Type to test..."
                    disabled={isTesting}
                />
                <button 
                    onClick={speak}
                    className="btn-primary"
                    disabled={isTesting}
                    style={{ 
                        padding: '0.5rem 1rem', 
                        whiteSpace: 'nowrap',
                        opacity: isTesting ? 0.7 : 1,
                        cursor: isTesting ? 'not-allowed' : 'pointer'
                    }}
                >
                    {isTesting ? 'Playing...' : 'Test 🔊'}
                </button>
             </div>
             {testError && (
                <span style={{ fontSize: '0.75rem', color: '#ff6b6b' }}>
                    {testError}
                </span>
             )}
        </div>
    )
}
