# airchat — codebase understanding

airchat es una app de escritorio para Windows construida con **Wails v2** (Go + React/TypeScript). Su función es ser un **chat overlay** para streamers — muestra mensajes de múltiples plataformas en tiempo real, con soporte de TTS, emotes, donaciones y control de OBS.

---

## Stack

- **Backend**: Go (Wails v2) — lógica de negocio, conexiones a APIs, procesamiento de mensajes
- **Frontend**: React + TypeScript (Vite) — solo renderizado, no hace lógica pesada
- **Comunicación**: `runtime.EventsEmit` (Go → Frontend) y `window['go']['main']['App']` (Frontend → Go)
- **Plataforma**: Windows (usa `lxn/win` para click-through y manejo de ventana HWND)

---

## Arquitectura de plataformas

### Principio central

Cada plataforma de chat es **completamente autónoma**. Si una falla, las demás siguen funcionando. No hay estado compartido entre plataformas.

### Patrón de implementación (igual para las 3 plataformas)

Cada plataforma tiene en el struct `App`:
```go
// sus propios campos — nunca compartidos
xxxClient  *xxx.Client
xxxMu      sync.Mutex
xxxStop    chan struct{}   // o context.CancelFunc para Kick
```

**`StartXxx()`** — atomic swap:
1. Crea cliente nuevo + señal de stop nueva
2. `Lock → guarda old → asigna new → Unlock`
3. Limpia el old **fuera del lock** (para no bloquear lectores)
4. Lanza goroutine con `defer recover()` (captura panics sin caer toda la app)
5. Goroutine de stop: `<-sig → client.Disconnect()`
6. Error solo se emite si la señal NO está cerrada (distingue stop intencional de crash)

**`StopXxx()`** — mismo atomic swap al revés:
1. `Lock → saca client/stop → nil ambos → Unlock`
2. Cierra señal → llama Disconnect

### Eventos por plataforma

Cada plataforma emite sus propios eventos de ciclo de vida:
- `{platform}_started` — conexión exitosa
- `{platform}_ended` — desconexión limpia
- `{platform}_error` — error (no detiene las otras plataformas)

Y el evento unificado de mensajes: **`chat_message`** — con el campo `Platform` inyectado.

### Mensaje unificado

Todas las plataformas emiten el mismo shape al frontend:
```go
{
    "Platform":     "youtube" | "twitch" | "kick",
    "ID":           string,
    "Author":       { "Name", "ChannelID", "Thumbnail": { "URL", "Alt" } },
    "Message":      []{ "Text": string, "EmojiItem"?: { "URL", "Alt", "EmojiText", "IsCustomEmoji" } },
    "IsMembership": bool,
    "IsOwner":      bool,
    "IsModerator":  bool,
    "IsVerified":   bool,
    "Timestamp":    RFC3339,
    // solo YouTube:
    "SuperChat"?:   { "Amount", "Color" }  // Color = AARRGGBB hex sin #
}
```

---

## Plataformas

### YouTube (`github.com/DiegPS/youtube-chat`)
- Polling HTTP — no WebSocket
- Usa `StartChat(channelID)` / `StopChat()`
- Eventos: `chat_started`, `chat_ended`, `chat_error`
- Tiene SuperChats y membresías
- El color de SuperChat viene en formato AARRGGBB hex sin `#` → en el frontend se hace `#${color.slice(-6)}`

### Twitch (`github.com/gempir/go-twitch-irc/v3`)
- IRC anónimo — `twitch.NewAnonymousClient()` — sin OAuth
- `StartTwitchChat(channelName)` / `StopTwitchChat()`
- Eventos: `twitch_started`, `twitch_ended`, `twitch_error`
- No tiene avatares — el frontend usa iniciales con color determinístico por username (`nameToHue()`)
- **Emotes** (archivo `twitch_emotes.go`):
  - Nativos Twitch: vienen con posiciones exactas en el IRC message
  - Terceros: BTTV, FFZ, 7TV — se cargan async al conectar (`loadTwitchEmotes()`)
  - El mismo emote puede aparecer N veces en un mensaje → el IRC manda 1 entrada con N posiciones → se expanden en una lista plana ordenada por posición
  - Todo el parseo ocurre en Go → el frontend recibe `[]MessageItem` ya listo

