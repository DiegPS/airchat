import { useEffect, useRef, useCallback } from 'react';
import { EventsOn } from "../../wailsjs/runtime";
import { useSettings } from '../context/SettingsContext';
import { ChatItem } from '../types';
import { containsBlockedWord, isUserBlocked, normalizeUsernameForFilter, splitCommaList } from '../utils/filters';
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

    useEffect(() => {
        const handleMessage = (message: ChatItem) => {
            if (!isStarted) return;
            if (!settings.ttsEnabled) return;
            if (!message?.Author?.Name || !Array.isArray(message.Message)) return;

            if (message.Platform === 'tiktok') {
                if (message.TikTokUser) {
                    if (message.TikTokUser.GifterLevel < settings.tiktokMinGifterLevel) return;
                    if (settings.tiktokOnlyFollowers && !message.TikTokUser.IsFollower) return;
                    if (settings.tiktokOnlySubscribers && !message.TikTokUser.IsSubscriber) return;
                    if (settings.tiktokOnlyModerators && !message.TikTokUser.IsModerator) return;
                }
                if (message.EventKind === 'gift') {
                    if (!settings.ttsReadTikTokGifts) return;
                    if ((message.Gift?.DiamondCount ?? 0) < settings.tiktokMinGiftDiamonds) return;
                    if (message.Gift?.IsCombo && !message.Gift.IsFinal) return;
                } else if (['subscription', 'follow', 'share', 'join', 'question'].includes(message.EventKind || '')) {
                    if (!settings.ttsReadTikTokActivity) return;
                } else if (message.EventKind === 'metrics') {
                    return;
                } else if (message.EventKind === 'advanced' && !settings.ttsReadTikTokAdvanced) {
                    return;
                }
            }

            if (message.ID) {
                const messageKey = `${message.Platform || 'chat'}:${message.ID}`;
                if (processedMessagesRef.current.has(messageKey)) return;
                processedMessagesRef.current.add(messageKey);
                
                if (processedMessagesRef.current.size > 200) {
                    const arr = Array.from(processedMessagesRef.current);
                    processedMessagesRef.current = new Set(arr.slice(arr.length - 100));
                }
            }

            if (isUserBlocked(message.Author.Name, settings.blockedUsers)) return;
            if (containsBlockedWord(message.Message, settings.blockedWords)) return;

            // Check if members-only mode is active
            if (settings.ttsMembersOnly) {
                const isMember = message.IsMembership || !!message.Author.Badge || !!message.SuperChat;
                let isCustomAllowed = false;

                if (settings.ttsAllowCustomUsers && settings.ttsCustomUsersList) {
                    const allowedUsers = splitCommaList(settings.ttsCustomUsersList).map(normalizeUsernameForFilter);
                    const currentAuthor = normalizeUsernameForFilter(message.Author.Name);
                    const cleanAuthor = normalizeUsernameForFilter(cleanUsername(message.Author.Name));

                    if (allowedUsers.includes(currentAuthor) || allowedUsers.includes(cleanAuthor)) {
                        isCustomAllowed = true;
                    }
                }

                if (!isMember && !isCustomAllowed) return;
            }

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
            if (settings.ttsProvider === 'browser' && !window.speechSynthesis) {
                reportTtsStatus('Browser TTS is not supported in this webview.');
                return;
            }
            if (isSupertonicProvider && !supertonicState.isReady) {
                reportTtsStatus('TTS skipped: Supertonic is still loading.');
                return;
            }

            // Basic heuristic to skip system messages or commands if any
            if (!message.Message || message.Message.length === 0) return;

            const author = cleanUsername(message.Author.Name);
            let content = message.Message.map(m => m.Text).join(' ');
            if (message.Platform === 'tiktok' && message.EventKind === 'gift' && message.Gift) {
                content = `sent ${message.Gift.Name} times ${message.Gift.Count}, worth ${message.Gift.DiamondCount} diamonds`;
            }

            // Check for command mode
            if (settings.ttsCommandMode && settings.ttsCommandPrefix) {
                const prefix = settings.ttsCommandPrefix.trim().toLowerCase();
                if (!content.toLowerCase().startsWith(prefix)) return;
                // Remove the command prefix from the message
                content = content.substring(settings.ttsCommandPrefix.trim().length).trim();
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
            reportTtsStatus('TTS failed to subscribe to chat events.');
        }

        return () => {
            if (cancelSubscription) cancelSubscription();
        };
    }, [settings.ttsEnabled, settings.blockedUsers, settings.blockedWords, settings.ttsMembersOnly, settings.ttsAllowCustomUsers, settings.ttsCustomUsersList, settings.ttsProvider, settings.ttsCommandMode, settings.ttsCommandPrefix, settings.ttsSeparatorText, settings.ttsRandomVoice, addToQueue, isStarted, supertonicState.isReady, reportTtsStatus, isSupertonicProvider]);
};
