# AirChat - Codebase Documentation

## Overview

**AirChat** is a desktop application built with **Wails v2** (Go backend + React/TypeScript frontend) that serves as a **YouTube Live Chat Overlay** with OBS integration and Text-to-Speech capabilities. It provides a transparent, frameless window that can be placed over streaming software like OBS.

## Tech Stack

### Backend (Go)
| Package | Purpose |
|---|---|
| `wailsapp/wails/v2` | Desktop app framework |
| `DiegPS/youtube-chat` | YouTube live chat observation |
| `andreykaipov/goobs` | OBS WebSocket integration |
| `lxn/win` | Windows API (click-through, window styles) |

### Frontend (TypeScript/React)
| Package | Purpose |
|---|---|
| `react` 18, `react-dom` 18 | UI framework |
| `react-router-dom` 7 | Hash-based routing |
| `onnxruntime-web` 1.17 | Neural TTS inference (WebGPU/WASM) |
| `fft.js` 4 | Audio processing |
| `vite` 3 | Build tool |

## Project Structure

```
airchat/
├── main.go                          # Wails entry point (window config)
├── app.go                           # Backend logic (YouTube, OBS, window control)
├── wails.json                       # Wails project configuration
├── go.mod / go.sum                  # Go module dependencies
├── build/                           # Build artifacts (icons, installers)
└── frontend/
    ├── package.json                 # Frontend dependencies
    ├── vite.config.ts               # Vite configuration
    ├── tsconfig.json                # TypeScript configuration
    └── src/
        ├── App.tsx                  # Router + main orchestration
        ├── main.tsx                 # React entry point
        ├── types.ts                 # TypeScript interfaces
        ├── style.css                # Global reset styles
        ├── App.css                  # App-specific styles (821 lines)
        ├── pages/
        │   ├── HomePage.tsx         # Setup screen route (/)
        │   └── ChatPage.tsx         # Dashboard route (/chat)
        ├── components/
        │   ├── SetupScreen.tsx      # YouTube handle/channel/video input
        │   ├── Sidebar.tsx          # Dynamic settings panel
        │   ├── PreviewArea.tsx      # Chat message display area
        │   ├── StreamHUD.tsx        # OBS stream status overlay
        │   ├── TitleBar.tsx         # Custom window title bar
        │   └── SettingControl.tsx   # Polymorphic settings renderer
        ├── hooks/
        │   ├── useChat.ts           # YouTube chat event management
        │   ├── useTTS.ts            # Text-to-Speech engine
        │   ├── useOBSAudio.ts       # OBS audio input controls
        │   └── supertonic2/         # Neural TTS (ONNX models)
        │       ├── helper.ts        # TTS core classes (669 lines)
        │       ├── useSupertonic.ts # React hook for Supertonic
        │       └── index.ts         # Barrel exports
        ├── context/
        │   └── SettingsContext.tsx  # Global settings + localStorage persistence
        └── config/
            └── settingsSchema.ts    # Declarative settings schema (387 lines)
```

## Backend (Go)

### `main.go` — Wails Application Entry
- Frameless, transparent window (1024x768)
- Webview transparency enabled for Windows and macOS
- Embeds frontend assets from `frontend/dist`

### `app.go` — Core Backend Logic (459 lines)

**App struct:**
```go
type App struct {
    ctx        context.Context
    lc         *youtubechat.LiveChat   // YouTube chat observer
    lcMu       sync.Mutex              // Thread safety for chat
    stopSignal chan struct{}           // Chat stop signal
    hwnd       win.HWND                // Windows window handle

    obsClient *goobs.Client            // OBS WebSocket client
    obsStop   chan struct{}            // OBS monitor stop signal
}
```

**Chat Functions:**
- `StartChat(youtubeInput)` — Starts YouTube live chat observation from an @handle, UC channel ID, or video URL
- `StopChat()` — Stops chat observation
- `handleChatEvents()` — Routes chat events to frontend via Wails Events (`chat_message`, `chat_started`, `chat_ended`, `chat_error`)

**OBS Functions:**
- `ConnectOBS(host, password)` — Connects to OBS WebSocket (default: `localhost:4455`)
- `DisconnectOBS()` — Disconnects from OBS
- `monitorOBS()` — Polls every 1s: bitrate (kbps), FPS, dropped frames %, congestion, current scene, stream status color (GREEN/YELLOW/RED/GRAY)
- `GetOBSAudioInputs()` — Gets Mic/Aux and Desktop Audio inputs with mute state and volume (dB)
- `SetOBSInputMute(inputName, muted)` — Mutes/unmutes an OBS input
- `SetOBSInputVolume(inputName, volumeDb)` — Sets volume in dB

**Window Functions:**
- `SetClickThrough(enabled)` — Toggles `WS_EX_TRANSPARENT` + `WS_EX_LAYERED` on Windows for click-through overlay mode

