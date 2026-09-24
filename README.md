# ♠ Euterpe Solitaire Parlor

> **A luxury, distraction-free digital card parlor** featuring Klondike and Pyramid modes, built on the **Open Playing Cards v1** vector standard, deterministic seeded challenges, tactile acoustics, and persistent parlor aesthetics.

![Euterpe Solitaire Parlor](public/favicon.svg)

---

## ✦ Key Features

### 🃏 Game Modes
* **Klondike (Turn 1)** — The quintessential relaxed patience game with single-card draws.
* **Klondike (Turn 3)** — The classic casino ruleset demanding tactical stock-cycling foresight.
* **Pyramid Solitaire** — Fast-paced pairing puzzle where cards summing to 13 are cleared from a 28-card pyramid.

### 🎨 Open Playing Cards v1 Standard & Deck Engine
* Full implementation of the [Open Playing Cards v1 specification](https://github.com/bferg314/card-atelier/blob/main/docs/open-playing-cards.md).
* Ships with the vector-sharp **Classic Deck Large** by Bryan Ferguson.
* **Custom Deck Ingestion**: Drag & drop any `.cards.zip` or `.cards.json` archive exported from [Card Atelier](https://card-atelier.tinyibex.com/).
* **In-Flight Re-Skinning**: Switching or importing a deck re-skins active cards on the felt immediately without resetting or forfeiting game progress.
* **Deck Persistence**: Custom imported decks are safely stored in browser **IndexedDB**, surviving reloads and system restarts.

### 🏛️ Table Themes & Atmospheres
* **Midnight Velvet** — Artisanal emerald baize with warm ambient spotlighting and polished brass trim.
* **Obsidian Royale** — Deep sapphire-slate baize with stellar cosmic vignette and radiant gold accents.
* **Casino Crimson** — Monte Carlo burgundy cloth with deep mahogany rail trim and champagne accents.
* **Nordic Frost** — Frosted glassmorphism over cool arctic dawn gradients with silver-white rail trim.
* **Cyber Silk** — Neo-noir matte dark cloth with luminous cyber-grid reflections.
* *Theme selection is automatically remembered via local storage.*

### 🛡️ Resilient Game Persistence & Refresh Protection
* **Instant Auto-Save**: Game states (board layout, moves, timer, score, and full undo/redo stacks) are continuously serialized in real time.
* **Zero-Interruption Reloads**: Seamless page refreshes restore your active board instantly with an unobtrusive *"Resumed game in progress"* toast banner.
* **Confirmation Modals**: Polished dialogs protect in-progress games from accidental forfeits when switching game modes or clicking **New Deal**.

### 🎲 Seeded Challenges & Parlor Tools
* **Deterministic Seeds**: Every deal is governed by reproducible seed codes (e.g. `EAS-66961`) across Easy, Medium, Hard, and Daily Challenge difficulties.
* **Smart Hints & Auto-Finish**: Non-intrusive hint pulses and automated multi-phase card sweeps once all tableau cards are unlocked.
* **Tactile Acoustics**: Procedural Web Audio API sound synthesis providing organic felt slides, riffle shuffles, snaps, and error bumps without external audio file latency.
* **Persistent Statistics & Match History**: Comprehensive win streak tracking, best times, move records, and exportable match history database.

---

## 🛠️ Technology Stack

* **Framework**: React 19 + TypeScript
* **Bundler & Dev Server**: Vite 8
* **Styling**: Tailored Vanilla CSS Design System with CSS Custom Properties, glassmorphism, and hardware-accelerated animations
* **Storage**: Browser `localStorage` (stats, preferences, game state) + `IndexedDB` (custom deck archives)
* **Archive Parsing**: JSZip for `.cards.zip` extraction
* **Audio**: Native Web Audio API procedural synthesis
* **Icons**: Lucide React + Custom SVG Favicon

---

## 🚀 Getting Started

### Prerequisites
* Node.js 18+
* npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/bferg314/euterpe-solitaire.git
cd euterpe-solitaire

# Install dependencies
npm install

# Start the development server
npm run dev
```

### Production Build

```bash
# Type check and build production bundle
npm run build

# Preview the production build locally
npm run preview
```

### Linting

```bash
npm run lint
```

---

## 📖 Documentation & Roadmap

* [Product Feature Roadmap](docs/FEATURE_ROADMAP.md) — 15 strategic feature concepts categorized across Friction Reducers, The Next Step Value, Power User Upgrades, Underutilized Data, and Retention.
* [Open Playing Cards Specification](https://github.com/bferg314/card-atelier/blob/main/docs/open-playing-cards.md) — Format specification for custom decks.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).  
Default deck artwork *Classic Deck Large* is licensed under **CC0-1.0 (Public Domain)** by Bryan Ferguson.
