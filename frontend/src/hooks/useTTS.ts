import { useEffect, useRef, useCallback } from 'react';
import { EventsOn } from "../../wailsjs/runtime";
import { useSettings } from '../context/SettingsContext';
import { sanitizeIncoming } from '../utils/messages';
import { speechTextFor } from '../utils/tts';
import { useSupertonic } from './supertonic2/useSupertonic';

export const useTTS = (isStarted: boolean) => {
    const { settings, updateSettings } = useSettings();
    const queueRef = useRef<string[]>([]);
    const isSpeakingRef = useRef(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const ttsStartTimeRef = useRef<number | null>(null);
    const generationIdRef = useRef(0);
    const processedMessagesRef = useRef<Set<string>>(new Set());
    const isSupertonicProvider = settings.ttsProvider === 'supertonic' || settings.ttsProvider === 'supertonic3';
    const maxQueueSize = 20;
    const lastStatusRef = useRef('');

    // Initialize Supertonic hook
    const { state: supertonicState, generateSpeech } = useSupertonic();

    const reportTtsStatus = useCallback((message: string) => {
        if (lastStatusRef.current === message) return;
        lastStatusRef.current = message;
        updateSettings({ ttsStatusMessage: message });
    }, [updateSettings]);

    const clearTtsStatus = useCallback(() => {
        if (!lastStatusRef.current) return;
        lastStatusRef.current = '';
        updateSettings({ ttsStatusMessage: '' });
    }, [updateSettings]);

    const processQueue = useCallback(() => {
        if (isSpeakingRef.current || queueRef.current.length === 0) return;

        const text = queueRef.current.shift();
        if (!text) return;

        isSpeakingRef.current = true;

        // Check if using Supertonic provider
        if (isSupertonicProvider) {
            if (!supertonicState.isReady) {
                reportTtsStatus('TTS skipped: Supertonic is still loading.');
                isSpeakingRef.current = false;
                return;
            }

            // Select random voice if enabled
            let voiceStyle = settings.supertonicVoiceStyle;
            if (settings.ttsRandomVoice) {
                const voiceOptions = ['M1.json', 'M2.json', 'M3.json', 'M4.json', 'M5.json', 'F1.json', 'F2.json', 'F3.json', 'F4.json', 'F5.json'];
                voiceStyle = voiceOptions[Math.floor(Math.random() * voiceOptions.length)];
            }

            const currentGenId = ++generationIdRef.current;
            generateSpeech({
                text,
                lang: settings.supertonicLang,
                voiceStyle: voiceStyle,
                totalStep: settings.supertonicTotalStep,
                speed: settings.supertonicSpeed
            }).then((result) => {
                if (currentGenId !== generationIdRef.current) {
                    URL.revokeObjectURL(result.audioUrl);
                    return;
                }
                // Play the generated audio
                const audio = new Audio(result.audioUrl);
                audio.preload = 'auto';
                audioRef.current = audio;
                audio.onended = () => {
                    URL.revokeObjectURL(result.audioUrl);
                    if (audioRef.current === audio) {
                        audioRef.current = null;
                        isSpeakingRef.current = false;
                        processQueue();
                    }
                };
                audio.onerror = (e) => {
                    console.error("TTS Audio Playback Error:", e);
                    reportTtsStatus('TTS playback failed.');
                    URL.revokeObjectURL(result.audioUrl);
                    if (audioRef.current === audio) {
                        audioRef.current = null;
                        isSpeakingRef.current = false;
                        processQueue();
                    }
                };
                audio.load();
                audio.play().catch(err => {
                    console.error("TTS Audio Play Error:", err);
                    reportTtsStatus('TTS playback was blocked or failed.');
                    URL.revokeObjectURL(result.audioUrl);
                    if (audioRef.current === audio) {
                        audioRef.current = null;
                        isSpeakingRef.current = false;
                        processQueue();
                    }
                });
            }).catch((error) => {
                console.error("Supertonic TTS Error:", error);
                reportTtsStatus(`Supertonic TTS failed: ${error instanceof Error ? error.message : String(error)}`);
                isSpeakingRef.current = false;
                processQueue();
            });

            return;
        }

        // Use browser TTS
        if (!window.speechSynthesis) {
            reportTtsStatus('Browser TTS is not supported in this webview.');
            isSpeakingRef.current = false;
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);

        const voices = window.speechSynthesis.getVoices();

        if (settings.ttsRandomVoice && voices.length > 0) {
            // Select random voice
            const randomVoice = voices[Math.floor(Math.random() * voices.length)];
            utterance.voice = randomVoice;
        } else if (settings.ttsVoice) {
            // Use selected voice
            const selectedVoice = voices.find(v => v.name === settings.ttsVoice);
            if (selectedVoice) utterance.voice = selectedVoice;
        }

        currentUtteranceRef.current = utterance;

        utterance.onend = () => {
            isSpeakingRef.current = false;
            currentUtteranceRef.current = null;
            processQueue();
        };

        utterance.onerror = (e) => {
            console.error("TTS Error:", e);
            reportTtsStatus('Browser TTS failed.');
            isSpeakingRef.current = false;
            currentUtteranceRef.current = null;
            processQueue();
        }

        window.speechSynthesis.speak(utterance);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings.ttsVoice, settings.ttsProvider, settings.supertonicLang, settings.supertonicVoiceStyle, settings.supertonicTotalStep, settings.supertonicSpeed, isSupertonicProvider, supertonicState.isReady, generateSpeech, reportTtsStatus]);

    const addToQueue = useCallback((text: string) => {
        if (queueRef.current.length >= maxQueueSize) {
            queueRef.current.shift();
        }
        queueRef.current.push(text);
        processQueue();
    }, [processQueue]);

    // Process queue when Supertonic becomes ready
    useEffect(() => {
        if (isSupertonicProvider && supertonicState.isReady) {
            processQueue();
        }
    }, [supertonicState.isReady, isSupertonicProvider, processQueue]);

    const stopTTS = useCallback(() => {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = "";
            audioRef.current = null;
        }
        queueRef.current = [];
        isSpeakingRef.current = false;
        currentUtteranceRef.current = null;
        generationIdRef.current++;
        processedMessagesRef.current.clear();
        clearTtsStatus();
    }, [clearTtsStatus]);

    useEffect(() => {
        if (!isStarted) {
            stopTTS();
            ttsStartTimeRef.current = null;
        } else if (settings.ttsEnabled && ttsStartTimeRef.current === null) {
            // Mark the time when TTS is enabled and started
            ttsStartTimeRef.current = Date.now();
        }
    }, [isStarted, settings.ttsEnabled, stopTTS]);

    // The listener subscribes once and reads the latest values from a ref, so
    // moving a slider in the settings never re-registers it.
    const latest = useRef({ settings, isStarted, supertonicReady: supertonicState.isReady, isSupertonicProvider, addToQueue, reportTtsStatus });
    latest.current = { settings, isStarted, supertonicReady: supertonicState.isReady, isSupertonicProvider, addToQueue, reportTtsStatus };

    useEffect(() => {
        const handleMessage = (raw: unknown) => {
            const { settings, isStarted, supertonicReady, isSupertonicProvider, addToQueue, reportTtsStatus } = latest.current;
            if (!isStarted || !settings.ttsEnabled) return;

            const message = sanitizeIncoming(raw);
            if (!message) return;

            if (message.ID) {
                const messageKey = `${message.Platform || 'chat'}:${message.ID}`;
                if (processedMessagesRef.current.has(messageKey)) return;
                processedMessagesRef.current.add(messageKey);

                if (processedMessagesRef.current.size > 200) {
                    const arr = Array.from(processedMessagesRef.current);
                    processedMessagesRef.current = new Set(arr.slice(arr.length - 100));
                }
            }

            const text = speechTextFor(message, settings);
            if (text === null) return;

            // Ignore messages that arrived before TTS was enabled
            if (ttsStartTimeRef.current === null) {
                ttsStartTimeRef.current = Date.now();
                return;
            }
            if (new Date(message.Timestamp).getTime() < ttsStartTimeRef.current) return;

            // Check provider-specific readiness
            if (settings.ttsProvider === 'browser' && !window.speechSynthesis) {
                reportTtsStatus('Browser TTS is not supported in this webview.');
                return;
            }
            if (isSupertonicProvider && !supertonicReady) {
                reportTtsStatus('TTS skipped: Supertonic is still loading.');
                return;
            }

            addToQueue(text);
        };

        try {
            return EventsOn('chat_message', handleMessage);
        } catch (err) {
            console.error('Failed to subscribe to chat events for TTS', err);
            latest.current.reportTtsStatus('TTS failed to subscribe to chat events.');
        }
    }, []);
};
