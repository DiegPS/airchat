import { useEffect, useRef, useCallback } from 'react';
import { EventsOn } from "../../wailsjs/runtime";
import { useSettings } from '../context/SettingsContext';
import { ChatItem } from '../types';
import { useSupertonic } from './supertonic2/useSupertonic';

export const useTTS = (isStarted: boolean) => {
    const { settings } = useSettings();
    const queueRef = useRef<string[]>([]);
    const isSpeakingRef = useRef(false);
    const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const ttsStartTimeRef = useRef<number | null>(null);

    // Initialize Supertonic hook
    const { state: supertonicState, generateSpeech } = useSupertonic();

    const processQueue = useCallback(() => {
        if (isSpeakingRef.current || queueRef.current.length === 0) return;

        const text = queueRef.current.shift();
        if (!text) return;

        isSpeakingRef.current = true;

        // Check if using Supertonic provider
        if (settings.ttsProvider === 'supertonic') {
            if (!supertonicState.isReady) {
                console.warn("TTS: Supertonic is not ready yet");
                isSpeakingRef.current = false;
                processQueue();
                return;
            }

            // Select random voice if enabled
            let voiceStyle = settings.supertonicVoiceStyle;
            if (settings.ttsRandomVoice) {
                const voiceOptions = ['M1.json', 'M2.json', 'M3.json', 'M4.json', 'M5.json', 'F1.json', 'F2.json', 'F3.json', 'F4.json', 'F5.json'];
                voiceStyle = voiceOptions[Math.floor(Math.random() * voiceOptions.length)];
            }

            generateSpeech({
                text,
                lang: settings.supertonicLang,
                voiceStyle: voiceStyle,
                totalStep: settings.supertonicTotalStep,
                speed: settings.supertonicSpeed,
                onProgress: (step, total) => {
                    console.log(`Supertonic TTS: Denoising ${step}/${total}`);
                }
            }).then((result) => {
                // Play the generated audio
                const audio = new Audio(result.audioUrl);
                audio.onended = () => {
                    URL.revokeObjectURL(result.audioUrl);
                    isSpeakingRef.current = false;
                    processQueue();
                };
                audio.onerror = (e) => {
                    console.error("TTS Audio Playback Error:", e);
                    URL.revokeObjectURL(result.audioUrl);
                    isSpeakingRef.current = false;
                    processQueue();
                };
                audio.play().catch(err => {
                    console.error("TTS Audio Play Error:", err);
                    URL.revokeObjectURL(result.audioUrl);
                    isSpeakingRef.current = false;
                    processQueue();
                });
            }).catch((error) => {
                console.error("Supertonic TTS Error:", error);
                isSpeakingRef.current = false;
                processQueue();
            });

            return;
        }

        // Use browser TTS
        if (!window.speechSynthesis) {
            console.warn("TTS: Browser does not support speechSynthesis");
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
            isSpeakingRef.current = false;
            currentUtteranceRef.current = null;
            processQueue();
        }

        window.speechSynthesis.speak(utterance);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings.ttsVoice, settings.ttsProvider, settings.supertonicLang, settings.supertonicVoiceStyle, settings.supertonicTotalStep, settings.supertonicSpeed, supertonicState.isReady, generateSpeech]);

    const addToQueue = useCallback((text: string) => {
        queueRef.current.push(text);
        processQueue();
    }, [processQueue]);

    const cleanText = (text: string) => {
        // Remove URLs
        return text.replace(/(?:https?|ftp):\/\/[\n\S]+/g, 'link');
    };

    const cleanUsername = (username: string) => {
        // Remove @ at the beginning
        let cleaned = username.startsWith('@') ? username.slice(1) : username;

        // Remove all numbers
        const withoutNumbers = cleaned.replace(/\d+/g, '');

        // If the result is empty or only whitespace, the username was all numbers
        if (!withoutNumbers.trim()) {
            return 'Only Numbers';
        }

        return withoutNumbers.trim();
    };

    const stopTTS = useCallback(() => {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        queueRef.current = [];
        isSpeakingRef.current = false;
        currentUtteranceRef.current = null;
    }, []);

    useEffect(() => {
        if (!isStarted) {
            stopTTS();
            ttsStartTimeRef.current = null;
        } else if (settings.ttsEnabled && ttsStartTimeRef.current === null) {
            // Mark the time when TTS is enabled and started
            ttsStartTimeRef.current = Date.now();
        }
    }, [isStarted, settings.ttsEnabled, stopTTS]);

    useEffect(() => {
        const handleMessage = (message: ChatItem) => {
            if (!isStarted) return;
            if (!settings.ttsEnabled) return;

            // Ignore messages that arrived before TTS was enabled
            if (ttsStartTimeRef.current === null) {
                ttsStartTimeRef.current = Date.now();
                return;
            }

            // Parse message timestamp and ignore old messages
            const messageTime = new Date(message.Timestamp).getTime();
            if (messageTime < ttsStartTimeRef.current) {
                return;
            }

            // Check provider-specific readiness
            if (settings.ttsProvider === 'supertonic' && !supertonicState.isReady) {
                console.log("TTS: Supertonic not ready yet, skipping message");
                return;
            }

            if (settings.ttsProvider === 'browser' && !window.speechSynthesis) {
                console.warn("TTS: Browser does not support speechSynthesis");
                return;
            }

            // Basic heuristic to skip system messages or commands if any
            if (!message.Message || message.Message.length === 0) return;

            const author = cleanUsername(message.Author.Name);
            let content = message.Message.map(m => m.Text).join(' ');

            // Check for command mode
            if (settings.ttsCommandMode && settings.ttsCommandPrefix) {
                const prefix = settings.ttsCommandPrefix.trim();
                if (!content.startsWith(prefix)) return;
                // Remove the command prefix from the message
                content = content.substring(prefix.length).trim();
                if (!content) return;
            }

            const cleanContent = cleanText(content);
            if (!cleanContent.trim()) return;

            // Simple template with customizable separator
            const separator = settings.ttsSeparatorText || 'says:';
            const textToSpeak = `${author} ${separator} ${cleanContent}`;
            addToQueue(textToSpeak);
        };

        let cancelSubscription: (() => void) | undefined;

        try {
            cancelSubscription = EventsOn("chat_message", handleMessage);
        } catch (err) {
            console.error("Failed to subscribe to chat events for TTS", err);
        }

        return () => {
            if (cancelSubscription) cancelSubscription();
            stopTTS();
        };
    }, [settings.ttsEnabled, settings.ttsProvider, settings.ttsCommandMode, settings.ttsCommandPrefix, settings.ttsSeparatorText, settings.ttsRandomVoice, addToQueue, isStarted, stopTTS, supertonicState.isReady]);
};
