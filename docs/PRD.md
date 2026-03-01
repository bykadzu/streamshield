# StreamShield — AI Stream Safety Agent

> PRD v1.0 | 2026-03-01 | Author: Claude (Co-Captain) | Coders: Franky + Ren

## One-Liner

**AI watchdog that sits inside a streamer's delay window and auto-censors dangerous content before it reaches viewers.**

---

## Problem

Streamers using 15-60 second delays have a safety buffer — but no one watching it. They can't monitor their own feed while performing. One accidental screen share of an API token, one DMCA clip, one flash of personal info, and they're banned, doxxed, or financially exposed.

**Who this is for:** Twitch/YouTube/Kick streamers who use broadcast delay (competitive gamers, IRL streamers, variety streamers with sensitive dev setups).

**Market signal:** Twitch alone has 7M+ monthly streamers. Even 0.1% adoption = 7,000 paying users. At $10/mo that's $70K MRR.

---

## Solution

A lightweight desktop app (Electron or Tauri) that:
1. Taps into the OBS video/audio output via OBS WebSocket
2. Samples frames + transcribes audio in real-time
3. Runs detection models for configurable threat categories
4. Takes graduated action: blur → mute → full block → end stream
5. All within the delay window, before content reaches viewers

---

## Core Features (MVP)

### F1: Stream Monitoring Engine
- Connect to OBS via WebSocket protocol (obs-websocket 5.x)
- Capture frames at 2-5 FPS via virtual camera or screen capture
- Capture audio via OBS audio monitoring output
- All processing happens locally or via low-latency cloud API

### F2: Detection Pipeline
| Category | What It Catches | Detection Method |
|----------|----------------|-----------------|
| **PII / Secrets** | API keys, tokens, passwords, credit cards, addresses | OCR + regex pattern matching |
| **NSFW** | Nudity, explicit content | Vision classifier (NSFW model) |
| **Violence** | Gore, graphic violence | Vision classifier |
| **Custom text** | Streamer-defined banned words on screen | OCR + keyword list |
| **Audio triggers** | Slurs, banned words, streamer kill-phrase | Speech-to-text + keyword matching |
| **DMCA risk** | Copyrighted music playing | Audio fingerprinting (stretch goal) |

MVP priority: **PII/Secrets + NSFW + Audio triggers + Custom text.** Violence and DMCA are v1.1.

### F3: Graduated Response System
| Tier | Name | Trigger | Action | Recovery |
|------|------|---------|--------|----------|
| 0 | **Log** | Low confidence detection | Log to review queue, no action | Auto |
| 1 | **Mute** | Audio threat (slur, banned word) | Mute stream audio via OBS | Auto after 3s |
| 2 | **Blur** | Visual threat (partial — PII on part of screen) | Apply blur filter to source via OBS | Auto after threat clears |
| 3 | **Block** | Visual threat (severe — nudity, full screen PII) | Switch to "Shield" scene (full overlay) | Manual dismiss or auto 10s |
| 4 | **Kill** | Catastrophic or streamer kill-phrase | End stream via OBS WebSocket | Manual restart required |

Each tier has:
- Configurable confidence threshold (default: 0.7 for action, 0.5 for log)
- Cooldown period (prevent rapid-fire triggers)
- Override: streamer can dismiss any active shield with hotkey

### F4: Streamer Dashboard
- **Pre-stream:** Configure sensitivity, custom triggers, kill-phrase
- **During stream:** Live status indicator (green/yellow/red), recent flags
- **Post-stream:** Review queue — every detection with timestamp, screenshot, confidence score, action taken
- **Settings:** Per-category sensitivity sliders, custom word lists, hotkey config

### F5: Kill-Phrase System
- Streamer sets a secret phrase (e.g., "red alert omega")
- If spoken on stream → immediate Tier 4 (end stream)
- Requires exact phrase match (no false positives on partial matches)
- Can also bind to a hotkey as backup

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  OBS Studio                       │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Scenes   │  │ Sources  │  │ Filters       │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
│       ▲              ▲              ▲             │
│       │      OBS WebSocket 5.x     │             │
└───────┼──────────────┼──────────────┼────────────┘
        │              │              │
