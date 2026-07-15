# AirChat

AirChat is a transparent, frameless desktop chat overlay for **YouTube Live, Twitch, Kick, and TikTok LIVE**. It is built with Wails v2 (Go backend and React/TypeScript frontend), can merge several live chats into one feed, integrates with OBS WebSocket, and includes browser and neural text-to-speech.

## Features

### Multi-platform chat

- Connect any combination of YouTube, Twitch, Kick, and TikTok LIVE chats at the same time.
- YouTube accepts an `@handle`, a `UC...` channel ID, an 11-character video ID, or a YouTube watch/live/short URL.
- Twitch and Kick accept a channel name, `@name`, or a channel URL.
- All platforms are normalized into one `chat_message` event and one overlay feed.
- Twitch supports native emotes plus global BTTV, FrankerFaceZ, and 7TV emotes.
- Kick messages include emotes and broadcaster, moderator, subscriber, and verified roles.
- TikTok accepts a username, `@username`, or profile/LIVE URL. It renders chat, indexed and emote-only messages, gifts and combos, subscriptions, follows, shares, joins, questions, and configurable advanced events.
- Every event type exposed by `PirateTok/live-go` is retained in the structured TikTok event inspector; unknown methods include a safe Base64 diagnostic export instead of being silently discarded.
- TikTok provides live viewer/like metrics, creator/room metadata, role and gifter/fan-club filters, per-category visibility, rate limits, and full advanced connection controls.
- The last value entered for each platform is saved locally.

### Overlay and moderation

- Configurable bubbles, opacity, avatars, role badges, platform icons, timestamps, alignment, spacing, and message limit.
- YouTube Super Chat styling, including stickers and an optional accent bar.
- Optional platform-specific YouTube, Twitch, Kick, and TikTok bubble accents.
- Entrance animations, text outline and shadow, chroma key, and 3D transforms.
- Comma-separated blocked-user and blocked-word filters are applied before display and TTS.
- Preview mode sends representative messages through the same backend event pipeline used by live chat. TikTok core examples are built from `live-go` protobufs and decoded by the library instead of using hand-written frontend payloads.

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
- Node.js **20.19+ or 22.12+** and npm, as required by Vite 7; TypeScript 5.9 is used for builds.
- Wails v2 CLI
- Windows is required for the current click-through implementation (`github.com/lxn/win`); transparent-window options are also configured for macOS.
- OBS Studio with OBS WebSocket enabled is optional.
- Internet access is required for live chat, TikTok metadata, third-party Twitch emotes, and initial Supertonic model downloads.

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
go test ./...

cd frontend
npm run build
```

Build the desktop application with:

```bash
wails build
```

Wails writes packaged build output under `build/bin/`.

## Usage

1. Enter at least one platform channel on the setup screen. Any combination of YouTube, Twitch, Kick, and TikTok is valid. TikTok connection options can be expanded before connecting.
2. Select **Connect chats**, or use **Preview design** to test the overlay without a live channel.
3. Configure display, filters, OBS, HUD, and TTS from the sidebar.
4. Press `Ctrl+B` to switch between interactive UI and click-through overlay mode.
5. Use **Disconnect** to stop every active platform and clear the current feed.

## Architecture

```text
YouTube observer ─┐
Twitch IRC ───────┼─> Go adapters ─> Wails chat_message event ─> React feed ─> overlay/TTS
Kick client ──────┤
TikTok live-go ───┘

OBS WebSocket ──────> Go monitor/audio methods ─> obs_status event + HUD controls
Settings UI ─────────> React Context ─> localStorage (AIRCHAT_SETTINGS)
```

The backend keeps independent sessions for each chat platform so one platform can fail or stop without directly terminating the others. `useChat` owns the combined frontend feed, deduplication, filtering, message limits, platform state, OBS state, and navigation. `useTTS` subscribes separately to the unified chat event and manages its bounded speech queue.

## Project structure

```text
airchat/
├── main.go                         Wails entry point and transparent window options
├── app.go                          chat orchestration, OBS, preview, and click-through
├── kick_chat.go                    Kick message/role conversion helpers
├── tiktok_chat.go                  TikTok lifecycle, exhaustive event routing, gifts, metadata
├── twitch_emotes.go                Twitch native and third-party emote parsing
├── go.mod / go.sum                 Go dependencies
├── wails.json                      Wails build configuration
├── build/                          platform metadata, icons, installer assets, output
└── frontend/
    ├── package.json                React/Vite dependencies and scripts
    ├── public/                     ONNX Runtime browser assets
    └── src/
        ├── App.tsx                 providers, hash routes, and Ctrl+B behavior
        ├── components/             setup, sidebar, overlay, HUD, title bar, controls
        ├── config/settingsSchema.ts
        ├── context/SettingsContext.tsx
        ├── hooks/                  chat, OBS audio, TTS, and Supertonic hooks
        ├── pages/                  setup and chat routes
        ├── utils/filters.ts        shared user/word filters
        ├── utils/tiktok.ts         TikTok visibility, audience filters, rate limits, combo merge
        └── types.ts                unified chat and settings types
```

## Settings and local data

- Main settings: `AIRCHAT_SETTINGS`
- Last YouTube input: `airchat_last_youtube`
- Last Twitch channel: `airchat_last_twitch`
- Last Kick channel: `airchat_last_kick`
- Last TikTok username: `airchat_last_tiktok`
- TikTok session cookies are runtime-only and are deliberately erased from persisted settings.
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

### TikTok does not connect

- Confirm the creator is currently LIVE and that the username/URL is correct.
- Public rooms normally need no login. Restricted rooms may require session cookies in TikTok advanced connection settings; those cookies stay in memory and are not saved.
- The `live-go` WebSocket proxy path is reliably implemented for HTTP `CONNECT`; SOCKS5 and HTTPS proxy behavior is an upstream limitation.
- The inspector and sidebar distinguish room resolution, first WebSocket traffic, reconnect attempts, LIVE end, and terminal disconnect. Some terminal WebSocket causes are logged internally by `live-go` without exposing the exact error to consumers.

## Author

Diego Pahua Silvan — [@DiegPS](https://github.com/DiegPS) — dpahuas@gmail.com
