# Lista de Correcciones Pendientes

Errores, race conditions y memory leaks detectados mediante análisis estático del código.

---

## Backend Go (`app.go`)

### [x] 1. Panic por doble `close()` en `stopSignal`
- **Archivo:** `app.go:407`
- **Método:** `StartChat`
- **Problema:** `close(a.stopSignal)` se ejecuta sin verificar si el canal ya fue cerrado. Si `StartChat` es invocado dos veces rápidamente antes de que el goroutine anterior responda, el segundo `close()` produce **panic**.
- **Corrección:** Usar `sync.Once` o un flag booleano protegido por mutex para garantizar que el canal solo se cierra una vez.

```go
// Antes
close(a.stopSignal)

// Después (con sync.Once o flag)
if a.stopSignalOnce != nil {
    a.stopSignalOnce.Do(func() { close(a.stopSignal) })
}
```

---

### [x] 2. Data race en `obsClient` y `obsStop` — sin mutex
- **Archivo:** `app.go:153–188`
- **Métodos:** `ConnectOBS`, `DisconnectOBS`
- **Problema:** `a.obsClient` y `a.obsStop` se leen y escriben sin ningún mutex. El goroutine `monitorOBS` corre concurrentemente. Una llamada simultánea a `ConnectOBS` y `DisconnectOBS` desde el frontend produce una **data race** detectable con `go test -race`.
- **Corrección:** Agregar un `sync.Mutex` (`obsClientMu`) y adquirirlo en todos los métodos que accedan a esos campos.

```go
// En el struct App:
obsClientMu sync.Mutex

// En ConnectOBS y DisconnectOBS:
a.obsClientMu.Lock()
defer a.obsClientMu.Unlock()
```

---

### [ ] 3. Goroutine `handleChatEvents` lanzado fuera del lock
- **Archivo:** `app.go:423`
- **Método:** `StartChat`
- **Problema:** El `defer a.lcMu.Unlock()` libera el lock antes de que el `go a.handleChatEvents(...)` inicie. Si `StopChat` es llamado en esa ventana, cierra `stopSignal` antes de que el goroutine empiece a escucharlo — el goroutine queda bloqueado esperando un canal ya cerrado o nunca termina correctamente.
- **Corrección:** Lanzar el goroutine dentro de una función auxiliar que mantenga el lock, o capturar las variables necesarias antes del unlock y lanzarlo inmediatamente después con una barrera de sincronización (e.g., `sync.WaitGroup`).

---

### [ ] 4. Goroutine leak en `monitorOBS` — contexto de app no propagado
- **Archivo:** `app.go:173` (llamada), `app.go:275+` (definición)
- **Método:** `monitorOBS`
- **Problema:** El goroutine solo termina si `obsStop` es cerrado. Si la app se cierra sin invocar `DisconnectOBS`, o si hay un error que impida llegar a `close(a.obsStop)`, el goroutine queda vivo indefinidamente. El `a.ctx` provisto por Wails al hacer shutdown no se propaga al goroutine.
- **Corrección:** Agregar un `case <-a.ctx.Done(): return` en el `select` del loop de `monitorOBS`.

```go
select {
case <-stopSignal:
    return
case <-a.ctx.Done(): // <-- agregar
    return
// ... otros cases
}
```

---

### [x] 5. `obsClient` leído sin mutex en múltiples métodos
- **Archivo:** `app.go:198+`
- **Métodos:** `GetOBSAudioInputs`, `SetVolume`, `MuteInput`, `GetOBSStreamStatus`, etc.
- **Problema:** Todos estos métodos leen `a.obsClient` directamente sin adquirir el `obsClientMu` propuesto en el punto 2. Si `DisconnectOBS` corre concurrentemente y setea `a.obsClient = nil`, cualquiera de estos métodos puede hacer nil pointer dereference.
- **Corrección:** Adquirir `obsClientMu.RLock()` (lectura) al inicio de cada método que use `a.obsClient`.

---

## Frontend React/TypeScript

### [ ] 6. `EventsOff` elimina listeners de otros hooks (`useChat.ts`)
- **Archivo:** `frontend/src/hooks/useChat.ts:106–112`
- **Problema:** `EventsOff("chat_message")` elimina **todos** los listeners registrados bajo ese evento, incluyendo el de `useTTS`. Además, si el componente se remonta (React StrictMode monta/desmonta en desarrollo), los handlers se acumulan y los mensajes se procesan en duplicado.
- **Corrección:** `EventsOn` retorna una función de cancelación — capturarla y usarla en el cleanup en lugar de `EventsOff`.

```typescript
// Antes
EventsOn("chat_message", handler);
return () => { EventsOff("chat_message"); };

// Después
const cancel = EventsOn("chat_message", handler);
return () => { cancel(); };
```

---

