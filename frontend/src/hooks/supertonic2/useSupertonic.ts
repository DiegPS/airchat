import { useState, useEffect, useRef, useCallback } from 'react';
import {
    loadTextToSpeech,
    loadVoiceStyle,
    writeWavFile,
    TextToSpeech,
    Style,
    AVAILABLE_LANGS
} from './helper';

// Configuration - Use 'hf' to download from Hugging Face, or 'assets/onnx' to use local files
const USE_HUGGING_FACE = true;
const DEFAULT_VOICE_STYLE_PATH = USE_HUGGING_FACE ? 'M1.json' : 'assets/voice_styles/M1.json';

export interface SupertonicState {
    isLoading: boolean;
    isReady: boolean;
    error: string | null;
    loadingStatus: string;
    backendType: 'webgpu' | 'wasm' | null;
    currentVoiceStyle: string;
}

export interface SupertonicGenerateOptions {
    text: string;
    lang: string;
    voiceStyle?: string;
    totalStep?: number;
    speed?: number;
    onProgress?: (step: number, total: number) => void;
}

export interface SupertonicGenerateResult {
    audioBlob: Blob;
    audioUrl: string;
    duration: number;
}

export const useSupertonic = () => {
    const [state, setState] = useState<SupertonicState>({
        isLoading: true,
        isReady: false,
        error: null,
        loadingStatus: 'Initializing...',
        backendType: null,
        currentVoiceStyle: DEFAULT_VOICE_STYLE_PATH
    });

    // Refs to hold the TTS engine and configuration
    const textToSpeechRef = useRef<TextToSpeech | null>(null);
    const cfgsRef = useRef<any>(null);
    const currentStyleRef = useRef<Style | null>(null);
    const currentStylePathRef = useRef<string>(DEFAULT_VOICE_STYLE_PATH);

    // Initialize models on mount
    useEffect(() => {
        const initializeModels = async () => {
            try {
                setState(prev => ({ ...prev, loadingStatus: 'Loading configuration...' }));
                
                const basePath = USE_HUGGING_FACE ? 'hf' : 'assets/onnx';
                
                // Try WebGPU first, fallback to WASM
                let executionProvider: 'webgpu' | 'wasm' = 'wasm';
                try {
                    const result = await loadTextToSpeech(basePath, {
                        executionProviders: ['webgpu'],
                        graphOptimizationLevel: 'all'
                    }, (modelName, current, total) => {
                        setState(prev => ({
                            ...prev,
                            loadingStatus: `Loading ONNX models (${current}/${total}): ${modelName}...`
                        }));
                    });
                    
                    textToSpeechRef.current = result.textToSpeech;
                    cfgsRef.current = result.cfgs;
                    executionProvider = 'webgpu';
                    
                } catch (webgpuError) {
                    console.log('WebGPU not available, falling back to WebAssembly');
                    
                    const result = await loadTextToSpeech(basePath, {
                        executionProviders: ['wasm'],
                        graphOptimizationLevel: 'all'
                    }, (modelName, current, total) => {
                        setState(prev => ({
                            ...prev,
                            loadingStatus: `Loading ONNX models (${current}/${total}): ${modelName}...`
                        }));
                    });
                    
                    textToSpeechRef.current = result.textToSpeech;
                    cfgsRef.current = result.cfgs;
                }
                
                setState(prev => ({ ...prev, loadingStatus: 'Loading default voice style...' }));
                
                // Load default voice style
                currentStyleRef.current = await loadVoiceStyle([DEFAULT_VOICE_STYLE_PATH], true);
                currentStylePathRef.current = DEFAULT_VOICE_STYLE_PATH;
                
                setState({
                    isLoading: false,
                    isReady: true,
                    error: null,
                    loadingStatus: `Models loaded! Using ${executionProvider.toUpperCase()}`,
                    backendType: executionProvider,
                    currentVoiceStyle: DEFAULT_VOICE_STYLE_PATH
                });
                
            } catch (error) {
                console.error('Error loading Supertonic models:', error);
                setState({
                    isLoading: false,
                    isReady: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    loadingStatus: 'Failed to load models',
                    backendType: null,
                    currentVoiceStyle: DEFAULT_VOICE_STYLE_PATH
                });
            }
        };

        initializeModels();
    }, []);

    // Load a specific voice style
    const loadVoiceStyleById = useCallback(async (voiceStylePath: string): Promise<void> => {
        if (!state.isReady) {
            throw new Error('Supertonic is not ready yet');
        }

        try {
            setState(prev => ({ ...prev, loadingStatus: `Loading voice style: ${voiceStylePath}...` }));
            
            currentStyleRef.current = await loadVoiceStyle([voiceStylePath], true);
            currentStylePathRef.current = voiceStylePath;
            
            setState(prev => ({
                ...prev,
                currentVoiceStyle: voiceStylePath,
                loadingStatus: `Voice style loaded: ${voiceStylePath}`
            }));
            
        } catch (error) {
            console.error('Error loading voice style:', error);
            // Restore default on error
            try {
                currentStyleRef.current = await loadVoiceStyle([DEFAULT_VOICE_STYLE_PATH], true);
                currentStylePathRef.current = DEFAULT_VOICE_STYLE_PATH;
                setState(prev => ({
                    ...prev,
                    currentVoiceStyle: DEFAULT_VOICE_STYLE_PATH
                }));
            } catch (restoreError) {
                console.error('Failed to restore default voice style:', restoreError);
            }
            throw error;
        }
    }, [state.isReady]);

    // Generate speech from text
    const generateSpeech = useCallback(async (options: SupertonicGenerateOptions): Promise<SupertonicGenerateResult> => {
        const {
            text,
            lang,
            voiceStyle,
            totalStep = 5,
            speed = 1.05,
            onProgress
        } = options;

        if (!state.isReady || !textToSpeechRef.current || !cfgsRef.current) {
            throw new Error('Supertonic is not ready yet');
        }

        if (!currentStyleRef.current) {
            throw new Error('Voice style is not loaded');
        }

        if (!text.trim()) {
            throw new Error('Text cannot be empty');
        }

        if (!AVAILABLE_LANGS.includes(lang)) {
            throw new Error(`Invalid language: ${lang}. Available: ${AVAILABLE_LANGS.join(', ')}`);
        }

        // Load different voice style if requested
        if (voiceStyle && voiceStyle !== currentStylePathRef.current) {
            await loadVoiceStyleById(voiceStyle);
        }

        try {
            const { wav, duration } = await textToSpeechRef.current.call(
                text,
                lang,
                currentStyleRef.current,
                totalStep,
                speed,
                0.3,
                onProgress || null
            );

            // Create WAV file
            const wavLen = Math.floor(textToSpeechRef.current.sampleRate * duration[0]);
            const wavOut = wav.slice(0, wavLen);
            const wavBuffer = writeWavFile(wavOut, textToSpeechRef.current.sampleRate);
            const blob = new Blob([wavBuffer], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);

            return {
                audioBlob: blob,
                audioUrl: url,
                duration: duration[0]
            };

        } catch (error) {
            console.error('Error during speech synthesis:', error);
            throw error;
        }
    }, [state.isReady, loadVoiceStyleById]);

    return {
        state,
        generateSpeech,
        loadVoiceStyle: loadVoiceStyleById
    };
};
