# Euterpe Solitaire Parlor — Product Feature Roadmap & Strategic Vision

This document sets aside high-potential product and UX enhancements for **Euterpe Solitaire Parlor**, categorized across five core product design frameworks.

---

## 1. Friction Reducers
*Automating mechanical toil and eliminating physical fatigue to keep the player’s focus 100% on puzzle strategy.*

### 1.1 Smart Destination Tap `[Implemented]`
* **Description:** A single tap on any movable card slides it to its most logical destination (Foundations take highest priority, followed by the longest or least restrictive Tableau column).
* **Value Proposition:** Eliminates drag-and-drop fatigue and cumbersome mouse travel across high-resolution displays or trackpads, speeding up comfortable one-handed play.
* **Status:** Implemented (Smart heuristic scorer evaluating foundations first, then tableau columns weighted by exposed face-down cards and column depth; cards slide naturally to their new place via `useCardMotion`, which animates every Klondike move the same way: taps, keyboard, draws, vacuum, auto-finish, undo and the Trainer's replay).

### 1.2 Safe-Play Foundation Vacuum (Ambient Sweep) `[Implemented]`
* **Description:** An optional parlor toggle that automatically lifts cards to the Foundation piles *only* when they are mathematically guaranteed to never be needed again in the Tableau (e.g., moving a 4 to a foundation only after both 3s of the opposite color are already locked into foundations).
* **Value Proposition:** Relieves the repetitive chore of manual foundation stacking without the risk of accidental premature moves that could trap a critical sequence below.
* **Status:** Implemented (Strict mathematical safety algorithm: Aces & 2s unconditionally; rank $R \ge 3$ only when both opposite-color foundations $\ge R - 1$; toggleable via the header bar `Sparkles` button, persistent in `localStorage`, cards slide home like any other move, and it's fully reversible via Undo).

### 1.3 Stock Wheel Scrubbing
* **Description:** In 3-card Klondike, allows mouse-wheel scrolling or a continuous horizontal swipe across the stock pile to rapidly cycle through draw rotations, automatically braking when a playable card hits the waste.
* **Value Proposition:** Removes finger strain and the frustration of repetitive clicking when cycling through a 24-card stock pile multiple times looking for a specific rank.

### 1.4 Keyboard Mode `[Implemented]`
* **Description:** Every game can be played without a mouse. A gold roving cursor moves between piles with the arrow keys; in Klondike, `Space` picks up and drops cards and `Enter` plays a card like a click; in Pyramid, `Space`/`Enter` select and pair. `?` opens the full shortcut sheet.
* **Value Proposition:** Fast, precise play for keyboard-first players and full access for screen-reader users, without changing anything for mouse players (the cursor hides the moment the mouse moves).
* **Status:** Implemented (shared `applyKlondikeMove` engine function with unit tests, `useBoardKeyboard` hook, live-region announcements, Rules → Keyboard tab). See `docs/KEYBOARD_MODE_PLAN.md`.

### 1.5 Winnable Deals Only `[Implemented]`
* **Description:** An option to have new deals checked by the solver before they're dealt, so every random deal can be won. Difficulty comes from the deal itself (the length of its best line), the Daily Challenge walks from the day's seed to the first winnable deal so it's the same for everyone, and a seed you type yourself is dealt as-is with a heads-up if it can't be won.
* **Value Proposition:** Nobody wants to spend forty moves on a deal that was never winnable; losses become the player's to learn from, not the shuffle's.
* **Status:** Pyramid: opt-in, off by default, since deals are random like a real deck (toggle in the seed picker; the Daily Challenge is always winnable), next deal prefetched in the background so New Deal is usually instant, difficulty bands Easy ≤55 / Medium 56–60 / Hard 61+ moves. Klondike: the same opt-in toggle and a Daily checked winnable; the solver's fast first pass (40k-node cap) checks each deal in milliseconds when it's winnable, and difficulty stays with the Easy/Medium/Hard dealing, since the solver's first lines are too rough to band deals by.

---

## 2. The "Next Step" Value
*Capturing the player's psychological momentum immediately after victory or defeat.*

### 2.1 The Fork (Branching Undo from Deadlock) `[Implemented]`
* **Description:** When a game hits a dead end or defeat, players can click "Fork Game" to view a scrubbable timeline slider of their moves, pinpointing where hidden cards were missed or bad choices were made, and branch off a new attempt from that exact mid-game point.
* **Value Proposition:** Channels defeat into an intriguing puzzle-solving exercise ("Where did I go wrong?") rather than a rage-quit, preserving session length and engagement.
* **Status:** Implemented (Scrubbable move timeline slider, live historical board layout preview, automated decision tagging & insights, Deadlock detection banner, branch count badge tracking, and branch persistence).

### 2.2 The Parlor Challenge Link (1-Click Ghost Seed)
* **Description:** Upon completing a hand, a single click generates a clean, readable link (e.g., `euterpe.cards/#EAS-66961&par=48`) that copies a personalized challenge card displaying the user’s score, moves, and time as the target "Par."
* **Value Proposition:** Captures the emotional peak of victory for organic, viral social sharing among friends and family without requiring intrusive logins or social network SDKs.

### 2.3 Flow-State Auto-Deal
* **Description:** After the victory fireworks or cards cascade, a subtle ambient prompt displays *"Deal next hand (Spacebar)"* with a 3-second gentle progression bar, allowing seamless zero-click transition into the next game.
* **Value Proposition:** Eliminates post-game menu fatigue and keeps players firmly anchored in a relaxed "just one more game" cognitive flow.

---

## 3. Power User Upgrades
*Features that appeal to completionists, competitive tacticians, and high-frequency enthusiasts.*

### 3.1 Vegas Casino Bankroll Mode
* **Description:** Implements authentic Las Vegas Solitaire wagering ($52 buy-in per deck, $5 return for every card brought to the foundations, strict 1- or 3-pass stock limits) tied to a persistent, virtual parlor bankroll ledger.
* **Value Proposition:** Injects high-stakes risk management and strategic tension into every move for seasoned players who find standard Klondike scoring trivial.

### 3.2 Theoretical Par & Efficiency Rating `[Implemented]`
* **Description:** A real solver works out the shortest winning line for each deal in a background worker (the "Ace" line), and Par is set a few moves above it. Wins are rated on the Ace / Eagle / Birdie / Par / Bogey ladder.
* **Value Proposition:** Recontextualizes Solitaire from an exercise in chance into a precision chess-like puzzle, driving deep replayability on challenging seeds.
* **Status:** Implemented for Pyramid (exact A* solver: Par = Ace line + max(3, 8%); unwinnable deals fall back to an estimated `~Par`). Klondike always shows an estimated `~Par`: the best winning line its solver finds in the background (it can't prove Klondike lines shortest in a browser's budget), or a heuristic when it finds none. Klondike Turn 1 rates golf-exact; Turn 3 in 3-move bands. Live header Par, victory badge, stats Ace count and match-history tiers.

### 3.3 Sensory Soundscape Mixer
* **Description:** A dedicated parlor acoustics panel enabling users to blend bespoke ambient layers (soft vinyl crackle, gentle rain against windowpanes, fireplace embers, tactile card weights) with custom card acoustic profiles (heavy linen snap vs. silk glide).
* **Value Proposition:** Reinforces Euterpe’s distinct position as a premium sensory refuge, transforming the game into an everyday focus and study companion.

### 3.4 Solitaire Trainer `[Implemented]`
* **Description:** Watch a bot play the deal in front of you. In Pyramid it plays a known winning line at five skill levels (Bogey, Par, Birdie, Eagle, Ace), and weaker bots take realistic detours, each explained with the moves it cost. In Klondike it plays its best line, says what each move does, and marks tempting slips with what they cost.
* **Value Proposition:** Shows what efficient play looks like on a real deal, and exactly where sloppy play loses moves.
* **Status:**
  * **Pyramid:** exact solver and solver-based Par, five bot levels built from the Ace line plus real slips, each slip explained with its cost. Rates in 4-move bands with Par one typical slip (16 moves) above the Ace line, since a Pyramid slip usually costs a whole stock pass.
  * **Klondike:** weighted-A* solver in passes (see `docs/KLONDIKE_TRAINER_PLAN.md` for the benchmark). Its lines aren't proven shortest, so there's no bot ladder: the Trainer plays the bot's line with a rule of thumb per move, up to 8 costed slips you can watch play out, and the bot's best attempt when it finds no win. Turn 1 rates golf-exact; Turn 3 in 3-move bands.
  * **Both:** header graduation cap, or "Watch" after a win; playback controls, a scrubber with slip marks, and keyboard control.

---

## 4. Underutilized Data
*Transforming cold numbers (seeds, timestamps, move counts) into delightful insights and discovery.*

### 4.1 Board Anatomy & Heatmap Overlay
* **Description:** An end-game toggleable visual overlay that highlights which tableau columns saw the heaviest traffic, which foundation suit lagged behind, and which face-down card was the "keystone" that unlocked the win.
* **Value Proposition:** Satisfies player curiosity about their own subconscious spatial habits (e.g., always drawing from the right-hand column first) and makes each board feel like a distinct territory explored.

### 4.2 The Seed Almanac
* **Description:** A clean, searchable directory of historical seeds categorized by distinct gameplay profiles (e.g., "The Labyrinth" for ultra-deep unblocking, "The Velvet Sprint" for high-speed sub-2-minute runs).
* **Value Proposition:** Elevates cryptic seed strings (`EAS-66961`) into curated cultural levels that players can bookmark, study, and recommend to others.

### 4.3 Solitaire Playstyle Fingerprint
* **Description:** An insightful quarterly or monthly summary profiling the player’s archetype (e.g., *"The Methodical Architect"*: 0% undo usage, high deliberation time vs. *"The Speed Striker"*: high stock cycling, rapid moves).
* **Value Proposition:** Provides personalized, shareable identity validation that deepens player affinity with the app without needing heavy account infrastructure.

---

## 5. Retention & Gamification
*Cultivating daily habit formation and light meta-progression without compromising the quiet luxury aesthetic.*

### 5.1 The Daily Parlor Gazette
* **Description:** A calendar-based daily challenge featuring a curated, guaranteed-winnable seed accompanied by a micro-snippet of card history or musical lore, awarding bespoke wax-seal badges for monthly streaks.
* **Value Proposition:** Creates a predictable morning or evening ritual with guaranteed puzzle fairness, mirroring the high-retention appeal of the *New York Times* Games suite.

### 5.2 Collector’s Atelier (Open Playing Cards Archive)
* **Description:** A persistent parlor gallery where completing specific play milestones (e.g., winning with 0 undos, solving 10 Hard seeds) awards rare public-domain and historical card deck reprints that can be inspected in 3D and used on the table.
* **Value Proposition:** Capitalizes on intrinsic visual appreciation and the Open Playing Cards format, replacing cheap mobile "gem/coin" economies with genuine aesthetic craftsmanship.

### 5.3 Silent Seed Shadows (Asynchronous Duels)
* **Description:** When playing a shared seed, a subtle, unobtrusive brass dial in the header displays an anonymous opponent’s or friend's parallel card count, letting you race against their "shadow" in real time without screen clutter or chat boxes.
* **Value Proposition:** Offers the thrill of competition for introverted card players who crave human connection without toxicity, time limits, or high-pressure matchmaking.
