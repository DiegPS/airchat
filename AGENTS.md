# AirChat codebase guide

## Purpose

AirChat is a Wails v2 desktop overlay that combines live chat from YouTube, Twitch, Kick, and TikTok LIVE. The Go backend owns the native window, network clients, OBS connection, and Wails events. The React/TypeScript frontend owns routing, settings, the combined feed, filtering, rendering, TikTok diagnostics, and TTS playback.

Keep this document synchronized with the implementation. Avoid line counts: the large style, schema, and TTS files change frequently.

## Stack

### Backend

| Package | Current role |
|---|---|
| `github.com/wailsapp/wails/v2` | Desktop runtime, binding, events, and window APIs |
| `github.com/DiegPS/youtube-chat` | YouTube live-chat observer |
| `github.com/gempir/go-twitch-irc/v3` | Anonymous Twitch IRC client |
| `github.com/DiegPS/kick-chat` | Kick chat client and message parts |
| `github.com/PirateTok/live-go` | TikTok LIVE room resolution, WebSocket events, protobufs, gifts, and metadata |
| `github.com/andreykaipov/goobs` | OBS WebSocket v5 client |
| `github.com/lxn/win` | Windows click-through extended styles |

The module currently declares Go `1.26.1` and Wails `2.12.0` in `go.mod`.

### Frontend

| Package | Current role |
|---|---|
| React / React DOM 18 | UI and state composition |
| React Router DOM 7 | `HashRouter` routes |
| ONNX Runtime Web 1.17 | Supertonic 2/3 inference via WASM |
| `fft.js` 4 | Supertonic audio processing |
| Vite 7 / TypeScript 5.9 | development and production build |

ONNX Runtime is loaded from `frontend/public/ort.min.js`; the matching WASM files are also vendored under `frontend/public/`.

## Source layout

```text
airchat/
├── main.go                          Wails entry point and window configuration
├── app.go                           App state, preview, OBS, platform sessions, events
├── kick_chat.go                     Kick message-part and badge helpers
├── tiktok_chat.go                   TikTok lifecycle, event conversion, metrics, metadata
├── tiktok_chat_test.go              exhaustive event/conversion/session tests
├── twitch_emotes.go                 BTTV/FFZ/7TV fetch and Twitch emote parser
├── wails.json                       Wails commands and package metadata
├── go.mod / go.sum                  Go module definition
├── build/                           platform metadata, icons, installer assets
└── frontend/
    ├── public/                      ONNX Runtime JS/WASM assets
    ├── wailsjs/                     generated Wails bindings
    └── src/
        ├── App.tsx                  providers, routes, navigation, shortcut
        ├── types.ts                 unified chat and settings interfaces
        ├── App.css / style.css      application and global styles
        ├── pages/
        │   ├── HomePage.tsx         setup route `/`
        │   └── ChatPage.tsx         overlay route `/chat`
        ├── components/
        │   ├── SetupScreen.tsx      four-platform inputs and TikTok connection options
        │   ├── Sidebar.tsx          schema-driven settings and session status
        │   ├── PreviewArea.tsx      unified message renderer
        │   ├── StreamHUD.tsx        OBS status and audio controls
        │   ├── TitleBar.tsx         native window and sidebar controls
        │   ├── SettingControl.tsx   polymorphic setting controls and TTS test
        │   └── TikTokEventInspector.tsx structured status/event/export panel
        ├── hooks/
        │   ├── useChat.ts           platform lifecycle, events, filtering, OBS
        │   ├── useTTS.ts            bounded TTS queue and provider dispatch
        │   ├── useOBSAudio.ts       OBS audio polling and mutations
        │   └── supertonic2/
        │       ├── helper.ts        model loading, preprocessing, inference, WAV
        │       ├── useSupertonic.ts shared Supertonic 2/3 resources and hook
        │       └── index.ts         exports
        ├── context/SettingsContext.tsx
        ├── config/settingsSchema.ts
        └── utils/                   shared filters plus TikTok visibility/rate-limit helpers
```

## Backend design

### `main.go`

- Embeds `frontend/dist`.
- Creates a frameless 1024x768 window with a transparent background.
- Enables transparent/translucent webviews for Windows and macOS.
- Binds one `App` instance and calls `app.startup`.

### `App` ownership and locking

`App` keeps independent state for:

