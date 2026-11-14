import { useEffect, useRef, useState } from 'react';
import { EventsOn } from '../../wailsjs/runtime';
import { ConnectOBS, DisconnectOBS } from '../../wailsjs/go/main/App';
import { useSettings } from '../context/SettingsContext';

export interface OBSStatus {
    connected: boolean;
    outputActive: boolean;
    reconnecting: boolean;
    bitrateKbps: number;
    fps: number;
    dropPercentage: number;
    congestion: number;
    statusColor: string;
    currentScene: string;
}

/**
 * Keeps the OBS WebSocket connection in sync with the OBS settings and
 * returns the latest stream status.
 */
export function useOBSConnection() {
    const { settings, updateSettings } = useSettings();
    const [status, setStatus] = useState<OBSStatus | null>(null);
    const failedRef = useRef(false);

    useEffect(() => EventsOn('obs_status', (next: OBSStatus) => setStatus(next)), []);

    // Connect or disconnect when the requested state changes.
    useEffect(() => {
        if (settings.obsEnabled && settings.obsConnected) {
            failedRef.current = false;
            updateSettings({ obsStatusMessage: 'Connecting...' });
            ConnectOBS(settings.obsHost || 'localhost:4455', settings.obsPassword).catch((err) => {
                failedRef.current = true;
                console.error('OBS connect error:', err);
                updateSettings({ obsStatusMessage: `Error: ${err}`, obsConnected: false });
            });
            return;
        }

        setStatus(null);
        DisconnectOBS()
            .then(() => {
                if (!failedRef.current) updateSettings({ obsStatusMessage: 'Disconnected' });
            })
            .catch((err) => {
                console.error('OBS disconnect error:', err);
                updateSettings({ obsStatusMessage: `Disconnect error: ${err}` });
            });
        failedRef.current = false;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings.obsEnabled, settings.obsConnected, settings.obsHost, settings.obsPassword]);

    // Reflect what OBS reports back into the settings UI.
    useEffect(() => {
        if (status?.connected) {
            updateSettings({ obsStatusMessage: 'Connected' });
        } else if (settings.obsConnected && status && !status.connected) {
            updateSettings({ obsStatusMessage: 'Disconnected (Lost connection)', obsConnected: false });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, settings.obsConnected]);

    return status;
}
