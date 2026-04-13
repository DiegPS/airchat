# Performance Issues — Frontend

Problemas de rendimiento detectados mediante análisis estático del código React/TypeScript.

---

## HIGH

### [x] 1. Context Provider crea objeto nuevo en cada render
- **Archivo:** `frontend/src/context/SettingsContext.tsx:103`
- **Problema:** El `value={{ settings, updateSettings, resetSettings }}` es un objeto literal nuevo en cada render. Como `useSettings()` se consume en prácticamente todos los componentes, cualquier cambio en settings desencadena un re-render de todo el árbol.
- **Corrección:** Envolver el value en `useMemo`.

```typescript
// Antes
return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
        {children}
    </SettingsContext.Provider>
);

// Después
const value = useMemo(
    () => ({ settings, updateSettings, resetSettings }),
    [settings, updateSettings, resetSettings]
);
return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
```

---

### [ ] 2. `useTTS` — effect con 13 dependencias, el listener se re-registra en cada cambio de settings
- **Archivo:** `frontend/src/hooks/useTTS.ts:282`
- **Problema:** El `useEffect` que suscribe `chat_message` declara 13 dependencias (`settings.ttsEnabled`, `settings.ttsMembersOnly`, `settings.ttsCommandMode`, etc.). Cada vez que el usuario mueve un slider del sidebar, el listener se cancela y se re-registra. Además, `processQueue` es recreado en cascada por cada cambio.
- **Corrección:** Separar el efecto de suscripción del de configuración. Leer los settings que cambian frecuentemente desde refs dentro del handler en lugar de capturarlos por closure.

```typescript
// Crear refs para los settings volátiles
const settingsRef = useRef(settings);
useEffect(() => { settingsRef.current = settings; }, [settings]);

// El effect de suscripción solo depende de isStarted
useEffect(() => {
    if (!isStarted) return;
    const handleMessage = (message: ChatItem) => {
        const s = settingsRef.current; // lee siempre el valor actual
        if (!s.ttsEnabled) return;
        // ... resto de la lógica
    };
    const cancel = EventsOn("chat_message", handleMessage);
    return () => { if (cancel) cancel(); };
}, [isStarted]); // una sola dependencia
```

---

## MEDIUM

### [ ] 3. `PreviewArea` mapea mensajes sin memoización
- **Archivo:** `frontend/src/components/PreviewArea.tsx:40–137`
- **Problema:** Cada cambio de settings (aunque no afecte a los mensajes) re-renderiza la lista completa de chat. Los mensajes son el elemento más frecuentemente actualizado de la UI.
- **Corrección:** Aplicar `React.memo` al componente y extraer un `ChatMessageItem` memoizado.

```typescript
const ChatMessageItem = React.memo(({ msg, settings }: { msg: ChatItem; settings: Settings }) => {
    // lógica de render de un mensaje
});

export const PreviewArea = React.memo(({ messages, scrollRef, ...props }: PreviewAreaProps) => {
    const { settings } = useSettings();
    return (
        <main>
            <div className="chat-overlay">
                {messages.map(msg => <ChatMessageItem key={msg.ID} msg={msg} settings={settings} />)}
            </div>
        </main>
    );
});
```

---

### [ ] 4. `StreamHUD` — objetos de estilo inline creados en cada render
- **Archivo:** `frontend/src/components/StreamHUD.tsx:25–59`
- **Problema:** `positionStyle`, `hudStyle` y otros objetos de estilo se crean como literales en cada render, forzando reconciliación de estilos innecesaria.
- **Corrección:** `useMemo` con las dependencias reales de cada estilo.

```typescript
const positionStyle = useMemo(() => ({
    position: 'fixed' as const,
    // ... resto basado en settings.obsHudPosition
}), [settings.obsHudPosition]);

const hudStyle = useMemo(() => ({
    transform: `scale(${settings.obsHudScale})`,
    opacity: settings.obsHudOpacity,
}), [settings.obsHudScale, settings.obsHudOpacity]);
```