- YouTube: `lc`, `lcMu`, `stopSignal`.
- Twitch: `twitchClient`, `twitchMu`, `twitchStop`, and a separately locked global-emote map.
- Kick: `kickClient`, `kickMu`, `kickCancel`.
- TikTok: `tiktokCancel`, `tiktokGeneration`, and `tiktokMu`; generation checks reject late events from a stopped/replaced socket.
- OBS: `obsClient`, `obsStop`, protected by `obsClientMu`.
- Native window: Wails context and Windows `HWND`.

Do network calls and disconnect cleanup outside locks where practical. Session replacement swaps the protected pointers/signals first, then cleans up the previous client.

### Bound backend methods

- `StartChat(youtubeInput)` / `StopChat()` manage YouTube. Inputs support handles, channel IDs, bare video IDs, and supported YouTube URLs.
- `StartTwitchChat(channelName)` / `StopTwitchChat()` use anonymous IRC and emit role flags. Global BTTV, FFZ, and 7TV emotes load asynchronously after connection; native Twitch emotes use IRC positions.
- `StartKickChat(slug)` / `StopKickChat()` convert Kick message parts and badges to the common payload.
- `StartTikTokChat(input, options)` / `StopTikTokChat()` consume every `live-go` event type, manage reconnect/end state, and convert renderable events to the common payload.
- `CheckTikTokLive(input, timeoutSeconds)` and `GetTikTokRoomInfo(roomID, timeoutSeconds, cookies)` expose room resolution and metadata/stream information.
- `StartPreviewChat()` emits representative mock messages for all four platforms and every TikTok category through `chat_message`/`tiktok_event`.
- `ConnectOBS(host, password)` / `DisconnectOBS()` manage OBS.
- `GetOBSAudioInputs()`, `SetOBSInputMute()`, and `SetOBSInputVolume()` expose special Mic/Aux and Desktop inputs.
- `SetClickThrough(enabled)` toggles `WS_EX_LAYERED | WS_EX_TRANSPARENT` on Windows.

### Event contract

All chat sources emit `chat_message` with the `ChatItem` shape and a `Platform` value of `youtube`, `twitch`, `kick`, or `tiktok`.

Lifecycle events:

| Platform/service | Events |
|---|---|
| YouTube | `chat_started`, `chat_error`, `chat_ended` |
| Twitch | `twitch_started`, `twitch_error`, `twitch_ended` |
| Kick | `kick_started`, `kick_error`, `kick_ended` |
| TikTok | `tiktok_started`, `tiktok_reconnecting`, `tiktok_status`, `tiktok_metrics`, `tiktok_event`, `tiktok_error`, `tiktok_ended` |
| OBS | `obs_status` |

The normalized chat payload includes `ID`, `Platform`, `Author`, `Message`, optional `SuperChat`, optional TikTok `Gift`, `TikTokEvent`, `TikTokUser`, and `UpdateExisting`, role booleans, and `Timestamp`. Preserve PascalCase chat fields because the frontend interfaces and upstream YouTube objects use that contract. TikTok lifecycle/event and OBS JSON fields are lower camel case.

`tiktok_event` is exhaustive: every enum in `live-go/events.EventType` has an explicit name/category. Known protobufs are exported as safe JSON; `EventUnknown` preserves the method and Base64 payload for diagnostic export. Advanced categories can be hidden from bubbles without being discarded from the inspector. Gifts use `GiftStreakTracker`, so active combo updates replace one stable feed item and TTS reads only the final total.

### OBS monitor

`monitorOBS` polls once per second. It calculates bitrate and dropped-frame percentage from deltas, reports active FPS/current scene/congestion, and assigns:

- `GRAY`: output inactive.
- `RED`: reconnecting or drop percentage at least 2%.
- `YELLOW`: drop percentage at least 0.5%, or no output-byte progress after a baseline exists.
- `GREEN`: otherwise healthy.

## Frontend design

### Routing and window behavior

`App.tsx` uses `HashRouter`:

- `/`: setup while no platform and no preview are active.
- `/chat`: combined overlay when any platform or preview is active.

The setup accepts any combination of platforms. `startChat` starts requested platforms concurrently, and each has independent status/error state. TikTok accepts a name, `@name`, or profile/LIVE URL and exposes all `live-go` connection options before connect. `Ctrl+B` is active only off the setup screen; it hides/shows the UI and calls `SetClickThrough` with the inverse visibility. The title bar separately toggles sidebar visibility and always-on-top state.

### `useChat`

- Persists last inputs under `airchat_last_youtube`, `airchat_last_twitch`, `airchat_last_kick`, and `airchat_last_tiktok`.
- Normalizes Twitch/Kick names from plain names, `@name`, or URLs.
- Subscribes to all chat lifecycle events plus `obs_status`.
- Validates incoming payloads, applies blocked-user/word and TikTok role/level/category filters, deduplicates by `(Platform, ID)`, updates gift combos in place, rate-limits joins/metrics, enforces `maxMessages`, and autoscrolls.
- Starts/stops all selected chat sources and clears combined state on disconnect.
- Reacts to OBS settings by connecting/disconnecting the backend.

