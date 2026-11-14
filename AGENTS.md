# AirChat codebase guide

## Purpose

AirChat is a Wails v2 desktop overlay that combines live chat from YouTube, Twitch, and Kick. The Go backend owns the native window, the network clients, the OBS connection, and the Wails events. The React/TypeScript frontend owns routing, settings, the combined feed, rendering, and TTS playback.

Keep this document synchronized with the implementation. Avoid line counts: the style, schema, and TTS files change frequently.

## Stack

### Backend

| Package | Role |
|---|---|
| `github.com/wailsapp/wails/v2` | Desktop runtime, bindings, events, window APIs |
| `github.com/DiegPS/youtube-chat` | YouTube live-chat observer (HTTP polling) |
| `github.com/gempir/go-twitch-irc/v3` | Anonymous Twitch IRC client |
| `github.com/DiegPS/kick-chat` | Kick chat client (Pusher WebSocket) and message parts |
| `github.com/andreykaipov/goobs` | OBS WebSocket v5 client |
| `github.com/lxn/win` | Windows click-through extended styles |

### Frontend

| Package | Role |
|---|---|
| React / React DOM 18 | UI |
| React Router DOM 7 | `HashRouter` routes |
| ONNX Runtime Web | Supertonic 2/3 inference via WASM |
| `fft.js` | Supertonic audio processing |
| Vite 7 / TypeScript 5.6 | build |
| Vitest 5 | unit tests |

ONNX Runtime is loaded from `frontend/public/ort.min.js`; the matching WASM files are vendored under `frontend/public/`.

## Source layout

```text
airchat/
├── main.go                         Wails entry point and window options
├── app.go                          thin Wails facade: bound methods only
├── internal/
│   ├── chat/                       message model, Sink, Manager, input normalization
│   ├── platform/
│   │   ├── youtube/                input parsing + Connector
│   │   ├── twitch/                 Connector + native/BTTV/FFZ/7TV emote parser
│   │   └── kick/                   Connector + badge/emote mapping
│   ├── obs/                        Controller (connection, audio) + status sampler
│   ├── preview/                    sample messages for design preview
│   └── window/                     Windows click-through
├── wails.json
├── go.mod / go.sum
├── build/                          icons, installer assets, platform metadata
└── frontend/
    ├── public/                     ONNX Runtime JS/WASM assets
    ├── wailsjs/                    generated Wails bindings
    └── src/
        ├── App.tsx                 providers, routes, navigation, Ctrl+B
        ├── platforms.ts            the list of platforms (single source of truth)
        ├── types.ts                chat and settings interfaces
        ├── state/                  pure reducers (+ tests)
        ├── utils/                  filters, message handling, TTS rules (+ tests)
        ├── hooks/                  usePlatforms, useMessages, useOBSConnection, useChat,
        │                           useTTS, useTTSProviderReset, useOBSAudio, supertonic2/
        ├── components/             SetupScreen, Sidebar, PreviewArea, StreamHUD,
        │                           TitleBar, SettingControl, PlatformIcon
        ├── pages/                  HomePage (`/`), ChatPage (`/chat`)
        ├── context/SettingsContext.tsx
        └── config/settingsSchema.ts
```

## Backend design

### Dependency direction

`main` -> `app.go` -> `internal/*`. Packages under `internal/platform` depend on `internal/chat`, never on each other or on `main`. `internal/chat` depends on no platform library.

### `internal/chat`

- `Message` is the unified message and the frontend contract. Field names are PascalCase and must not change without updating `frontend/src/types.ts`.
- `Connector` opens a `Session` for one platform: `Platform()` and `Connect(ctx, input, sink)`.
- `Session` is one live connection: `Run(ctx)` blocks until it ends; `Close()` is idempotent.
- `Sink` is how a session reports: `Message`, `Started(detail)`, `Warning(err)`.
- `Manager` owns the single active session of one platform. `Start` connects first and only then swaps the session in (a failed connect never replaces a working one); the old session is closed outside the lock. A session that was replaced or stopped can no longer emit. A panic inside `Run` becomes an error event. Platforms never share state.

### Adding a platform

1. Add a package under `internal/platform/<name>` with a `Connector`.
2. Add the platform id in `internal/chat/message.go`, build its manager in `NewApp`, and expose `Start<Name>Chat` / `Stop<Name>Chat` in `app.go`.
3. Regenerate bindings (`wails generate module`).
4. Add one entry to `frontend/src/platforms.ts` and one adapter in `hooks/usePlatforms.ts`; add its icon in `PlatformIcon.tsx`.

### Bound methods (`app.go`)

- `StartChat(input)` / `StopChat()`: YouTube. Accepts `@handle`, `UC...` channel ID, 11-character video ID, and watch/live/youtu.be/channel URLs.
- `StartTwitchChat(channel)` / `StopTwitchChat()`: anonymous IRC; accepts a name, `@name`, or URL.
- `StartKickChat(slug)` / `StopKickChat()`: accepts a name, `@name`, or URL.
- `StartPreviewChat()`: emits sample messages for all platforms through `chat_message`.
- `ConnectOBS(host, password)` / `DisconnectOBS()`, `GetOBSAudioInputs()`, `SetOBSInputMute()`, `SetOBSInputVolume()`.
- `SetClickThrough(enabled)`: toggles `WS_EX_LAYERED | WS_EX_TRANSPARENT`.
- `shutdown` (Wails `OnShutdown`) stops every session and the OBS monitor.

