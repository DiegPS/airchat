# airchat — guía del código

airchat es una app de escritorio para Windows construida con **Wails v2** (Go + React/TypeScript). Es un **chat overlay** para streamers: muestra mensajes de YouTube, Twitch y Kick en tiempo real, con TTS, emotes y control de OBS.

La guía técnica completa está en `AGENTS.md`. Este archivo resume lo esencial y las reglas de trabajo.

---

## Arquitectura

```
main.go → app.go (fachada Wails, solo métodos expuestos) → internal/*
```

| Paquete | Responsabilidad |
|---|---|
| `internal/chat` | Modelo `Message`, `Sink`, `Manager` genérico, normalización de entrada |
| `internal/platform/{youtube,twitch,kick}` | Un `Connector` por plataforma |
| `internal/obs` | Conexión OBS, audio y cálculo de estado (bitrate, drops) |
| `internal/preview` | Mensajes de ejemplo |
| `internal/window` | Click-through (Windows) |

### Reglas

- **Plataformas autónomas.** Cada plataforma tiene su propio `Manager`; si una falla, las demás siguen. No hay estado compartido entre ellas.
- **Dirección de dependencias.** `internal/platform/*` depende de `internal/chat`, nunca entre sí ni de `main`.
- **`Manager.Start`** conecta primero y solo si tiene éxito reemplaza la sesión anterior (la vieja se cierra fuera del lock). Una sesión reemplazada o detenida ya no puede emitir eventos.
- **El frontend es un renderizador.** La lógica pesada (emotes, normalización de canales, roles) va en Go.
- **Contrato del mensaje.** `chat.Message` usa campos en PascalCase y es el contrato con `frontend/src/types.ts`. No cambiar un lado sin el otro.
- **Eventos.** `chat_message`, `platform_started`, `platform_ended`, `platform_error` (fatal), `platform_warning` (recuperable) y `obs_status`. El payload de `platform_*` lleva `platform`.

### Agregar una plataforma

1. Paquete en `internal/platform/<nombre>` con un `Connector`.
2. Registrar el id en `internal/chat/message.go`, crear su `Manager` en `NewApp` y exponer `Start/Stop` en `app.go`.
3. Regenerar bindings: `wails generate module`.
4. Una entrada en `frontend/src/platforms.ts`, un adaptador en `hooks/usePlatforms.ts` y su icono en `PlatformIcon.tsx`.

## Frontend

- `useChat` solo compone: `usePlatforms` (estado con reducer puro), `useMessages` (feed), `useOBSConnection`.
- `useChat` es el único hook que habla con el backend sobre el chat.
- Las reglas puras viven en `utils/` y `state/` con tests (Vitest). Preferir lógica pura testeable sobre lógica dentro de hooks.
- Los settings son un schema declarativo (`config/settingsSchema.ts`); los defaults están en `SettingsContext.tsx` y el tipo `ChatSettings` en `types.ts` es la fuente de verdad.

## Verificación antes de dar algo por terminado

```bash
gofmt -l . ; go vet ./... ; go test ./...
cd frontend && npm test && npm run build
```

Tras cambiar un método de `App`: `wails generate module`. `go test -race` necesita cgo y un compilador C.

## Commits

No agregar `Co-Authored-By: Claude` en ningún commit.

## Historial

- La integración de TikTok se quitó; está completa en el tag `tiktok-beta` por si se retoma.
- La app se migró a Flutter; esta versión Go/React queda como referencia.