## Frontend (React + TypeScript)

### Routing (`App.tsx`)
Hash-based routing with auto-navigation:
- `/` → HomePage (setup screen, shown when not started)
- `/chat` → ChatPage (dashboard, shown when started)

**Keyboard Shortcut:** `Ctrl+B` toggles UI visibility and click-through mode

### Pages

**HomePage** (`pages/HomePage.tsx`)
- Renders `SetupScreen` component
- Props: channelId, onStart, onPreview, error

**ChatPage** (`pages/ChatPage.tsx`)
- Renders `Sidebar` + `PreviewArea` + `StreamHUD` (when OBS connected)
- Props: showUI, channelId, liveId, isPreviewMode, messages, obsStatus

### Components

**SetupScreen** (`components/SetupScreen.tsx`)
- Enter ID supports @handle, UC channel ID, or YouTube video URL
- Buttons: Connect, Preview Design

**Sidebar** (`components/Sidebar.tsx`)
- Dynamic settings panel rendered from `SETTINGS_SCHEMA`
- Shows channel info, live status, preview mode indicator
- Disconnect button at bottom
- Collapsible with `Ctrl+B`

**PreviewArea** (`components/PreviewArea.tsx`)
- Chat message display with full customization:
  - Bubble backgrounds, avatars, badges, timestamps
  - SuperChat support (colored backgrounds, amounts, stickers)
  - Membership event display
  - 3D transforms (rotate, skew, scale, perspective)
  - Chroma key mode
  - Entrance animations
  - Text stroke, shadow, line height, font weight

**StreamHUD** (`components/StreamHUD.tsx`)
- Floating overlay with configurable position (4 corners)
- Displays: LIVE/OFFLINE status, bitrate, FPS, drop %, current scene
- Audio controls: Mic mute/unmute + volume slider, Desktop audio mute/unmute + volume slider
- Status color coding: GREEN (healthy), YELLOW (warning), RED (critical), GRAY (offline)

**TitleBar** (`components/TitleBar.tsx`)
- Custom frameless window controls: Minimize, Maximize, Close, Pin (always on top)
- Draggable area (`--wails-draggable: drag`)
- Glassmorphism background, auto-hides

**SettingControl** (`components/SettingControl.tsx`)
- Polymorphic renderer for all setting types:
  - `toggle` — Checkbox
  - `range` — Slider with min/max/step/unit
  - `color` — Color picker
  - `select` — Dropdown with options
  - `text` — Single-line text input
  - `textarea` — Multi-line text input
  - `number` — Number input
  - `button` — Connect/Disconnect OBS button
  - `voice-select` — Browser speech synthesis voice selector
  - `tts-test` — TTS test control with text input and play button

### Hooks

**`useChat`** (`hooks/useChat.ts`)
- Manages YouTube chat state: messages, isStarted, error, liveId, isPreviewMode
- Listens to Wails events: `chat_message`, `chat_started`, `chat_error`, `chat_ended`, `obs_status`
- Handles OBS connection/disconnection based on settings
- Preview mode generates dummy messages for design testing
- Message deduplication and max message limit enforcement

**`useTTS`** (`hooks/useTTS.ts`)
- Queue-based TTS system with two providers:
  - **Browser** — Web Speech API (`SpeechSynthesis`)
  - **Supertonic** — Neural TTS with ONNX models
- Features:
  - Members-only mode (filters by membership/badge)
  - Custom user whitelist (bypass members mode)
  - Command mode (only read messages starting with prefix, e.g., `!voice`)
  - Random voice per message
  - URL removal from text
  - Username cleaning (removes @ and numbers)
  - Message deduplication (tracks last 200 message IDs)
  - Ignores messages that arrived before TTS was enabled

**`useOBSAudio`** (`hooks/useOBSAudio.ts`)
- Polls OBS audio inputs every 2 seconds
- Local state management for responsive UI during dragging
- Mute toggle and volume control (0-100 slider mapped to -100dB to 0dB)
- Drag tracking to prevent state overwrites during volume adjustment

**`useSupertonic`** (`hooks/supertonic2/useSupertonic.ts`)
- Loads ONNX models on mount (WebGPU first, fallback to WASM)
- Downloads models from Hugging Face (`Supertone/supertonic-2`)
- Manages voice styles (M1-M5, F1-F5)
- Speech generation with progress callbacks

### Supertonic 2 Neural TTS (`hooks/supertonic2/helper.ts` — 669 lines)

**Core Classes:**
- `UnicodeProcessor` — Text normalization, emoji removal, language tag wrapping
- `Style` — Holds TTL (timbre) and DP (duration) tensors
- `TextToSpeech` — Full TTS pipeline:
  1. Text processing and tokenization
  2. Duration prediction
  3. Text encoding
  4. Noisy latent sampling (Box-Muller transform)
  5. Denoising loop (vector estimator, configurable steps)
  6. Vocoder waveform generation
  7. WAV file output (16-bit PCM)

