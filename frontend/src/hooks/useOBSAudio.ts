import { useState, useEffect, useRef } from 'react';
import { GetOBSAudioInputs, SetOBSInputMute, SetOBSInputVolume } from '../../wailsjs/go/main/App';

export interface AudioInput {
    name: string;
    muted: boolean;
    volume: number; // dB
}

export interface AudioInputs {
    microphone?: AudioInput;
    desktop?: AudioInput;
}

export const useOBSAudio = (connected: boolean) => {
    const [audioInputs, setAudioInputs] = useState<AudioInputs>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const isDraggingRef = useRef<{ [key: string]: boolean }>({});

    // Fetch audio inputs when connected
    useEffect(() => {
        if (!connected) {
            setAudioInputs({});
            setError('');
            return;
        }

        const fetchAudioInputs = async () => {
            try {
                const inputs = await GetOBSAudioInputs();
                setError('');
                // Only update if not currently dragging
                setAudioInputs(prev => {
                    const updated = { ...inputs };
                    // Preserve local state for inputs being dragged
                    if (isDraggingRef.current['microphone'] && prev.microphone) {
                        updated.microphone = prev.microphone;
                    }
                    if (isDraggingRef.current['desktop'] && prev.desktop) {
                        updated.desktop = prev.desktop;
                    }
                    return updated;
                });
            } catch (err) {
                console.error('Failed to get audio inputs:', err);
                setError(`Failed to get OBS audio inputs: ${err}`);
            }
        };

        fetchAudioInputs();

        // Poll every 2 seconds to keep state updated
        const interval = setInterval(fetchAudioInputs, 2000);
        return () => clearInterval(interval);
    }, [connected]);

    const toggleMute = async (inputName: string, currentMuted: boolean) => {
        setLoading(true);
        try {
            await SetOBSInputMute(inputName, !currentMuted);
            setError('');
            // Immediately update local state for responsiveness
            setAudioInputs(prev => {
                const key = inputName === prev.microphone?.name ? 'microphone' : 'desktop';
                if (!prev[key]) return prev;
                return {
                    ...prev,
                    [key]: { ...prev[key]!, muted: !currentMuted }
                };
            });
        } catch (err) {
            console.error('Failed to toggle mute:', err);
            setError(`Failed to toggle OBS audio mute: ${err}`);
        } finally {
            setLoading(false);
        }
    };

    const setVolume = async (inputName: string, volumeDb: number) => {
        try {
            await SetOBSInputVolume(inputName, volumeDb);
            setError('');
        } catch (err) {
            console.error('Failed to set volume:', err);
            setError(`Failed to set OBS audio volume: ${err}`);
        }
    };

    const setVolumeLocal = (inputName: string, volumeDb: number) => {
        // Update local state immediately for UI responsiveness
        setAudioInputs(prev => {
            const key = inputName === prev.microphone?.name ? 'microphone' : 'desktop';
            if (!prev[key]) return prev;
            return {
                ...prev,
                [key]: { ...prev[key]!, volume: volumeDb }
            };
        });

        // Send to OBS immediately (no debounce for smooth control)
        setVolume(inputName, volumeDb);
    };

    const startDragging = (key: string) => {
        isDraggingRef.current[key] = true;
    };

    const stopDragging = (key: string) => {
        isDraggingRef.current[key] = false;
    };

    return { audioInputs, toggleMute, setVolumeLocal, startDragging, stopDragging, loading, error };
};
