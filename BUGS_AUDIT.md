# AirChat Bug Audit

Fecha de revision: 2026-05-09
Estado: todos los hallazgos de esta auditoria fueron implementados en la misma fecha.

Verificaciones ejecutadas:

- `npm run build` en `frontend/`: pasa.
- `go test ./...`: pasa, pero el repo no tiene tests.
- `gofmt -w app.go twitch_emotes.go`: aplicado.

Nota: habia cambios locales previos en `frontend/src/hooks/supertonic2/helper.ts` y `frontend/src/hooks/supertonic2/useSupertonic.ts`; esta auditoria no los revirtio.

## Resumen de implementacion

- Corregido `EventsOff`: `useChat` ahora usa las funciones de cancelacion retornadas por `EventsOn`.
- Corregido manejo de channels cerradas en `handleChatEvents`.
- Retirados proveedores TTS no implementados de la UI y saneado `localStorage` si habia uno guardado.
- Corregida carrera de preview activando el gate antes de emitir mensajes mock.
- Corregido Kick para no reemplazar una sesion valida si `JoinChannelBySlug` falla.
- OBS perdido ahora tambien baja `obsConnected`.
- Supertonic ya no acumula cola cuando el motor no esta listo y la cola queda limitada.
- `PreviewArea` y `useTTS` validan payloads incompletos antes de usarlos.
- `SetClickThrough` reintenta resolver el HWND si no estaba disponible.
- Twitch/Kick normalizan `trim`, `@usuario` y URLs simples.
- Fetch de emotes Twitch ahora tiene timeout.
- Sliders de volumen OBS clamplean el valor visible a 0-100.
- Los errores que antes podian quedar solo en consola ahora se reflejan en UI: estado TTS, prueba de voz, OBS audio, preview, OBS connect/disconnect y desconexion de chats.
- Eliminados `console.warn`, `console.log` informativos y `.catch(console.error)` en `frontend/src`; los `console.error` restantes acompanian un estado visible para el usuario.

## Hallazgos

### Alta severidad

1. `EventsOff` puede borrar listeners de otros hooks

- Archivo: `frontend/src/hooks/useChat.ts`
- Lineas: 88-161
- Problema: el hook registra listeners con `EventsOn`, pero en cleanup llama `EventsOff("chat_message")`, `EventsOff("obs_status")`, etc. En Wails eso elimina todos los listeners de ese evento, no solo los de `useChat`.
- Impacto: puede romper el listener de TTS en `useTTS`, duplicar o perder eventos en remounts/HMR/StrictMode, y provocar estados inconsistentes.
- Fix recomendado: guardar las funciones de cancelacion que devuelve `EventsOn` y llamarlas individualmente en el cleanup.

2. Canales cerrados de YouTube pueden emitir valores cero o dejar un loop ocupado

- Archivo: `app.go`
- Lineas: 804-817
- Problema: `handleChatEvents` lee `lc.StartChan`, `lc.EndChan`, `lc.ChatChan` y `lc.ErrorChan` sin verificar el booleano `ok`. Si una de esas channels se cierra sin que `EndChan` termine el loop, el `select` puede seguir recibiendo valores cero.
- Impacto: mensajes vacios hacia el frontend, errores nulos, CPU alta o goroutine viva despues de cerrar chat.
- Fix recomendado: leer con `value, ok := <-ch`; si `!ok`, desactivar esa channel o retornar cuando ya no haya fuentes activas.

3. Proveedores TTS no implementados aparecen como seleccionables

- Archivos: `frontend/src/config/settingsSchema.ts`, `frontend/src/hooks/useTTS.ts`
- Lineas: `settingsSchema.ts` 308-318, `useTTS.ts` 17 y 93-135
- Problema: la UI ofrece Google Cloud TTS, Amazon Polly, Microsoft Azure y ElevenLabs, pero `useTTS` solo distingue Supertonic; cualquier otro proveedor cae al flujo de Browser Speech API.
- Impacto: el usuario puede seleccionar un proveedor premium y escuchar la voz del navegador sin error ni aviso.
- Fix recomendado: ocultar esos proveedores, marcarlos como no disponibles o implementar sus integraciones reales.

### Media severidad

4. Preview puede perder los primeros mensajes

- Archivos: `frontend/src/hooks/useChat.ts`, `app.go`
- Lineas: `useChat.ts` 232-234, `app.go` 51-143
- Problema: `startPreview` hace `setIsPreviewMode(true)` y llama inmediatamente a `StartPreviewChat`. El backend emite el primer mensaje en una goroutine sin espera inicial. El gate `isActiveRef` se actualiza en un `useEffect`, asi que puede seguir en `false` cuando llegan los primeros eventos.
- Impacto: el preview de diseno puede iniciar incompleto o parecer que no funciona.
- Fix recomendado: activar un ref sincrono antes de llamar al backend o iniciar la emision despues de confirmar el estado activo.