### Kick (`github.com/DiegPS/kick-chat`)
- WebSocket Pusher anónimo — sin OAuth
- `StartKickChat(slug)` / `StopKickChat()`
- Eventos: `kick_started`, `kick_ended`, `kick_error`
- `JoinChannelBySlug(slug)` resuelve slug → chatroom ID via API pública de Kick (requiere headers de browser para evitar 403)
- Emotes vienen embebidos en el contenido: `[emote:37225:KEKLEO]` → URL: `https://files.kick.com/emotes/{id}/fullsize`
- No tiene avatares — mismo fallback de iniciales que Twitch
- Librería propia: `github.com/DiegPS/kick-chat`

---

## Archivos Go clave

| Archivo | Responsabilidad |
|---|---|
| `app.go` | App struct, todas las plataformas (Start/Stop), OBS, YouTube stats/search, preview |
| `twitch_emotes.go` | Fetch BTTV/FFZ/7TV, parseo de mensajes Twitch con emotes nativos + terceros |
| `kick_chat.go` | `parseKickMessage()` — convierte `[emote:id:name]` a `[]MessageItem`, `kickRoles()` — badges a flags |
| `main.go` | Wails bootstrap, registro de métodos expuestos al frontend |

---

## Frontend

### Estructura

```
src/
├── App.tsx                    — router, orquesta useChat + useTTS
├── pages/
│   ├── HomePage.tsx           — pantalla de setup
│   └── ChatPage.tsx           — pantalla de chat activo
├── components/
│   ├── SetupScreen.tsx        — inputs por plataforma (YouTube/Twitch/Kick), preview button
│   ├── PreviewArea.tsx        — renderizado de mensajes, avatares, emotes, SuperChats
│   ├── Sidebar.tsx            — panel de settings
│   └── SettingControl.tsx     — control dinámico según tipo (toggle, slider, select, etc.)
├── hooks/
│   ├── useChat.ts             — estado de todas las plataformas, eventos, startChat/stopChat
│   └── useTTS.ts              — cola de TTS, soporte browser y Supertonic
├── context/
│   └── SettingsContext.tsx    — estado global de configuración
├── config/
│   └── settingsSchema.ts      — schema declarativo de todos los settings (secciones + controles)
└── types.ts                   — ChatItem, MessageItem, ChatSettings, etc.
```

### Reglas del frontend

- **El frontend es un renderizador tonto** — toda la lógica pesada (parseo de emotes, resolución de IDs, etc.) va en Go
- `useChat.ts` es el único lugar que habla con el backend (EventsOn/Off + llamadas Go)
- `isActiveRef` controla si se aceptan eventos `chat_message` — solo cuando hay al menos una plataforma activa
- `isSetup = !isStarted && !isTwitchStarted && !isKickStarted && !isPreviewMode` — determina si se muestra HomePage o ChatPage

### Preview mode

`StartPreviewChat()` en Go emite mensajes hardcodeados con URLs reales de emotes. Sirve para probar el renderer end-to-end sin conectarse a ninguna plataforma. Los mensajes cubren YouTube (owner, mod, member, SuperChat) y Twitch (broadcaster, mod, sub con emotes BTTV/7TV, viewer sin foto).

### Settings

Los settings se definen en `settingsSchema.ts` como schema declarativo — secciones con items `{ key, label, type, options? }`. `SettingControl.tsx` renderiza el control adecuado según el tipo. Los valores default están en `SettingsContext.tsx`. El tipo `ChatSettings` en `types.ts` es la fuente de verdad de TypeScript.

---

## OBS

Conexión WebSocket a OBS Studio via `github.com/andreykaipov/goobs`. Monitoreo activo cada 1s: bitrate, FPS, drops, escena actual. Tiene su propio patrón atomic swap igual que las plataformas de chat. El frontend lo controla via settings (`obsEnabled`, `obsConnected`).

---

## Commits

No agregar `Co-Authored-By: Claude` en ningún commit.
