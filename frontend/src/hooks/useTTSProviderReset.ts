import { useEffect, useRef } from 'react';
import { useSettings } from '../context/SettingsContext';

const SUPERTONIC_2_LANGS = ['en', 'ko', 'es', 'pt', 'fr'];

/** Clears provider-specific TTS settings when the provider changes. */
export function useTTSProviderReset() {
    const { settings, updateSettings } = useSettings();
    const previous = useRef(settings.ttsProvider);

    useEffect(() => {
        if (previous.current === settings.ttsProvider) return;
        previous.current = settings.ttsProvider;

        const next: { ttsVoice: string; supertonicLang?: string } = { ttsVoice: '' };
        if (settings.ttsProvider === 'supertonic' && !SUPERTONIC_2_LANGS.includes(settings.supertonicLang)) {
            next.supertonicLang = 'en';
        }
        updateSettings(next);
    }, [settings.ttsProvider, settings.supertonicLang, updateSettings]);
}