### Rendering

`PreviewArea` renders a unified feed with platform icons, fallback avatars, role labels, native/custom emotes, YouTube Super Chats/stickers, TikTok gifts/combos and advanced event metadata, membership/subscription events, and timestamps. Twitch, Kick, and TikTok can use platform accent colors. `TikTokEventInspector` displays status, metrics, structured data, unknown payload diagnostics, and JSON export. Visual settings also cover bubbles, Super Chat bar, chroma key, grid/scrollbar, text effects, animations, and 3D transforms.

### Settings

`SettingsContext` lazily merges saved values with defaults, sanitizes unsupported TTS providers, and persists to `AIRCHAT_SETTINGS`. TikTok session cookies are runtime-only: initialization and every persistence write erase that field. `settingsSchema.ts` is declarative and supports conditional sections/controls.

Current sections include:

1. Overlay Mode
2. Platform Display
3. Style Settings
4. TikTok LIVE (visibility, categories, role/level filters, flow control, diagnostics, connection)
5. Message Design
6. Animation
7. 3D Transform
8. OBS Integration
9. HUD Settings
10. Filters
11. Text to Speech (TTS)

Supported control types include toggle, range, color, select, text, password, textarea, number, button, browser voice select, Supertonic status, and TTS test.

### Filtering

`utils/filters.ts` defines shared comma-list parsing and case-insensitive matching. `useChat` filters before adding messages to the feed. `useTTS` applies the same checks because it subscribes directly to backend events.

### TTS

`useTTS` has a FIFO queue capped at 20 entries (oldest pending entry is dropped when full). It ignores old messages that predate TTS activation, deduplicates processed IDs, removes/replaces URLs, cleans usernames, and supports:

- Browser Speech Synthesis.
- Supertonic 2 (`ttsProvider: supertonic`).
- Supertonic 3 (`ttsProvider: supertonic3`).
- members/subscribers-only mode with optional username allowlist.
- command-prefix mode, separator text, random voice, and voice test.
- independent TikTok gift/activity/advanced-event controls; active gift combos are spoken once at finalization.

The neural hook loads only when TTS is enabled and a Supertonic provider is selected. Both model generations currently force the ONNX WASM execution provider; do not describe WebGPU fallback unless the implementation changes. Model assets come from the selected Hugging Face repository and use distinct Cache API names. Inactive model resources are released when switching between Supertonic 2 and 3.

Supertonic 2 supports `en`, `ko`, `es`, `pt`, and `fr`. Supertonic 3 exposes the larger language list declared in `SUPERTONIC3_LANGS`. Both expose voice styles `M1.json`-`M5.json` and `F1.json`-`F5.json`.

## Development workflow

```bash
wails dev
wails build
go test ./...

cd frontend
npm install
npm run dev
npm run build
npm test
```

`npm run build` runs `tsc && vite build`. Wails also uses `npm install` and `npm run build` through `wails.json`.

### Generated files

`frontend/wailsjs/` is generated from the exported Go methods. When a bound method changes, regenerate bindings through Wails rather than hand-maintaining them. Treat `frontend/dist/`, `airchat.exe`, and packaged output as build artifacts even if an artifact is present in the working tree.

### Verification expectations

- For Go/backend changes: run `go test ./...` (and `gofmt` on modified `.go` files).
- For frontend changes: run `npm run build` from `frontend`.
- For TikTok routing/settings changes: run `npm test` from `frontend` in addition to Go tests.
- For cross-boundary changes: run both and verify the generated Wails bindings expose the exact method signatures.
- For visual changes: exercise setup, preview, `/chat`, sidebar hiding, and `Ctrl+B` in `wails dev`.
- For platform changes: ensure one failed platform does not stop the others and all payloads retain the unified shape.

## Persistence and external resources

- Settings: `AIRCHAT_SETTINGS`.
- Last platform inputs: the four `airchat_last_*` keys above.
- TikTok session cookies: memory only, never `localStorage`.
- Supertonic caches: `supertonic-2-models-v1`, `supertonic-3-models-v1`.
- Runtime network dependencies include the selected chat services, TikTok LIVE/metadata endpoints, OBS WebSocket, Twitch third-party emote APIs/CDNs, and Hugging Face for uncached neural model assets.
