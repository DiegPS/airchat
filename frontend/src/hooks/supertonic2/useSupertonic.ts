import { createContext, createElement, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import {
    loadTextToSpeech,
    loadVoiceStyle,
    SupertonicAssetOptions,
    SUPERTONIC2_LANGS,
    SUPERTONIC3_LANGS,
    writeWavFile,
    TextToSpeech,
    Style
} from './helper';

type SupertonicModelId = 'supertonic2' | 'supertonic3';

interface SupertonicModelConfig {
    id: SupertonicModelId;
    displayName: string;
    hfRepo: string;
    cacheName: string;
    defaultVoiceStyle: string;
    availableLangs: string[];
}

const USE_HUGGING_FACE = true;
const MODEL_CONFIGS: Record<SupertonicModelId, SupertonicModelConfig> = {
    supertonic2: {
        id: 'supertonic2',
        displayName: 'Supertonic 2',
        hfRepo: 'Supertone/supertonic-2',
        cacheName: 'supertonic-2-models-v1',
        defaultVoiceStyle: USE_HUGGING_FACE ? 'M1.json' : 'assets/voice_styles/M1.json',
        availableLangs: SUPERTONIC2_LANGS
    },
    supertonic3: {
        id: 'supertonic3',
        displayName: 'Supertonic 3',
        hfRepo: 'Supertone/supertonic-3',
        cacheName: 'supertonic-3-models-v1',
        defaultVoiceStyle: USE_HUGGING_FACE ? 'M1.json' : 'assets/voice_styles/M1.json',
        availableLangs: SUPERTONIC3_LANGS
    }
};

const DEFAULT_MODEL_ID: SupertonicModelId = 'supertonic2';

export interface SupertonicState {
    isLoading: boolean;
    isReady: boolean;
    error: string | null;
    loadingStatus: string;
    backendType: 'webgpu' | 'wasm' | null;
    currentVoiceStyle: string;
    hasRequestedLoad: boolean;
    modelId: SupertonicModelId;
    modelName: string;
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
const sharedResourcesByModel: Partial<Record<SupertonicModelId, SupertonicResources>> = {};
const sharedLoadPromiseByModel: Partial<Record<SupertonicModelId, Promise<SupertonicResources>>> = {};

function getModelIdFromProvider(ttsProvider: string): SupertonicModelId {
    return ttsProvider === 'supertonic3' ? 'supertonic3' : 'supertonic2';
}

function getAssetOptions(modelConfig: SupertonicModelConfig): SupertonicAssetOptions {
    return {
        hfRepo: modelConfig.hfRepo,
        cacheName: modelConfig.cacheName,
        availableLangs: modelConfig.availableLangs
    };
}

async function loadSharedResources(
    modelConfig: SupertonicModelConfig,
    onStatus: (status: string) => void
): Promise<SupertonicResources> {
    const existingResources = sharedResourcesByModel[modelConfig.id];
    if (existingResources) {
        return existingResources;
    }

    const existingPromise = sharedLoadPromiseByModel[modelConfig.id];
    if (existingPromise) {
        onStatus(`Waiting for the current ${modelConfig.displayName} load to finish...`);
        return existingPromise;
    }

    sharedLoadPromiseByModel[modelConfig.id] = (async () => {
        onStatus(`Loading ${modelConfig.displayName} configuration...`);
        const basePath = USE_HUGGING_FACE ? 'hf' : 'assets/onnx';
        const assetOptions = getAssetOptions(modelConfig);
        let executionProvider: 'webgpu' | 'wasm' = 'wasm';
        let loadedTextToSpeech: TextToSpeech;
        let loadedCfgs: any;

        try {
            onStatus(`Trying WebGPU acceleration for ${modelConfig.displayName}...`);
            const result = await loadTextToSpeech(basePath, {
                executionProviders: ['webgpu'],
                graphOptimizationLevel: 'all'
            }, assetOptions, (modelName, current, total) => {
                onStatus(`Downloading/loading ${modelConfig.displayName} model ${current}/${total}: ${modelName}`);
            });

            loadedTextToSpeech = result.textToSpeech;
            loadedCfgs = result.cfgs;
            executionProvider = 'webgpu';
        } catch (webgpuError) {
            console.log(`${modelConfig.displayName}: WebGPU not available, falling back to WebAssembly`, webgpuError);
            onStatus(`WebGPU unavailable. Falling back to WebAssembly for ${modelConfig.displayName}...`);

            const result = await loadTextToSpeech(basePath, {
                executionProviders: ['wasm'],
                graphOptimizationLevel: 'all'
            }, assetOptions, (modelName, current, total) => {
                onStatus(`Downloading/loading ${modelConfig.displayName} model ${current}/${total}: ${modelName}`);
            });

            loadedTextToSpeech = result.textToSpeech;
            loadedCfgs = result.cfgs;
        }

        onStatus(`Loading ${modelConfig.displayName} default voice style...`);
        const style = await loadVoiceStyle([modelConfig.defaultVoiceStyle], true, assetOptions);

        const resources = {
            textToSpeech: loadedTextToSpeech,
            cfgs: loadedCfgs,
            style,
            stylePath: modelConfig.defaultVoiceStyle,
            backendType: executionProvider
        };
        sharedResourcesByModel[modelConfig.id] = resources;

        return resources;
    })().catch((error) => {
        sharedLoadPromiseByModel[modelConfig.id] = undefined;
        throw error;
    });

    return sharedLoadPromiseByModel[modelConfig.id]!;
}

const useSupertonicEngine = (
    shouldLoad: boolean,
    desiredVoiceStyle: string,
    modelId: SupertonicModelId
): SupertonicContextValue => {
    const modelConfig = useMemo(() => MODEL_CONFIGS[modelId], [modelId]);
    const [state, setState] = useState<SupertonicState>({
        isLoading: false,
        isReady: false,
        error: null,
        loadingStatus: 'Supertonic is idle. Select it as the TTS provider to load the neural voice engine.',
        backendType: null,
        currentVoiceStyle: MODEL_CONFIGS[DEFAULT_MODEL_ID].defaultVoiceStyle,
        hasRequestedLoad: false,
        modelId: DEFAULT_MODEL_ID,
        modelName: MODEL_CONFIGS[DEFAULT_MODEL_ID].displayName
    });

    const textToSpeechRef = useRef<TextToSpeech | null>(null);
    const cfgsRef = useRef<any>(null);
    const currentStyleRef = useRef<Style | null>(null);
    const currentStylePathRef = useRef<string>(MODEL_CONFIGS[DEFAULT_MODEL_ID].defaultVoiceStyle);
    const lastFailedStylePathRef = useRef<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        if (!shouldLoad) {
            if (!sharedResourcesByModel[modelConfig.id]) {
                textToSpeechRef.current = null;
                cfgsRef.current = null;
                currentStyleRef.current = null;
                currentStylePathRef.current = modelConfig.defaultVoiceStyle;
                setState(prev => ({
                    ...prev,
                    isLoading: false,
                    isReady: false,
                    error: null,
                    backendType: null,
                    currentVoiceStyle: modelConfig.defaultVoiceStyle,
                    modelId: modelConfig.id,
                    modelName: modelConfig.displayName,
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
                    currentVoiceStyle: modelConfig.defaultVoiceStyle,
                    modelId: modelConfig.id,
                    modelName: modelConfig.displayName,
                    loadingStatus: sharedResourcesByModel[modelConfig.id]
                        ? `Restoring loaded ${modelConfig.displayName} engine...`
                        : `Preparing ${modelConfig.displayName}...`
                }));

                const resources = await loadSharedResources(modelConfig, (loadingStatus) => {
                    if (!cancelled) {
                        setState(prev => ({ ...prev, loadingStatus }));
                    }
                });

                if (cancelled) return;

                textToSpeechRef.current = resources.textToSpeech;
                cfgsRef.current = resources.cfgs;
                currentStyleRef.current = resources.style;
                currentStylePathRef.current = resources.stylePath;
                lastFailedStylePathRef.current = null;

                setState({
                    isLoading: false,
                    isReady: true,
                    error: null,
                    loadingStatus: `${modelConfig.displayName} ready. Backend: ${resources.backendType.toUpperCase()}. Voice: ${resources.stylePath}`,
                    backendType: resources.backendType,
                    currentVoiceStyle: resources.stylePath,
                    hasRequestedLoad: true,
                    modelId: modelConfig.id,
                    modelName: modelConfig.displayName
                });
            } catch (error) {
                if (cancelled) return;
                console.error(`Error loading ${modelConfig.displayName} models:`, error);
                setState({
                    isLoading: false,
                    isReady: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    loadingStatus: `Failed to load ${modelConfig.displayName} models`,
                    backendType: null,
                    currentVoiceStyle: modelConfig.defaultVoiceStyle,
                    hasRequestedLoad: true,
                    modelId: modelConfig.id,
                    modelName: modelConfig.displayName
                });
            }
        };

        initializeModels();
        return () => {
            cancelled = true;
        };
    }, [shouldLoad, modelConfig]);

    const loadVoiceStyleById = useCallback(async (voiceStylePath: string): Promise<void> => {
        if (!state.isReady) {
            throw new Error(`${modelConfig.displayName} is not ready yet`);
        }

        const assetOptions = getAssetOptions(modelConfig);

        try {
            setState(prev => ({
                ...prev,
                error: null,
                loadingStatus: `Loading ${modelConfig.displayName} selected voice style: ${voiceStylePath}...`
            }));

            const style = await loadVoiceStyle([voiceStylePath], true, assetOptions);
            currentStyleRef.current = style;
            currentStylePathRef.current = voiceStylePath;
            lastFailedStylePathRef.current = null;

            const resources = sharedResourcesByModel[modelConfig.id];
            if (resources) {
                resources.style = style;
                resources.stylePath = voiceStylePath;
            }

            setState(prev => ({
                ...prev,
                error: null,
                currentVoiceStyle: voiceStylePath,
                loadingStatus: `${modelConfig.displayName} selected voice style loaded: ${voiceStylePath}`
            }));
        } catch (error) {
            lastFailedStylePathRef.current = voiceStylePath;
            console.error(`Error loading ${modelConfig.displayName} voice style:`, error);
            try {
                const style = await loadVoiceStyle([modelConfig.defaultVoiceStyle], true, assetOptions);
                currentStyleRef.current = style;
                currentStylePathRef.current = modelConfig.defaultVoiceStyle;

                const resources = sharedResourcesByModel[modelConfig.id];
                if (resources) {
                    resources.style = style;
                    resources.stylePath = modelConfig.defaultVoiceStyle;
                }

                setState(prev => ({
                    ...prev,
                    currentVoiceStyle: modelConfig.defaultVoiceStyle,
                    loadingStatus: `Failed to load selected ${modelConfig.displayName} voice style: ${voiceStylePath}`,
                    error: error instanceof Error ? error.message : 'Unknown voice style error'
                }));
            } catch (restoreError) {
                console.error(`Failed to restore ${modelConfig.displayName} default voice style:`, restoreError);
            }
            throw error;
        }
    }, [state.isReady, modelConfig]);

    useEffect(() => {
        if (!shouldLoad || !state.isReady) return;
        if (!desiredVoiceStyle || desiredVoiceStyle === currentStylePathRef.current) return;
        if (desiredVoiceStyle === lastFailedStylePathRef.current) return;

        loadVoiceStyleById(desiredVoiceStyle).catch((error) => {
            console.error(`Failed to sync selected ${modelConfig.displayName} voice style:`, error);
        });
    }, [shouldLoad, state.isReady, desiredVoiceStyle, loadVoiceStyleById, modelConfig.displayName]);

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
            throw new Error(`${modelConfig.displayName} is not ready yet`);
        }

        if (!currentStyleRef.current) {
            throw new Error('Voice style is not loaded');
        }

        if (!text.trim()) {
            throw new Error('Text cannot be empty');
        }

        if (!modelConfig.availableLangs.includes(lang)) {
            throw new Error(`Invalid language for ${modelConfig.displayName}: ${lang}. Available: ${modelConfig.availableLangs.join(', ')}`);
        }

        if (voiceStyle && voiceStyle !== currentStylePathRef.current) {
            await loadVoiceStyleById(voiceStyle);
        }

        try {
            setState(prev => ({
                ...prev,
                error: null,
                loadingStatus: `Generating speech with ${modelConfig.displayName} / ${currentStylePathRef.current}...`
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
                        loadingStatus: `Generating ${modelConfig.displayName} speech: denoising step ${step}/${total}`
                    }));
                    if (onProgress) {
                        onProgress(step, total);
                    }
                }
            );

            const wavLen = Math.floor(textToSpeechRef.current.sampleRate * duration[0]);
            const wavOut = wav.slice(0, wavLen);
            const wavBuffer = writeWavFile(wavOut, textToSpeechRef.current.sampleRate);
            const blob = new Blob([wavBuffer], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);

            setState(prev => ({
                ...prev,
                error: null,
                loadingStatus: `${modelConfig.displayName} audio generated (${duration[0].toFixed(1)}s). Playing next.`
            }));

            return {
                audioBlob: blob,
                audioUrl: url,
                duration: duration[0]
            };
        } catch (error) {
            console.error(`Error during ${modelConfig.displayName} speech synthesis:`, error);
            setState(prev => ({
                ...prev,
                loadingStatus: `${modelConfig.displayName} speech generation failed.`,
                error: error instanceof Error ? error.message : 'Unknown synthesis error'
            }));
            throw error;
        }
    }, [state.isReady, loadVoiceStyleById, modelConfig]);

    return {
        state,
        generateSpeech,
        loadVoiceStyle: loadVoiceStyleById
    };
};

export const SupertonicProvider = ({ children }: { children: ReactNode }) => {
    const { settings } = useSettings();
    const shouldLoad = settings.ttsEnabled && (settings.ttsProvider === 'supertonic' || settings.ttsProvider === 'supertonic3');
    const modelId = getModelIdFromProvider(settings.ttsProvider);
    const value = useSupertonicEngine(shouldLoad, settings.supertonicVoiceStyle, modelId);

    return createElement(SupertonicContext.Provider, { value }, children);
};

export const useSupertonic = () => {
    const context = useContext(SupertonicContext);
    if (!context) {
        throw new Error('useSupertonic must be used inside SupertonicProvider');
    }
    return context;
};
