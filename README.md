# StreamShield

**AI stream safety agent — monitors your broadcast delay window and auto-censors dangerous content before it reaches viewers.**

## What It Does

StreamShield sits between OBS and your viewers. During your broadcast delay (15-60 seconds), it:
- Scans every frame for **API keys, passwords, credit cards, personal info**
- Listens for **banned words, slurs, or your emergency kill-phrase**
- Takes **graduated action**: mute → blur → full block → end stream
- Logs everything for **post-stream review**

## Tech Stack

| Layer | Tech |
|-------|------|
| App shell | Tauri 2.x (Rust + TypeScript) |
| Frontend | React 19 + Tailwind CSS 4 |
| OBS integration | obs-websocket-js 5.x |
| OCR | Tesseract.js |
| NSFW detection | NSFWJS (Phase 2) |
| Speech-to-text | Whisper.cpp (Phase 2) |
| Local storage | SQLite (via Tauri) |

## Project Structure

```
streamshield/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/              # React hooks (OBS connection, detection state)
│   ├── lib/                # Core logic
│   │   ├── obs/            # OBS WebSocket client
│   │   ├── detection/      # Detection pipeline
│   │   │   ├── ocr.ts      # Tesseract.js OCR
│   │   │   ├── patterns.ts # Regex pattern engine
│   │   │   └── pipeline.ts # Frame → detect → action orchestrator
│   │   ├── actions/        # Response actions (mute, blur, block, kill)
│   │   └── storage/        # SQLite detection log
│   ├── pages/              # App pages (Dashboard, Settings, Review)
│   └── App.tsx
├── src-tauri/              # Tauri Rust backend
│   ├── src/
│   │   └── main.rs         # Tauri entry, frame capture, native APIs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── patterns/               # Detection pattern files
│   └── default.json        # Built-in PII/secret patterns
├── docs/                   # Documentation
│   └── PRD.md              # Product requirements (symlink or copy)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── vite.config.ts
```

## Development

```bash
# Prerequisites: Node.js 22+, Rust toolchain, OBS Studio with WebSocket enabled

# Install dependencies
npm install

# Run in development mode (opens Tauri window)
npm run tauri dev

# Build for production
npm run tauri build

# Run frontend only (browser, no Tauri)
npm run dev
```

## Phase 1 (MVP) Scope

- [x] Tauri + React scaffold
- [ ] OBS WebSocket connection manager
- [ ] Frame sampling (2 FPS)
- [ ] OCR pipeline (Tesseract.js)
- [ ] PII/secret pattern matching
- [ ] Full-block response (scene switch)
- [ ] Detection log (SQLite)
- [ ] Basic settings UI

## License

MIT
