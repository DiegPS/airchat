# AirChat 🎙️

> **YouTube Live Chat Overlay** for streamers with OBS integration and Neural Text-to-Speech.

A transparent, frameless desktop application built with **Wails v2** (Go + React/TypeScript) that captures YouTube live chat in real-time and displays it as a customizable overlay — perfect for placing over OBS or any streaming software.

---

## ✨ Features

### 📺 YouTube Live Chat Overlay
- Real-time chat capture from YouTube Live streams
- Transparent, frameless window that floats over OBS or any app
- Click-through mode (`Ctrl+B`) — interact with underlying windows while chat displays
- Full customization: fonts, colors, animations, 3D transforms, chroma key

### 🎛️ OBS Integration
- **Stream monitoring**: bitrate, FPS, dropped frames, congestion, current scene
- **Audio controls**: mute/unmute and adjust volume for microphone and desktop audio
- **HUD overlay**: floating status widget with 4 position options, configurable scale and opacity
- **Status indicators**: color-coded health (GREEN / YELLOW / RED / GRAY)

### 🔊 Text-to-Speech
- **Browser TTS** — Web Speech API with voice selector
- **Supertonic 2 Neural TTS** — AI-powered speech with 10 voices (M1-M5, F1-F5) and 5 languages (English, Korean, Spanish, Portuguese, French)
- **Smart filtering**: members-only mode, custom user whitelist, command mode (e.g., `!voice`)
- **Random voice** per message, URL removal, username cleaning

### 📊 Subscriber Goal Widget
- Live subscriber counter with progress bar
- Fetches real-time stats from livecounts.io
- Customizable title and target

### 🎨 Design Customization
- **Message styling**: bubble backgrounds, avatars, badges, timestamps, border radius, text alignment
- **Text effects**: outline/stroke, drop shadow, line height, font weight
- **Animations**: slide-up, slide-left, fade-in, zoom-in with adjustable speed
- **3D transforms**: perspective, rotate X/Y/Z, skew, scale
- **Chroma key**: solid color background for OBS chroma keying
- **Preview mode**: test your design with dummy messages before going live

### 🔍 Channel Search
- Search YouTube channels by name via livecounts.io API
- Manual channel ID input option

---

## 🖥️ Screenshots

> _Add screenshots here_

---

## 🚀 Installation

### Prerequisites