5. Fallo al conectar Kick deja estado backend parcialmente reemplazado

- Archivo: `app.go`
- Lineas: 709-738
- Problema: `StartKickChat` reemplaza `a.kickClient` y cierra la sesion anterior antes de ejecutar `JoinChannelBySlug`. Si el join falla, el cliente fallido queda guardado y la sesion anterior ya fue cerrada.
- Impacto: reconexiones confusas, perdida de una sesion valida anterior y necesidad de limpiar en un intento posterior.
- Fix recomendado: hacer `JoinChannelBySlug` antes del swap o revertir `a.kickClient/a.kickCancel` en el path de error.

6. OBS perdido no actualiza el estado virtual `obsConnected`

- Archivo: `frontend/src/hooks/useChat.ts`
- Lineas: 189-194
- Problema: cuando llega `obs_status.connected === false`, solo cambia `obsStatusMessage`; `settings.obsConnected` queda en `true`.
- Impacto: el boton sigue en modo "Disconnect OBS"; para reconectar normalmente hay que hacer dos clicks. El HUD se oculta, pero la UI sigue creyendo que hay una conexion solicitada.
- Fix recomendado: al detectar perdida, hacer `updateSettings({ obsStatusMessage: 'Disconnected (Lost connection)', obsConnected: false })` o crear un estado separado para "desired connection" vs "actual connection".

7. Supertonic puede quedar en cola sin reintento si no esta listo

- Archivo: `frontend/src/hooks/useTTS.ts`
- Lineas: 28-39 y 140-147
- Problema: si Supertonic no esta listo, el texto se reinsertara al frente de la cola y `processQueue` saldra. Solo se reintenta cuando cambia `supertonicState.isReady`.
- Impacto: si la carga falla o tarda mucho, la cola puede crecer silenciosamente y dispararse tarde con mensajes viejos.
- Fix recomendado: limitar cola, descartar mensajes cuando el motor no esta listo, o mostrar estado/error claro.

8. Mensajes con estructura incompleta pueden romper render/TTS

- Archivos: `frontend/src/components/PreviewArea.tsx`, `frontend/src/hooks/useTTS.ts`
- Lineas: `PreviewArea.tsx` 166-180, `useTTS.ts` 212-255
- Problema: se asume que `message.Author`, `message.Author.Thumbnail`, `message.Author.Name` y `message.Message` tienen siempre forma valida.
- Impacto: un evento incompleto de una plataforma, un cambio de libreria o un valor cero del backend puede causar crash de React o del listener de TTS.
- Fix recomendado: normalizar payloads en backend o validar/descartar mensajes invalidos en `useChat` antes de agregarlos.

### Baja severidad

9. `SetClickThrough` depende de `FindWindow` por titulo

- Archivo: `app.go`
- Lineas: 450-463
- Problema: se busca la ventana por titulo `"airchat"`. Si hay otra ventana con ese titulo, o si Wails cambia el titulo real, el handle puede ser incorrecto o cero.
- Impacto: `Ctrl+B` puede no activar click-through o aplicarlo a la ventana equivocada.
- Fix recomendado: obtener el HWND de la ventana Wails de forma directa si es posible, o validar el handle antes de modificar estilos.

10. Inputs de Twitch/Kick no se normalizan

- Archivo: `frontend/src/hooks/useChat.ts`
- Lineas: 196-226
- Problema: YouTube se normaliza en Go, pero Twitch/Kick pasan strings tal cual.
- Impacto: espacios, URLs o `@usuario` pueden fallar aunque el usuario espere que funcionen.
- Fix recomendado: `trim`, quitar `@`, rechazar URLs no soportadas con un error claro.

11. Cliente HTTP de emotes no tiene timeout

- Archivo: `twitch_emotes.go`
- Linea: 249
- Problema: `http.Client{}` sin timeout puede colgar fetches de BTTV/FFZ/7TV.
- Impacto: goroutines de carga de emotes pueden quedar esperando indefinidamente en redes malas.
- Fix recomendado: configurar `Timeout`, por ejemplo 5-10 segundos.

12. Slider de volumen OBS no clampa valores

- Archivo: `frontend/src/components/StreamHUD.tsx`
- Lineas: 180-191 y 220-231
- Problema: el valor del slider usa `Math.round(volume + 100)` sin limitar a 0-100.
- Impacto: valores fuera de rango o especiales del OBS WebSocket pueden producir warnings o UI incorrecta.
- Fix recomendado: clamplear `Math.max(0, Math.min(100, Math.round(volume + 100)))`.

## Recomendacion para archivar

Para archivar el proyecto sin tocar funcionalidad, marcar los hallazgos 1-3 como "known issues" obligatorios en README o release notes. Si se desea dejar una version final mas estable, conviene corregir primero 1, 3, 4, 5 y 8 porque afectan rutas visibles para usuarios.