### Event contract

| Event | Payload |
|---|---|
| `chat_message` | `Message` (PascalCase) |
| `platform_started` | `{ platform, detail? }` (YouTube live ID, channel) |
| `platform_ended` | `{ platform, detail? }` |
| `platform_error` | `{ platform, message }`: fatal, the session is unusable |
| `platform_warning` | `{ platform, message }`: recoverable, the session keeps running |
| `obs_status` | `Status` (lower camelCase JSON) |

`platform` is `youtube`, `twitch`, or `kick`. OBS JSON fields are lower camel case.

### OBS monitor

`internal/obs` polls once per second. The pure `sampler` turns raw readings into bitrate and dropped-frame percentage from deltas and assigns:

- `GRAY`: output inactive.
- `RED`: reconnecting, or drop percentage at least 2%.
- `YELLOW`: drop percentage at least 0.5%, or no output-byte progress after a baseline exists.
- `GREEN`: otherwise healthy.

A counter reset (restarted stream) drops the baseline. Monitoring stops on disconnect and when the app context ends.

## Frontend design

### Routing and window behavior

`App.tsx` uses `HashRouter`: `/` is the setup screen while nothing is active; `/chat` is the overlay while any platform or the preview is active. `Ctrl+B` is active only off the setup screen; it hides or shows the UI and calls `SetClickThrough` with the inverse visibility. The title bar separately toggles the sidebar and always-on-top.

### State

- `platforms.ts` defines every platform (label, hint, placeholder, storage key, pulse class).
- `usePlatforms` owns what the user typed (persisted under each `storageKey`), connection state through the pure `platformsReducer`, and starting/stopping all platforms. It subscribes to the four `platform_*` events.
- `useMessages` owns the feed: it subscribes to `chat_message`, validates (`sanitizeIncoming`), drops blocked messages, deduplicates by `(Platform, ID)`, enforces `maxMessages`, and autoscrolls. `open()` flips the accept gate synchronously so the first messages of a session are not lost.
- `useOBSConnection` keeps the OBS connection in sync with the OBS settings.
- `useChat` only composes these plus the design preview. It is the only hook that talks to the backend about chat.

### Rendering

`PreviewArea` renders the unified feed with platform icons, fallback avatars (initials, deterministic color), role labels, native/custom emotes, YouTube Super Chats and stickers, and membership events. Visual settings cover bubbles, the Super Chat bar, chroma key, text effects, animations, and 3D transforms.

### Settings

`SettingsContext` lazily merges saved values with defaults, sanitizes unsupported TTS providers, and persists to `AIRCHAT_SETTINGS`. `settingsSchema.ts` is declarative and supports conditional sections and controls. The `ChatSettings` type in `types.ts` is the source of truth for settings.

### Filtering

`utils/filters.ts` has the comma-list parsing and case-insensitive matching. `utils/messages.ts` (`isBlocked`) applies them to a message and is used by both the feed and TTS.

### TTS

`utils/tts.ts` (`speechTextFor`) is the pure rule set: blocked users/words, members-only with allowlist, command prefix, URL replacement, username cleanup, separator. `useTTS` owns the playback: a FIFO queue capped at 20, ignoring messages older than TTS activation, deduplicating processed IDs, and dispatching to a provider. It subscribes to `chat_message` once and reads the latest settings from a ref.

Providers: browser Speech Synthesis, Supertonic 2 (`supertonic`), Supertonic 3 (`supertonic3`). Both neural generations use the ONNX WASM provider; do not describe a WebGPU fallback unless the implementation changes. Model assets come from the selected Hugging Face repository and use distinct Cache API names. Supertonic 2 supports `en`, `ko`, `es`, `pt`, `fr`; Supertonic 3 uses `SUPERTONIC3_LANGS`. Voice styles are `M1.json`-`M5.json` and `F1.json`-`F5.json`.

## Development workflow

```bash
wails dev
wails build

go vet ./...
go test ./...

cd frontend
npm install
npm test          # vitest
npm run build     # tsc && vite build
```

### Generated files

`frontend/wailsjs/` is generated from the exported methods of `App`. After changing a bound method, run `wails generate module` instead of editing it by hand. `frontend/dist/` and `build/bin/` are build artifacts.

### Verification expectations

- Go changes: `gofmt`, `go vet ./...`, `go test ./...`.
- Frontend changes: `npm test` and `npm run build` in `frontend`.
- Cross-boundary changes: both, plus regenerate bindings and check the signatures.
- Visual changes: exercise setup, preview, `/chat`, sidebar hiding, and `Ctrl+B` in `wails dev`.
- Platform changes: one failing platform must not affect the others, and every payload must keep the unified shape.

The race detector (`go test -race`) needs cgo and a C compiler (for example MinGW on Windows).

## Persistence and external resources

- Settings: `AIRCHAT_SETTINGS`.
- Last platform inputs: `airchat_last_youtube`, `airchat_last_twitch`, `airchat_last_kick`.
- Supertonic caches: `supertonic-2-models-v1`, `supertonic-3-models-v1`.
- Network: the selected chat services, OBS WebSocket, Twitch third-party emote APIs and CDNs, and Hugging Face for uncached neural model assets.