┌───────┴──────────────┴──────────────┴────────────┐
│              StreamShield Core                     │
│                                                    │
│  ┌────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │ Frame      │  │ Audio       │  │ Action     │  │
│  │ Sampler    │  │ Capture     │  │ Controller │  │
│  │ (2-5 FPS) │  │ (real-time) │  │ (OBS WS)   │  │
│  └─────┬──────┘  └──────┬──────┘  └─────▲─────┘  │
│        │                │                │         │
│  ┌─────▼────────────────▼──────┐         │         │
│  │     Detection Pipeline       │─────────┘         │
│  │                              │                    │
│  │  ┌─────────┐ ┌───────────┐  │                    │
│  │  │ Vision  │ │ Audio     │  │                    │
│  │  │ Models  │ │ Models    │  │                    │
│  │  │         │ │           │  │                    │
│  │  │ - OCR   │ │ - STT     │  │                    │
│  │  │ - NSFW  │ │ - Keyword │  │                    │
│  │  │ - Custom│ │ - Kill    │  │                    │
│  │  └─────────┘ └───────────┘  │                    │
│  └──────────────────────────────┘                    │
│                                                      │
│  ┌──────────────┐  ┌────────────────┐               │
│  │ Review Queue │  │ Config/State   │               │
│  │ (SQLite)     │  │ (local JSON)   │               │
│  └──────────────┘  └────────────────┘               │
└──────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────┐
│ Dashboard UI     │
│ (localhost web)  │
│ Pre/During/Post  │
└──────────────────┘
```

### Tech Stack (Recommended)

| Layer | Tech | Why |
|-------|------|-----|
| **App shell** | Tauri (Rust + web frontend) | Lightweight, native perf, no Electron bloat. Streamers hate RAM hogs. |
| **Frontend** | React + Tailwind | Fast to build, our team knows it |
| **OBS integration** | obs-websocket-js (npm) | Official JS client for OBS WebSocket 5.x |
| **Vision — OCR** | Tesseract.js (local) or cloud OCR | PII/token detection via text extraction |
| **Vision — NSFW** | NSFWJS (TensorFlow.js, local) | Runs in-browser/local, no API cost |
| **Audio — STT** | Whisper (local via whisper.cpp) or Deepgram API | Local = free, API = more accurate |
| **Audio — fingerprint** | Chromaprint/AcoustID (v1.1) | DMCA detection, stretch goal |
| **Storage** | SQLite (via better-sqlite3 or Tauri built-in) | Review queue, settings, detection log |
| **Regex patterns** | Custom rule engine | API key patterns, credit card regex, etc. |

### Latency Budget

With a 15-second delay (minimum common delay):
- Frame capture: ~50ms
- OCR processing: ~200ms
- NSFW classification: ~100ms
- Audio transcription: ~500ms (chunked)
- Decision + action: ~50ms
- **Total: ~900ms worst case**
- **Budget remaining: 14.1 seconds** — plenty of margin

Even with a 5-second delay (uncommon but possible), the pipeline completes in <1s.

---

## Detection: PII & Secrets (The Killer Feature)

This is what makes StreamShield unique. Streamers accidentally show:
- `.env` files with API keys
- Browser tabs with payment info
- Terminal output with tokens
- Discord DMs with personal info
- Email addresses, phone numbers, physical addresses

### Pattern Library (built-in)
```
API Keys:        sk-[a-zA-Z0-9]{20,}   |  AKIA[A-Z0-9]{16}
                 ghp_[a-zA-Z0-9]{36}   |  xox[bpsa]-[a-zA-Z0-9-]+