### [ ] 7. Stale closure de `isStarted` y `settings` en `useTTS.ts`
- **Archivo:** `frontend/src/hooks/useTTS.ts:196–282`
- **Problema:** `handleMessage` captura `isStarted` y `settings` en el closure al momento de crearse el efecto. Si `isStarted` cambia a `false` mientras un mensaje está siendo procesado, el closure usa el valor anterior. La ventana de inconsistencia existe entre el cambio de estado y la re-ejecución del efecto.
- **Corrección:** Usar refs para los valores que deben leerse en tiempo de ejecución del handler, no en tiempo de creación.

```typescript
const isStartedRef = useRef(isStarted);
useEffect(() => { isStartedRef.current = isStarted; }, [isStarted]);

// En handleMessage:
if (!isStartedRef.current) return;
```

---

### [ ] 8. `processQueue` stale capturado en callbacks de audio (`useTTS.ts`)
- **Archivo:** `frontend/src/hooks/useTTS.ts:62–92`
- **Problema:** `audio.onended`, `audio.onerror` y `audio.play().catch(...)` capturan `processQueue` en el closure al momento en que el objeto `Audio` es creado. Si `processQueue` cambia (por cambio en settings) mientras el audio se reproduce, los callbacks llaman a la versión antigua con settings stale.
- **Corrección:** Usar una ref que siempre apunte a la versión más reciente de `processQueue`.

```typescript
const processQueueRef = useRef(processQueue);
useEffect(() => { processQueueRef.current = processQueue; }, [processQueue]);

// En los callbacks:
audio.onended = () => { processQueueRef.current(); };
```

---

### [ ] 9. Memory leak en `window.speechSynthesis.onvoiceschanged` (`SettingControl.tsx`)
- **Archivo:** `frontend/src/components/SettingControl.tsx:~158`
- **Problema:** Se asigna `window.speechSynthesis.onvoiceschanged = loadVoices` sin limpiar en el return del `useEffect`. Si el componente se desmonta y remonta, el handler anterior queda apuntando al closure del componente desmontado, causando setState en componente desmontado (warning de React) y potencial comportamiento incorrecto.
- **Corrección:** Remover el handler en el cleanup del efecto.

```typescript
useEffect(() => {
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
        window.speechSynthesis.onvoiceschanged = null;
    };
}, []);
```

---

### [ ] 10. `setVolume` asíncrono sin manejo de error ni rollback (`useOBSAudio.ts`)
- **Archivo:** `frontend/src/hooks/useOBSAudio.ts:~80`
- **Función:** `setVolumeLocal`
- **Problema:** La UI se actualiza inmediatamente con `setAudioInputs(...)`, pero la llamada al backend `setVolume(inputName, volumeDb)` es async sin `await` ni `.catch`. Si el backend falla (OBS desconectado, error de red), la UI muestra un valor que OBS nunca recibió.
- **Corrección:** Esperar la respuesta del backend y hacer rollback del estado en caso de error.

```typescript
const setVolumeLocal = async (inputName: string, volumeDb: number) => {
    const prev = audioInputs; // guardar estado previo
    setAudioInputs(prev => {...}); // optimistic update
    try {
        await setVolume(inputName, volumeDb);
    } catch (err) {
        console.error("Failed to set OBS volume:", err);
        setAudioInputs(prev); // rollback
    }
};
```

---

### [ ] 11. `DisconnectOBS` llamado innecesariamente al iniciar (`useChat.ts`)
- **Archivo:** `frontend/src/hooks/useChat.ts:133`
- **Problema:** El bloque `else` llama a `DisconnectOBS()` siempre que `obsEnabled` o `obsConnected` sean falsos, incluso en el primer render cuando nunca hubo conexión. Genera una llamada al backend redundante en cada carga de la app.
- **Corrección:** Verificar si previamente había una conexión activa antes de desconectar (e.g., con una ref `wasConnectedRef`).

---

## Resumen

| # | Severidad | Tipo | Archivo | Estado |
|---|-----------|------|---------|--------|
| 1 | CRÍTICO | Panic (double-close) | `app.go:407` | [x] |
| 2 | CRÍTICO | Data Race | `app.go:153–188` | [x] |
| 3 | ALTO | Race condition | `app.go:423` | [ ] |
| 4 | ALTO | Goroutine leak | `app.go:275+` | [ ] |
| 5 | ALTO | Nil pointer / Data Race | `app.go:198+` | [x] |
| 6 | ALTO | Doble suscripción / Event leak | `useChat.ts:106–112` | [ ] |
| 7 | ALTO | Stale closure | `useTTS.ts:196–282` | [ ] |
| 8 | ALTO | Stale callback | `useTTS.ts:62–92` | [ ] |
| 9 | MEDIO | Memory leak | `SettingControl.tsx:~158` | [ ] |
| 10 | MEDIO | Error silenciado / UI inconsistente | `useOBSAudio.ts:~80` | [ ] |
| 11 | BAJO | Llamada redundante | `useChat.ts:133` | [ ] |