**Supported Languages:** `en`, `ko`, `es`, `pt`, `fr`
**Voice Styles:** M1-M5 (Male), F1-F5 (Female)
**Text Chunking:** Splits by paragraphs, then sentences (respects abbreviations like Mr., Dr., etc.)

### Settings System

**SettingsContext** (`context/SettingsContext.tsx`)
- 60+ settings with `localStorage` persistence
- Lazy initialization with merge from defaults
- Provides: `settings`, `updateSettings`, `resetSettings`

**SettingsSchema** (`config/settingsSchema.ts`)
- Declarative schema with conditional visibility (`showIf`)
- Sections:
  1. **Overlay Mode** — Chroma key, preview grid, scrollbar
  2. **Style Settings** — Text outline, font size, line height, font weight, opacity, avatars, badges, timestamps
  3. **Message Design** — Bubble background, text alignment, corner radius, vertical gap, max messages, drop shadow
  4. **Animation** — Entrance animation type and duration
  5. **3D Transform** — Perspective, rotate X/Y/Z, skew X, scale
  6. **OBS Integration** — Enable, host, password, connection button, status
  7. **HUD Settings** — Position, scale, opacity, bitrate, FPS, mic, desktop, scene
  8. **TTS** — Enable, members-only, custom users, command mode, provider selection, voice, test

### TypeScript Types (`types.ts`)

```typescript
interface ChatItem {
    ID: string;
    Author: Author;
    Message: MessageItem[] | null;
    SuperChat?: SuperChat;
    IsMembership: boolean;
    IsVerified: boolean;
    IsOwner: boolean;
    IsModerator: boolean;
    Timestamp: string;
}

interface ChatSettings {
    // Visual: fontSize, bgOpacity, messageOpacity, showAvatars, showBadges, showTimestamp
    // Chroma: chromaMode, chromaColor
    // Text: textStroke, textStrokeColor, textShadow, lineHeight, fontWeight, textAlign
    // 3D: threeDEnabled, perspective, rotateX/Y/Z, skewX/Y, scale
    // Layout: showBubble, borderRadius, messageGap, maxMessages, hideScrollbar, showGrid
    // Animation: animation, animationDuration
    // OBS: obsEnabled, obsHost, obsPassword, obsConnected, obsStatusMessage
    // HUD: obsHudPosition, obsHudOpacity, obsHudScale, obsHudShowFps/Bitrate/Mic/Desktop/Scene
    // TTS: ttsEnabled, ttsMembersOnly, ttsAllowCustomUsers, ttsCustomUsersList
    //      ttsCommandMode, ttsCommandPrefix, ttsSeparatorText, ttsRandomVoice
    //      ttsProvider, ttsVoice
    // Supertonic: supertonicVoiceStyle, supertonicLang, supertonicTotalStep, supertonicSpeed
}
```

## Key Features

1. **YouTube Live Chat Overlay** — Real-time chat capture with transparent frameless window
2. **OBS Integration** — Stream monitoring (bitrate, FPS, drops, scene), audio controls (mic/desktop mute + volume)
3. **Text-to-Speech** — Browser Speech API + Supertonic 2 neural TTS (10 voices, 5 languages)
4. **3D Transforms** — Perspective, rotation, skew, scale for overlay customization
5. **Chroma Key** — Solid color background for OBS keying
6. **Click-Through Mode** — `Ctrl+B` hides UI and makes window transparent to mouse clicks
7. **Flexible YouTube Input** — Supports @handle, UC channel ID, and YouTube video URL

## Development Commands

```bash
# Live development (hot reload)
wails dev

# Build production package
wails build
```

## Wails Configuration (`wails.json`)

```json
{
  "name": "airchat",
  "outputfilename": "airchat",
  "frontend:install": "npm install",
  "frontend:build": "npm run build",
  "frontend:dev:watcher": "npm run dev",
  "frontend:dev:serverUrl": "auto",
  "author": {
    "name": "Diego Pahua Silvan",
    "email": "dpahuas@gmail.com"
  }
}
```

## Architecture Notes

- **Event-driven communication**: Backend emits events via `runtime.EventsEmit`, frontend listens via `EventsOn`
- **Thread safety**: `sync.Mutex` protects YouTube chat state in Go
- **State management**: React Context for settings, local state for component-specific data
- **Persistence**: All settings saved to `localStorage` under key `AIRCHAT_SETTINGS`
- **Model loading**: Supertonic ONNX models downloaded from Hugging Face and cached in browser Cache API
- **Fallback chain**: WebGPU → WASM for neural TTS inference
