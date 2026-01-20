import React from 'react';
import { ChatSettings } from '../types';
import { SettingConfig } from '../config/settingsSchema';

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

    return null;
};