Credit Cards:    \b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b
Emails:          \b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b
Phone Numbers:   \b(\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b
AWS Keys:        AKIA[0-9A-Z]{16}
Private Keys:    -----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----
Passwords:       (password|passwd|pwd)\s*[:=]\s*\S+
IP Addresses:    \b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b
```

Streamers can add custom patterns (e.g., their home address, real name, specific tokens).

---

## Revenue Model

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | PII/secret detection only, 5 reviews/stream, no custom triggers |
| **Pro** | $9.99/mo | All detection categories, unlimited reviews, custom triggers, kill-phrase |
| **Team** | $24.99/mo | Multi-PC support, shared config, priority support, API access |

**Why this pricing:**
- Free tier solves the #1 pain (accidental secret exposure) — drives adoption
- Pro is impulse-buy price for anyone streaming seriously
- Team covers agencies/orgs managing multiple streamers

**Revenue targets:**
- Month 1-3: Build + beta with 50 streamers (free)
- Month 4-6: Launch Pro tier, target 500 paying users = $5K MRR
- Month 6-12: Team tier, integrations, target 2,000 users = $25K MRR

---

## MVP Scope (Phase 1)

**Goal:** Working app that connects to OBS, detects PII/secrets on screen, and blocks the stream when detected. Ship in 2-3 weeks.

### Phase 1 Deliverables
1. Tauri desktop app with basic UI (connect to OBS, status indicator)
2. OBS WebSocket connection (connect, monitor, control)
3. Frame sampling at 2 FPS
4. OCR pipeline (Tesseract.js) → regex pattern matching
5. Tier 3 response only (full screen block via OBS scene switch)
6. Basic settings (OBS connection, sensitivity slider)
7. Detection log (SQLite, viewable in app)

### What's NOT in Phase 1
- Audio detection (Phase 2)
- NSFW/violence detection (Phase 2)
- Blur/partial censoring (Phase 2 — requires OBS filter manipulation)
- Kill-phrase (Phase 2)
- Cloud sync / accounts (Phase 3)
- DMCA detection (Phase 3+)
- Payment / subscription (Phase 3)

---

## Phase Roadmap

| Phase | Focus | Timeline | Key Deliverable |
|-------|-------|----------|-----------------|
| **1** | PII Shield MVP | Week 1-3 | Desktop app, OBS integration, secret detection, full-block response |
| **2** | Full Detection | Week 4-6 | Audio STT, NSFW vision, blur/mute tiers, kill-phrase, custom triggers |
| **3** | Polish + Launch | Week 7-9 | Dashboard UI, review queue, settings UX, beta program |
| **4** | Monetization | Week 10-12 | Stripe integration, free/pro/team tiers, landing page |
| **5** | Growth | Month 4+ | Twitch extension, StreamElements/Streamlabs integration, community |

---

## Competitive Landscape

| Product | What They Do | Why We Win |
|---------|-------------|------------|
| **Twitch AutoMod** | Text chat moderation | Doesn't touch video/audio content |
| **Nightbot/StreamElements** | Chat bots, alerts, overlays | No content analysis capability |
| **Moobot** | Chat moderation | Chat only |
| **Manual delay monitoring** | Streamer watches their own feed | Can't watch + perform simultaneously |
| **StreamShield (us)** | AI video+audio analysis within delay window | **Only product analyzing the actual stream content** |

**Moat:** The PII/secret detection regex library + the OBS integration pipeline. First-mover in "stream content safety" (not just chat safety).

---

## Open Questions

1. **Tauri vs Electron?** Tauri is lighter but Rust backend may slow development. Electron is heavier but faster to build with our JS/TS skills. Recommend: **Start Tauri, fall back to Electron if blocked.**
2. **Local-only vs cloud?** MVP should be fully local (privacy, no API costs). Cloud option for better accuracy in v2.
3. **OBS-only or also Streamlabs/XSplit?** MVP: OBS only (80%+ market share among delay users). Expand later.
4. **Name:** StreamShield is the working name. Open to alternatives.
5. **Open source?** Core detection could be open-source (community contributions to pattern library), monetize the app/UX/cloud features. Decision for later.

---

## Task Breakdown (for Franky + Ren)

### Franky (Local — Core Engine)
- [ ] TASK: Scaffold Tauri app with React frontend
- [ ] TASK: OBS WebSocket 5.x connection manager (connect, reconnect, health)
- [ ] TASK: Frame sampler — capture frames from OBS at configurable FPS
- [ ] TASK: OCR pipeline — Tesseract.js integration, frame → text
- [ ] TASK: Pattern engine — regex matching against extracted text
- [ ] TASK: Action controller — OBS scene switch for full-block response
- [ ] TASK: Detection log — SQLite storage, query API
- [ ] TASK: Settings manager — OBS connection, sensitivity, patterns

### Ren (VPS — Dashboard + Cloud) — Phase 2+
- [ ] TASK: Dashboard UI — pre-stream config, live status, post-stream review
- [ ] TASK: Review queue UI — timeline view of detections with screenshots
- [ ] TASK: Audio pipeline — Whisper.cpp integration for STT
- [ ] TASK: NSFW detection — NSFWJS model integration
- [ ] TASK: Cloud sync API — settings backup, multi-device support

### Claude (Co-Captain — Architecture + Review)
- Review all PRs before merge
- Architecture decisions when Franky/Ren hit crossroads
- Pattern library curation (the regex collection is the product's secret sauce)
- Integration testing strategy
- Landing page copy and positioning

---

## Success Metrics

| Metric | Target (3 months) | Target (6 months) |
|--------|-------------------|-------------------|
| Beta users | 50 | 500 |
| Paying users | — | 200 |
| MRR | — | $2,000 |
| False positive rate | <5% | <2% |
| Detection latency | <1s | <500ms |
| Streams protected | 500 | 5,000 |

---

## References

- OBS WebSocket Protocol: https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md
- Tesseract.js: https://github.com/naptha/tesseract.js
- NSFWJS: https://github.com/infinitered/nsfwjs
- Whisper.cpp: https://github.com/ggerganov/whisper.cpp
- Tauri: https://tauri.app
- obs-websocket-js: https://github.com/obs-websocket-community-projects/obs-websocket-js
