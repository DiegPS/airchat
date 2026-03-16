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

    if (config.type === 'number') {
        return (
            <div className="setting-group animate-in">
                <label>{config.label}</label>
                <input
                    type="number"
                    value={value as number}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="setting-input"
                />
            </div>
        );
    }

    if (config.type === 'button') {
        const isConnected = value === true;
        return (
            <div className="setting-group animate-in">
                <button
                    onClick={() => onChange(!value)}
                    className={isConnected ? 'btn-obs-disconnect' : 'btn-obs-connect'}
                >
                    {isConnected ? 'Disconnect OBS' : 'Connect OBS'}
                </button>
            </div>
        );
    }

    if (config.type === 'voice-select') {
        const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

        useEffect(() => {
            const loadVoices = () => {
                const available = window.speechSynthesis.getVoices();
                setVoices(available);
            };

            loadVoices();
            if (window.speechSynthesis.onvoiceschanged !== undefined) {
                window.speechSynthesis.onvoiceschanged = loadVoices;
            }
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

const TTSTestControl: React.FC = () => {
    const { settings } = useSettings(); 
    const { state: supertonicState, generateSpeech } = useSupertonic();
    const [text, setText] = useState('Welcome to the stream!');
    const [isTesting, setIsTesting] = useState(false);

    const speak = async () => {
        if (!text.trim() || isTesting) return;
        
        setIsTesting(true);

        try {
            if (settings.ttsProvider === 'supertonic') {
                if (!supertonicState.isReady) {
                    console.warn("Supertonic is not ready yet");
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
                    setIsTesting(false);
                };
                audio.play().catch(() => setIsTesting(false));
                
            } else {
                if (!window.speechSynthesis) {
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
                utterance.onerror = () => setIsTesting(false);
                
                window.speechSynthesis.speak(utterance);
            }
        } catch (error) {
            console.error("Test TTS Error:", error);
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
        </div>
    )
}
