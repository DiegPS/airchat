# AirChat

AirChat is a transparent, frameless desktop chat overlay for **YouTube Live, Twitch, and Kick**. It is built with Wails v2 (Go backend and React/TypeScript frontend), can merge several live chats into one feed, integrates with OBS WebSocket, and includes browser and neural text-to-speech.

## Features

### Multi-platform chat

- Connect any combination of YouTube, Twitch, and Kick chats at the same time.
- YouTube accepts an `@handle`, a `UC...` channel ID, an 11-character video ID, or a YouTube watch/live/short URL.
- Twitch and Kick accept a channel name, `@name`, or a channel URL.
- All platforms are normalized into one `chat_message` event and one overlay feed.
- Twitch supports native emotes plus global BTTV, FrankerFaceZ, and 7TV emotes.
- Kick messages include emotes and broadcaster, moderator, subscriber, and verified roles.
- The last value entered for each platform is saved locally.

### Overlay and moderation

- Configurable bubbles, opacity, avatars, role badges, platform icons, timestamps, alignment, spacing, and message limit.
- YouTube Super Chat styling, including stickers and an optional accent bar.
- Platform-specific Twitch and Kick bubble accents.
- Entrance animations, text outline and shadow, chroma key, and 3D transforms.
- Comma-separated blocked-user and blocked-word filters are applied before display and TTS.
- Preview mode sends representative YouTube, Twitch, and Kick messages through the same backend event pipeline used by live chat.

### OBS integration

- Connects to OBS WebSocket (default `localhost:4455`).
- Polls stream state, bitrate, FPS, dropped-frame percentage, congestion, and current scene.
- Displays a configurable four-corner HUD with green/yellow/red/gray health states.
- Controls mute and volume for OBS special microphone and desktop inputs.

### Text-to-speech

- Browser Speech Synthesis with installed-voice selection.
- Supertonic 2 and Supertonic 3 neural TTS, executed through ONNX Runtime Web's WASM backend.
- Ten voice styles (`M1`-`M5`, `F1`-`F5`), language selection, quality steps, speed, and a voice test.
- Supertonic 2 supports English, Korean, Spanish, Portuguese, and French; Supertonic 3 exposes its larger multilingual language set in the settings panel.
- Queueing, random voice, members/subscribers-only mode, an allowlist override, command-prefix mode, URL replacement, and username cleanup.
- Neural models are fetched from the corresponding `Supertone/supertonic-2` or `Supertone/supertonic-3` Hugging Face repository when that provider is enabled, then cached by the webview Cache API.

### Desktop window

- Transparent 1024x768 frameless window with custom minimize, maximize, close, always-on-top, and sidebar controls.
- `Ctrl+B` hides/shows the UI while a chat or preview is active and toggles Windows click-through mode.

## Requirements

- Go **1.26.1 or newer**, matching `go.mod`
- Node.js **20.19+ or 22.12+** and npm (Vite 7, TypeScript 5.6, Vitest 5)
- Wails v2 CLI
- Windows is required for the current click-through implementation (`github.com/lxn/win`); transparent-window options are also configured for macOS.
- OBS Studio with OBS WebSocket enabled is optional.
- Internet access is required for live chat, third-party Twitch emotes, and initial Supertonic model downloads.

Install Wails if needed:

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

## Development

```bash
git clone https://github.com/DiegPS/airchat.git
cd airchat

cd frontend
npm install
cd ..

wails dev
```

Useful verification commands:

```bash
go vet ./...
go test ./...

cd frontend
npm test
npm run build
```

Build the desktop application with:

```bash
wails build
```

Wails writes packaged build output under `build/bin/`.

## Usage

1. Enter at least one platform channel on the setup screen. Any combination of YouTube, Twitch, and Kick is valid.
2. Select **Connect chats**, or use **Preview design** to test the overlay without a live channel.
3. Configure display, filters, OBS, HUD, and TTS from the sidebar.
4. Press `Ctrl+B` to switch between interactive UI and click-through overlay mode.
5. Use **Disconnect** to stop every active platform and clear the current feed.

## Architecture

```text
YouTube ─┐
Twitch ──┼─> internal/platform/* Connectors ─> chat.Manager ─> chat_message / platform_* events
Kick ────┘                                                        │
                                                                  v
                                        React: usePlatforms + useMessages ─> overlay / TTS

OBS WebSocket ─> internal/obs Controller ─> obs_status event ─> HUD and audio controls
Settings UI ──> React Context ─> localStorage (AIRCHAT_SETTINGS)
```

Each chat platform has its own `Manager`, so one platform can fail or stop without affecting the others. A platform is a `Connector` that opens a `Session`; the `Manager` handles starting, replacing, stopping, and error reporting in one place. Every platform emits the same unified `Message`.

On the frontend, `platforms.ts` lists the platforms, `usePlatforms` tracks their connection state, `useMessages` owns the feed (validation, filtering, deduplication, limits), and `useTTS` subscribes separately to the unified chat event and manages its bounded speech queue. See `AGENTS.md` for the full technical guide, including how to add a platform.

## Project structure

```text
airchat/
├── main.go                  Wails entry point and window options
├── app.go                   thin Wails facade: bound methods only
├── internal/
│   ├── chat/                unified message, Manager, input normalization
│   ├── platform/            youtube/, twitch/, kick/ connectors
│   ├── obs/                 OBS connection, audio, stream status
│   ├── preview/             sample messages for the design preview
│   └── window/              Windows click-through
├── go.mod / go.sum          Go dependencies
├── wails.json               Wails build configuration
├── build/                   icons, installer assets, platform metadata
└── frontend/
    ├── package.json         React/Vite dependencies and scripts
    ├── public/              ONNX Runtime browser assets
    └── src/
        ├── platforms.ts     the list of supported platforms
        ├── state/           pure reducers
        ├── utils/           filters, message handling, TTS rules
        ├── hooks/           platforms, messages, OBS, TTS, Supertonic
        ├── components/      setup, sidebar, overlay, HUD, title bar, controls
        ├── pages/           setup and chat routes
        ├── context/         settings
        ├── config/          declarative settings schema
        └── types.ts         unified chat and settings types
```

## Settings and local data

- Main settings: `AIRCHAT_SETTINGS`
- Last YouTube input: `airchat_last_youtube`
- Last Twitch channel: `airchat_last_twitch`
- Last Kick channel: `airchat_last_kick`
- Supertonic model caches: `supertonic-2-models-v1` and `supertonic-3-models-v1`

## Troubleshooting

### OBS does not connect

- Enable the OBS WebSocket server under **Tools > WebSocket Server Settings**.
- Verify the host (normally `localhost:4455`) and password.
- The HUD only appears after an `obs_status` payload reports a connected client.

### Supertonic does not speak

- Enable TTS and select Supertonic 2 or 3; models are not loaded while neural TTS is disabled.
- Allow the initial Hugging Face download to finish and check the Supertonic status control.
- The current implementation uses WASM, so ensure the files under `frontend/public/` are packaged and accessible.

### Click-through does not work

- The native style toggle is Windows-specific and uses `WS_EX_LAYERED` and `WS_EX_TRANSPARENT`.
- `Ctrl+B` is intentionally disabled on the setup route.

## Author

Diego Pahua Silvan — [@DiegPS](https://github.com/DiegPS) — dpahuas@gmail.com
