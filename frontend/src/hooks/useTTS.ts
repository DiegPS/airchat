import { useEffect, useRef, useCallback } from 'react';
import { EventsOn } from "../../wailsjs/runtime";
import { useSettings } from '../context/SettingsContext';
import { ChatItem } from '../types';

export const useTTS = (isStarted: boolean) => {
    const { settings } = useSettings();
    const queueRef = useRef<string[]>([]);
    const isSpeakingRef = useRef(false);
    const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    const processQueue = useCallback(() => {
        if (isSpeakingRef.current || queueRef.current.length === 0) return;

        const text = queueRef.current.shift();
        if (!text) return;

        isSpeakingRef.current = true;

        if (!window.speechSynthesis) {
            console.warn("TTS: Browser does not support speechSynthesis");
            isSpeakingRef.current = false;
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        
        if (settings.ttsVoice) {
            const voices = window.speechSynthesis.getVoices();
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
    }, [settings.ttsVoice]);

    const addToQueue = useCallback((text: string) => {
         queueRef.current.push(text);
         processQueue();
    }, [processQueue]);

    const cleanText = (text: string) => {
        // Remove URLs
        return text.replace(/(?:https?|ftp):\/\/[\n\S]+/g, 'link');
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
        }
    }, [isStarted, stopTTS]);

    useEffect(() => {
        const handleMessage = (message: ChatItem) => {
            if (!isStarted) return;
            if (!settings.ttsEnabled || settings.ttsProvider !== 'browser') return;
            
            // Basic heuristic to skip system messages or commands if any
            if (message.Message.length === 0) return;

            const author = message.Author.Name;
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

            // Simple template
            const textToSpeak = `${author} says: ${cleanContent}`;
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
    }, [settings.ttsEnabled, settings.ttsProvider, settings.ttsCommandMode, settings.ttsCommandPrefix, addToQueue, isStarted, stopTTS]);
};