---

### [ ] 5. `Sidebar` — doble `.map()` sobre el schema sin memoización
- **Archivo:** `frontend/src/components/Sidebar.tsx:38–65`
- **Problema:** `SETTINGS_SCHEMA.map()` se ejecuta en cada render del sidebar aunque el schema sea completamente estático. Cada cambio en cualquier setting re-procesa toda la estructura.
- **Corrección:** Memoizar el resultado del map o aplicar `React.memo` a un componente `SettingSection`.

```typescript
const SettingSection = React.memo(({ section, settings, updateSettings }) => (
    <div className="settings-section">
        <h3>{section.label}</h3>
        {section.controls.map(control => (
            <SettingControl key={control.key} config={control} ... />
        ))}
    </div>
));
```

---

### [ ] 6. `PreviewArea` — transforms 3D como string interpolado en cada render
- **Archivo:** `frontend/src/components/PreviewArea.tsx:19–38`
- **Problema:** El string de transform `` `rotateX(${settings.rotateX}deg) rotateY(${settings.rotateY}deg) ...` `` se reconstruye en cada render aunque los valores no hayan cambiado.
- **Corrección:** `useMemo` con las dependencias exactas de la transformación.

```typescript
const transformStyle = useMemo(() => {
    if (!settings.threeDEnabled) return 'none';
    return `rotateX(${settings.rotateX}deg) rotateY(${settings.rotateY}deg) rotateZ(${settings.rotateZ}deg) skewX(${settings.skewX}deg) scale(${settings.scale})`;
}, [settings.threeDEnabled, settings.rotateX, settings.rotateY, settings.rotateZ, settings.skewX, settings.scale]);
```

---

### [ ] 7. `SettingControl` — `loadVoices` redefinida en cada render
- **Archivo:** `frontend/src/components/SettingControl.tsx:155–195`
- **Problema:** La función `loadVoices` se crea como nueva instancia en cada render, lo que provoca que el `useEffect` con `onvoiceschanged` se re-ejecute innecesariamente y acumule handlers.
- **Corrección:** `useCallback` para estabilizar la referencia.

```typescript
const loadVoices = useCallback(() => {
    const available = window.speechSynthesis.getVoices();
    setVoices(available);
}, []);

useEffect(() => {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
}, [loadVoices]);
```

---

### [ ] 8. `useSupertonic` — `loadVoiceStyleById` depende del objeto `state` completo
- **Archivo:** `frontend/src/hooks/supertonic2/useSupertonic.ts:161`
- **Problema:** El callback solo usa `state.isReady`, pero depende de `state` entero. Cada cambio en `loadingStatus` o `error` recrea `loadVoiceStyleById`, que a su vez recrea `generateSpeech` y `processQueue` — una cascada de recreación innecesaria.
- **Corrección:** Depender solo de `state.isReady`.

```typescript
const loadVoiceStyleById = useCallback(async (voiceStylePath: string) => {
    if (!state.isReady) throw new Error('Supertonic is not ready yet');
    // ...
}, [state.isReady]); // solo isReady, no el objeto state completo
```

---

### [ ] 9. `useOBSAudio` — polling cada 2 segundos
- **Archivo:** `frontend/src/hooks/useOBSAudio.ts:50`
- **Problema:** El intervalo de polling a OBS cada 2s genera llamadas al backend constantemente aunque el usuario no esté mirando el panel de audio. Innecesariamente agresivo.
- **Corrección:** Aumentar a 5s. Reducción del 60% en llamadas al backend sin impacto perceptible.

```typescript
const interval = setInterval(fetchAudioInputs, 5000); // era 2000
```

---