- **Go** 1.25.5+ — [Install Go](https://go.dev/doc/install)
- **Node.js** 18+ — [Install Node.js](https://nodejs.org/)
- **Wails v2** — [Install Wails](https://wails.io/docs/gettingstarted/installation)

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

### Build from Source

```bash
# Clone the repository
git clone https://github.com/DiegPS/airchat.git
cd airchat

# Install frontend dependencies
cd frontend && npm install && cd ..

# Build the application
wails build
```

The built executable will be in `build/bin/`.

---

## 🛠️ Development

```bash
# Run in development mode with hot reload
wails dev
```

This starts a Vite dev server with fast hot reload. A dev server also runs on `http://localhost:34115` where you can call Go methods from browser devtools.

---

## 📖 Usage

### 1. Connect to YouTube Chat
- Enter a **Channel ID** manually, or
- **Search** for a channel by name and select from results
- Click **Connect** to start capturing live chat

### 2. Customize the Overlay
- Use the **Sidebar** to adjust every visual aspect of the chat display
- Toggle **Preview Design** to test your settings with dummy messages
- Enable **3D transforms** for perspective effects

### 3. OBS Integration
- Enable OBS in settings and enter your WebSocket host (`localhost:4455`) and password
- Monitor stream health in the **HUD overlay**
- Control mic and desktop audio directly from the HUD

### 4. Text-to-Speech
- Enable TTS in settings
- Choose provider: **Browser API** or **Supertonic 2** (neural)
- Configure members-only mode, command prefix, and voice preferences

### 5. Click-Through Mode
- Press **`Ctrl+B`** to hide the UI and make the window transparent to mouse clicks
- Press **`Ctrl+B`** again to bring the UI back

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    AirChat Desktop                   │
├──────────────────────┬──────────────────────────────┤
│   Backend (Go)       │   Frontend (React + TS)      │
│                      │                              │
│  • YouTube Chat API  │  • Chat Display & Styles     │
│  • OBS WebSocket     │  • Settings Panel            │
│  • Window Control    │  • Stream HUD                │
│  • Channel Search    │  • Subscriber Goal           │
│                      │  • TTS Engine (ONNX)         │
│                      │  • Supertonic 2 Neural TTS   │
└──────────────────────┴──────────────────────────────┘
         │                              │
         ▼                              ▼
  YouTube Live Chat              Wails Events
  OBS WebSocket                  localStorage
  Windows API                    Cache API (models)
```

### Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Wails v2](https://wails.io/) |
| **Backend** | Go |
| **Frontend** | React 18 + TypeScript |
| **Build** | Vite 3 |
| **YouTube** | [youtube-chat](https://github.com/DiegPS/youtube-chat) |
| **OBS** | [goobs](https://github.com/andreykaipov/goobs) |
| **TTS** | [onnxruntime-web](https://onnxruntime.ai/) + [Supertonic 2](https://huggingface.co/Supertone/supertonic-2) |
| **Window** | Windows API (`lxn/win`) |

---

## ⚙️ Configuration

All settings are persisted in `localStorage` under `AIRCHAT_SETTINGS`. The settings schema is defined in `frontend/src/config/settingsSchema.ts` and includes:

| Section | Settings |
|---|---|
| **Overlay Mode** | Chroma key, preview grid, scrollbar |
| **Style** | Font size, line height, weight, opacity, avatars, badges, timestamps |
| **Message Design** | Bubble background, alignment, corner radius, gap, max messages, shadow |
| **Animation** | Entrance animation type and duration |
| **3D Transform** | Perspective, rotate X/Y/Z, skew, scale |
| **Subscriber Goal** | Show goal, title, target count |
| **OBS Integration** | Enable, host, password, connection status |
| **HUD Settings** | Position, scale, opacity, bitrate, FPS, mic, desktop, scene |
| **TTS** | Enable, members-only, custom users, command mode, provider, voice |

---

## 🎯 Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+B` | Toggle UI visibility and click-through mode |

---

## 📁 Project Structure

```
airchat/
├── main.go                          # Wails entry point
├── app.go                           # Backend: YouTube, OBS, window control
├── wails.json                       # Wails configuration
├── go.mod                           # Go dependencies
├── build/                           # Build artifacts
└── frontend/
    ├── package.json                 # Frontend dependencies
    ├── vite.config.ts               # Vite configuration
    └── src/
        ├── App.tsx                  # Router + main orchestration
        ├── types.ts                 # TypeScript interfaces
        ├── pages/                   # HomePage, ChatPage
        ├── components/              # UI components
        ├── hooks/                   # useChat, useTTS, useOBSAudio, supertonic2
        ├── context/                 # SettingsContext (localStorage)
        └── config/                  # settingsSchema.ts
```

---

## 🔧 Troubleshooting

### OBS won't connect
- Ensure OBS WebSocket is enabled: **Tools → WebSocket Server Settings**
- Default port: `4455`
- Check your WebSocket password matches

### Supertonic TTS not working
- First run downloads ONNX models from Hugging Face (~hundreds of MB)
- Requires **WebGPU** support (falls back to WASM if unavailable)
- Check browser console for download errors

### Window not transparent
- On Windows, ensure `WebviewIsTransparent` and `WindowIsTranslucent` are enabled in `main.go`
- Some Windows themes or compositing settings may affect transparency

---

## 📄 License

This project is open source. See the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**Diego Pahua Silvan**
- GitHub: [@DiegPS](https://github.com/DiegPS)
- Email: dpahuas@gmail.com

---

## 🙏 Acknowledgments

- [Wails](https://wails.io/) — Desktop app framework
- [youtube-chat](https://github.com/DiegPS/youtube-chat) — YouTube live chat library
- [goobs](https://github.com/andreykaipov/goobs) — OBS WebSocket client
- [Supertonic 2](https://huggingface.co/Supertone/supertonic-2) — Neural TTS by Supertone
- [livecounts.io](https://livecounts.io/) — YouTube subscriber stats API
