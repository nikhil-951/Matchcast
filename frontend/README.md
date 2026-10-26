# MatchCast AI — Frontend Studio

MatchCast AI is an AI Pundit Panel built for the Premier League AI Hackathon. Multiple specialized AI pundits with distinct personalities analyze and debate synthetic football matches in real time.

---

## 🚀 Quick Start

```bash
cd "d:\AI Agents\my-first-project\frontend"
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` with proxy routes configured to forward:
- `/api/*` ➔ `http://localhost:8000/api/*`
- `/ws/*` ➔ `ws://localhost:8000/ws/*`

To create an optimized production build:
```bash
npm run build
```

---

## 🎨 Architecture & Components

| Component | Description |
|---|---|
| **`Header`** | Broadcast brand logo, status indicators (LIVE / FT / Synced), and audience mode switcher. |
| **`MatchSelector`** | Pre-match catalog featuring 3 distinctive matches: *The Great Comeback*, *Total Domination*, and *The Battle*. |
| **`PitchVisualizer`** | SVG 2D pitch (105m × 68m standard). Visualizes shot vectors, pass lines, and cards with animated beacons and badges. |
| **`MatchStats`** | Scoreboard, match clock, live xG comparison bars, and possession split bars with smooth animations. |
| **`Timeline`** | Full match scrubber (0' to 90'+) with event markers (⚽ Goals, 🟨/🟥 Cards, 🔄 Subs) and seek control. |
| **`PunditCard`** | Individual pundit cards featuring typing animation, conviction meters, and unique pundit styling. |
| **`PunditPanel`** | Studio container hosting The Host's Desk framing, 3 AI pundits, and the Agreement Meter. |
| **`AgreementMeter`** | Real-time consensus meter (0-100%) indicating disagreement (red), split views (amber), or consensus (green). |
| **`ModeToggle`** | Dynamic lens switcher: **Fan** (emotion), **Scout** (tactics), and **Broadcaster** (drama). |
| **`AskPanel`** | Interactive Q&A console with quick prompt chips, loading spinners, and multi-pundit answers. |
| **`MatchPersonality`** | Full-Time post-match editorial review modal with tactical narrative tags and clickable key moments. |

---

## 🎙️ The Pundit Panel

1. **The Tactician** (Blue `#3b82f6`): Positional structures, pressing triggers, counter-pressing traps, and spatial half-spaces.
2. **The Passionate Fan** (Red `#ef4444`): Raw emotional reaction, referee controversy, effort, grit, and crowd momentum.
3. **The Quant Analyst** (Green `#22c55e`): Expected Goals (xG), Expected Threat (xT), possession quality, and statistical probability.

---

## 🔌 Real-Time & Offline Resilience

- **WebSocket Sync**: Automatically connects to `/ws/match/{matchId}`, parsing `match_state`, `match_event`, `panel_debate`, `panel_answer`, and `match_personality`.
- **Offline Simulation Mode**: If backend services are not running, the frontend automatically falls back to an internal simulation engine that streams realistic events, ticks the match clock, and triggers debates so demo presentations remain 100% operational.