### [ ] 10. `useChat` — `settings.maxMessages` leído por closure obsoleto
- **Archivo:** `frontend/src/hooks/useChat.ts:81`
- **Problema:** `settings.maxMessages` se lee dentro del handler del evento `chat_message`, pero `settings` no está en el dep array del efecto (es vacío `[]`). El handler siempre usa el valor inicial de `maxMessages`.
- **Corrección:** Leer `maxMessages` desde una ref actualizada.

```typescript
const maxMessagesRef = useRef(settings.maxMessages);
useEffect(() => { maxMessagesRef.current = settings.maxMessages; }, [settings.maxMessages]);

// Dentro del handler:
const limit = maxMessagesRef.current || 100;
```

---

## LOW

### [ ] 11. `SetupScreen` sin `React.memo`
- **Archivo:** `frontend/src/components/SetupScreen.tsx`
- **Problema:** El componente re-renderiza con cada actualización del padre aunque sus props no cambien.
- **Corrección:** `export const SetupScreen = React.memo((...) => { ... })`.

---

### [ ] 12. Array de voces de Supertonic recreado en cada llamada
- **Archivo:** `frontend/src/components/SettingControl.tsx:~254`
- **Problema:** `['M1.json', 'M2.json', 'M3.json', ...]` se declara como literal dentro de la función, creando un array nuevo en cada invocación.
- **Corrección:** Declararlo como constante fuera del componente.

```typescript
const SUPERTONIC_VOICES = ['M1.json', 'M2.json', 'M3.json', 'M4.json', 'M5.json', 'F1.json', 'F2.json', 'F3.json', 'F4.json', 'F5.json'] as const;
```

---

### [ ] 13. `.setting-input` definido dos veces en CSS
- **Archivo:** `frontend/src/App.css:~400` y `~693`
- **Problema:** La clase `.setting-input` aparece definida dos veces con estilos ligeramente distintos. Genera confusión sobre qué regla aplica y carga de parseo duplicada.
- **Corrección:** Unificar en una sola definición.

---

### [ ] 14. `will-change` faltante en `.chat-overlay`
- **Archivo:** `frontend/src/App.css:~496`
- **Problema:** `.chat-overlay` usa `mask-image` (operación de paint costosa) sin dar hint al browser para que promueva el elemento a su propia capa.
- **Corrección:**

```css
.chat-overlay {
    will-change: transform;
    mask-image: linear-gradient(to bottom, transparent 0%, black 8%);
}
```

---

## Resumen

| # | Severidad | Área | Archivo | Estado |
|---|-----------|------|---------|--------|
| 1 | HIGH | Context re-renders | `SettingsContext.tsx:103` | [x] |
| 2 | HIGH | Event listener recreation | `useTTS.ts:282` | [ ] |
| 3 | MEDIUM | Lista de mensajes sin memo | `PreviewArea.tsx:40–137` | [ ] |
| 4 | MEDIUM | Inline styles en StreamHUD | `StreamHUD.tsx:25–59` | [ ] |
| 5 | MEDIUM | Schema map sin memo | `Sidebar.tsx:38–65` | [ ] |
| 6 | MEDIUM | Transform 3D interpolado | `PreviewArea.tsx:19–38` | [ ] |
| 7 | MEDIUM | loadVoices sin useCallback | `SettingControl.tsx:155–195` | [ ] |
| 8 | MEDIUM | Deps de estado completo | `useSupertonic.ts:161` | [ ] |
| 9 | MEDIUM | Polling agresivo | `useOBSAudio.ts:50` | [ ] |
| 10 | MEDIUM | Closure obsoleto maxMessages | `useChat.ts:81` | [ ] |
| 11 | LOW | SetupScreen sin memo | `SetupScreen.tsx` | [ ] |
| 12 | LOW | Array literal en función | `SettingControl.tsx:~254` | [ ] |
| 13 | LOW | CSS duplicado | `App.css:~400,~693` | [ ] |
| 14 | LOW | will-change faltante | `App.css:~496` | [ ] |
