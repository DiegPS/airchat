import { createContext, createElement, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
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
    hasRequestedLoad: boolean;
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

interface SupertonicResources {
    textToSpeech: TextToSpeech;
    cfgs: any;
    style: Style;
    stylePath: string;
    backendType: 'webgpu' | 'wasm';
}

interface SupertonicContextValue {
    state: SupertonicState;
    generateSpeech: (options: SupertonicGenerateOptions) => Promise<SupertonicGenerateResult>;
    loadVoiceStyle: (voiceStylePath: string) => Promise<void>;
}

const SupertonicContext = createContext<SupertonicContextValue | undefined>(undefined);

let sharedResources: SupertonicResources | null = null;
let sharedLoadPromise: Promise<SupertonicResources> | null = null;

async function loadSharedResources(
    onStatus: (status: string) => void
): Promise<SupertonicResources> {
    if (sharedResources) {
        return sharedResources;
    }

    if (sharedLoadPromise) {
        onStatus('Waiting for the current Supertonic load to finish...');
        return sharedLoadPromise;
    }

    sharedLoadPromise = (async () => {
        onStatus('Loading configuration...');
        const basePath = USE_HUGGING_FACE ? 'hf' : 'assets/onnx';
        let executionProvider: 'webgpu' | 'wasm' = 'wasm';
        let loadedTextToSpeech: TextToSpeech;
        let loadedCfgs: any;

        try {
            onStatus('Trying WebGPU acceleration...');
            const result = await loadTextToSpeech(basePath, {
                executionProviders: ['webgpu'],
                graphOptimizationLevel: 'all'
            }, (modelName, current, total) => {
                onStatus(`Downloading/loading model ${current}/${total}: ${modelName}`);
            });

            loadedTextToSpeech = result.textToSpeech;
            loadedCfgs = result.cfgs;
            executionProvider = 'webgpu';
        } catch (webgpuError) {
            console.log('WebGPU not available, falling back to WebAssembly', webgpuError);
            onStatus('WebGPU unavailable. Falling back to WebAssembly...');

            const result = await loadTextToSpeech(basePath, {
                executionProviders: ['wasm'],
                graphOptimizationLevel: 'all'
            }, (modelName, current, total) => {
                onStatus(`Downloading/loading model ${current}/${total}: ${modelName}`);
            });

            loadedTextToSpeech = result.textToSpeech;
            loadedCfgs = result.cfgs;
        }

        onStatus('Loading default voice style...');
        const style = await loadVoiceStyle([DEFAULT_VOICE_STYLE_PATH], true);

        sharedResources = {
            textToSpeech: loadedTextToSpeech,
            cfgs: loadedCfgs,
            style,
            stylePath: DEFAULT_VOICE_STYLE_PATH,
            backendType: executionProvider
        };

        return sharedResources;
    })().catch((error) => {
        sharedLoadPromise = null;
        throw error;
    });

    return sharedLoadPromise;
}

const useSupertonicEngine = (shouldLoad: boolean, desiredVoiceStyle: string): SupertonicContextValue => {
    const [state, setState] = useState<SupertonicState>({
        isLoading: false,
        isReady: false,
        error: null,
        loadingStatus: 'Supertonic is idle. Select it as the TTS provider to load the neural voice engine.',
        backendType: null,
        currentVoiceStyle: DEFAULT_VOICE_STYLE_PATH,
        hasRequestedLoad: false
    });

    const textToSpeechRef = useRef<TextToSpeech | null>(null);
    const cfgsRef = useRef<any>(null);
    const currentStyleRef = useRef<Style | null>(null);
    const currentStylePathRef = useRef<string>(DEFAULT_VOICE_STYLE_PATH);
    const lastFailedStylePathRef = useRef<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        if (!shouldLoad) {
            if (!sharedResources) {
                setState(prev => ({
                    ...prev,
                    isLoading: false,
                    isReady: false,
                    error: null,
                    loadingStatus: 'Supertonic is idle. Select it as the TTS provider to load the neural voice engine.'
                }));
            }
            return;
        }

        const initializeModels = async () => {
            try {
                setState(prev => ({
                    ...prev,
                    isLoading: true,
                    isReady: false,
                    error: null,
                    hasRequestedLoad: true,
                    loadingStatus: sharedResources ? 'Restoring loaded Supertonic engine...' : 'Preparing Supertonic...'
                }));

                const resources = await loadSharedResources((loadingStatus) => {
                    if (!cancelled) {
                        setState(prev => ({ ...prev, loadingStatus }));
                    }
                });

                if (cancelled) return;

                textToSpeechRef.current = resources.textToSpeech;
                cfgsRef.current = resources.cfgs;
                currentStyleRef.current = resources.style;
                currentStylePathRef.current = resources.stylePath;

                setState({
                    isLoading: false,
                    isReady: true,
                    error: null,
                    loadingStatus: `Supertonic ready. Backend: ${resources.backendType.toUpperCase()}. Voice: ${resources.stylePath}`,
                    backendType: resources.backendType,
                    currentVoiceStyle: resources.stylePath,
                    hasRequestedLoad: true
                });
            } catch (error) {
                if (cancelled) return;
                console.error('Error loading Supertonic models:', error);
                setState({
                    isLoading: false,
                    isReady: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    loadingStatus: 'Failed to load models',
                    backendType: null,
                    currentVoiceStyle: DEFAULT_VOICE_STYLE_PATH,
                    hasRequestedLoad: true
                });
            }
        };

        initializeModels();
        return () => {
            cancelled = true;
        };
    }, [shouldLoad]);

    // Load a specific voice style
    const loadVoiceStyleById = useCallback(async (voiceStylePath: string): Promise<void> => {
        if (!state.isReady) {
            throw new Error('Supertonic is not ready yet');
        }

        try {
            setState(prev => ({
                ...prev,
                error: null,
                loadingStatus: `Loading selected voice style: ${voiceStylePath}...`
            }));
            
            const style = await loadVoiceStyle([voiceStylePath], true);
            currentStyleRef.current = style;
            currentStylePathRef.current = voiceStylePath;
            lastFailedStylePathRef.current = null;
            if (sharedResources) {
                sharedResources.style = style;
                sharedResources.stylePath = voiceStylePath;
            }
            
            setState(prev => ({
                ...prev,
                error: null,
                currentVoiceStyle: voiceStylePath,
                loadingStatus: `Selected voice style loaded: ${voiceStylePath}`
            }));
            
        } catch (error) {
            lastFailedStylePathRef.current = voiceStylePath;
            console.error('Error loading voice style:', error);
            // Restore default on error
            try {
                const style = await loadVoiceStyle([DEFAULT_VOICE_STYLE_PATH], true);
                currentStyleRef.current = style;
                currentStylePathRef.current = DEFAULT_VOICE_STYLE_PATH;
                if (sharedResources) {
                    sharedResources.style = style;
                    sharedResources.stylePath = DEFAULT_VOICE_STYLE_PATH;
                }
                setState(prev => ({
                    ...prev,
                    currentVoiceStyle: DEFAULT_VOICE_STYLE_PATH,
                    loadingStatus: `Failed to load selected voice style: ${voiceStylePath}`,
                    error: error instanceof Error ? error.message : 'Unknown voice style error'
                }));
            } catch (restoreError) {
                console.error('Failed to restore default voice style:', restoreError);
            }
            throw error;
        }
    }, [state.isReady]);

    useEffect(() => {
        if (!shouldLoad || !state.isReady) return;
        if (!desiredVoiceStyle || desiredVoiceStyle === currentStylePathRef.current) return;
        if (desiredVoiceStyle === lastFailedStylePathRef.current) return;

        loadVoiceStyleById(desiredVoiceStyle).catch((error) => {
            console.error('Failed to sync selected Supertonic voice style:', error);
        });
    }, [shouldLoad, state.isReady, desiredVoiceStyle, loadVoiceStyleById]);

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
            setState(prev => ({
                ...prev,
                error: null,
                loadingStatus: `Generating speech with ${currentStylePathRef.current}...`
            }));

            const { wav, duration } = await textToSpeechRef.current.call(
                text,
                lang,
                currentStyleRef.current,
                totalStep,
                speed,
                0.3,
                (step, total) => {
                    setState(prev => ({
                        ...prev,
                        loadingStatus: `Generating speech: denoising step ${step}/${total}`
                    }));
                    if (onProgress) {
                        onProgress(step, total);
                    }
                }
            );

            // Create WAV file
            const wavLen = Math.floor(textToSpeechRef.current.sampleRate * duration[0]);
            const wavOut = wav.slice(0, wavLen);
            const wavBuffer = writeWavFile(wavOut, textToSpeechRef.current.sampleRate);
            const blob = new Blob([wavBuffer], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);

            setState(prev => ({
                ...prev,
                error: null,
                loadingStatus: `Audio generated (${duration[0].toFixed(1)}s). Playing next.`
            }));

            return {
                audioBlob: blob,
                audioUrl: url,
                duration: duration[0]
            };

        } catch (error) {
            console.error('Error during speech synthesis:', error);
            setState(prev => ({
                ...prev,
                loadingStatus: 'Speech generation failed.',
                error: error instanceof Error ? error.message : 'Unknown synthesis error'
            }));
            throw error;
        }
    }, [state.isReady, loadVoiceStyleById]);

    return {
        state,
        generateSpeech,
        loadVoiceStyle: loadVoiceStyleById
    };
};

export const SupertonicProvider = ({ children }: { children: ReactNode }) => {
    const { settings } = useSettings();
    const shouldLoad = settings.ttsEnabled && settings.ttsProvider === 'supertonic';
    const value = useSupertonicEngine(shouldLoad, settings.supertonicVoiceStyle);

    return createElement(SupertonicContext.Provider, { value }, children);
};

export const useSupertonic = () => {
    const context = useContext(SupertonicContext);
    if (!context) {
        throw new Error('useSupertonic must be used inside SupertonicProvider');
    }
    return context;
};
