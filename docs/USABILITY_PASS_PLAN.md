# Usability Pass — Implementation Plan `[Implemented]`

This pass fixes the header menus and buttons, the Statistics viewer, and modal accessibility. It is sized for one focused session and ships as two PRs. Items the session leaves out are listed in the [Backlog](#backlog) so they can be picked up later.

## Where things stand

These findings come from reading the code and running the production build in Chromium at 1440, 1180, 900 and 390px wide, with sample match history loaded.

- **Losses are never recorded.** `recordGameResult` is only called with `won=true`, from the two victory effects in `App.tsx`. Win rate reads 100% after one win, the streak never resets, and the "Abandoned" result in history never appears.
- **The header doesn't fit below 1303px.** Its content is 1303px wide and it has no responsive rules. At 1180px Stats, Sound and Rules are off-screen, and at 390px only the logo and mode tabs are visible.
- **Replay in Stats discards the current game without asking.** `onReplaySeed` calls `startNewDeal` directly. New Deal, mode switch and seed load all ask first.
- **The Stats filters don't apply to history.** The tiles follow mode and difficulty; the history table shows every mode. Difficulty always opens on Medium.
- **Par Efficiency shows 100% with no games played.** The default is 100, and the average includes wins that had no Par.
- **The history table is wider than the modal.** At 640px the Replay column is cut off; on a phone most columns are hidden.
- **Import overwrites everything without asking.** It reports success for any valid JSON, even `{}`. Import, Reset and Share use native `alert`/`confirm`.
- **Modals aren't accessible dialogs.** Only Confirm and the Trainer overlays have `role="dialog"`. Focus stays behind the Stats, Seed, Theme, Deck and Rules modals, and their close buttons have no accessible name.
- **The seed pill and tier cards are clickable `div`s.** The seed pill is the only way to change difficulty. Clicking a tier card replaces a seed you've typed.
- **Names disagree.** Mode is "Klondike (1)" in the tabs, "Klondike (Turn 1)" in the confirm dialog and `klondike-1` in history. Difficulty is Relaxed/Standard/Master in the Seed modal and Easy/Medium/Hard elsewhere.
- **Smaller header problems:**
  - Auto Finish and the Vacuum toggle both use the Sparkles icon.
  - The deck manager uses a folder icon.
  - `H` shows a hint even while a modal is open.
  - Redo accepts only Ctrl+Y.

## Decisions

- **An abandoned game counts as a loss** if it had at least one move. It's recorded when the player confirms a "forfeit this board?" prompt.
- **Replays count like any other game.** A replayed seed played to completion is a win. One abandoned after a move is a loss. There's no separate replay flag.
- **Stats already saved are left as they are.** The app has had little use, so the old inflated numbers will be diluted by new games.

## PR 1 — `fix/stats-recording`

**Record losses**
- Add `forfeitCurrentGame()` in `App.tsx`. When `moves > 0 && !isWon`, it calls `recordGameResult(gameMode, difficulty, false, …)`.
- Call it from the `onConfirm` of `handleRequestSelectMode`, `handleRequestNewGame` and `handleRequestApplySeed`.
- Resumed saved games and the Daily go through these handlers, so they're covered. Branching with the Fork is not a new game and records nothing.
- A game counts as started only once the player moves. The Vacuum can sweep an Ace home on the deal, and those sweeps (descriptions starting with `VACUUM_MOVE_PREFIX`) don't count. Without this, leaving an untouched deal asked for confirmation and recorded a loss.

**Make Stats Replay confirm first**
- Route the Stats modal's Replay through the same confirm-and-forfeit path as a seed load.
- The row can be for another mode, so the path takes a mode as well as a difficulty and seed.

**Fix the efficiency stat**
- `averageEfficiency` starts empty instead of 100.
- Average only over wins that had a Par. The number of those wins is the sum of the Ace–Bogey tier counts (`ratedWins()`), so no new field is needed and existing records work too.
- Average time counts wins only, now that losses are recorded.

**Check imported backups**
- `importStatsJson` accepts a file only if it has at least one of `stats`, `history` or `dailyWins`, and each one present parses.
- It returns `{ ok, matches }` so the UI can say how many matches the backup holds.

**Tests:** new `src/services/statsService.test.ts`, using the same `localStorage` stub as `settingsService.test.ts`. It checks that:
- a loss counts as a game played and resets the streak;
- efficiency is empty until a win with a Par is recorded;
- efficiency averages only over rated wins;
- importing `{}` fails, and a valid backup reports its match count.

**Check in the browser:**
- On `BENCH-84`, make one move, click New Deal and confirm. Stats should show 0 won of 1 played and the streak should be 0.
- Mid-game, click Replay on a history row. The forfeit confirmation should appear.

## PR 2 — `feat/usability-pass`

**Built differently from the plan, based on measurements:**
- **Settings always live in More.** With full labels, the header needs 1493px while Auto Finish is showing, so folding only the settings at 1280px couldn't make it fit. Stats and Rules stay inline at every width.
- **The breakpoints are measured:**

  | Width | What changes |
  | --- | --- |
  | <1500px | Tabs drop "Klondike" |
  | <1400px | Brand text goes; New Deal and Auto Finish become icons |
  | <1160px | Score is hidden; Trainer and Strategy move into More |
  | <1020px | Two rows, and the action labels come back |
  | <620px | Phone layout |

- **Mode names are "Klondike Turn 1 / Turn 3"**, not "Draw 1 / Draw 3". The Rules, Strategy and Trainer text already said Turn.
- **The Seed modal is titled "Deal Options"**, matching the header's seed button.

### Step 1: Header

**Regroup the buttons** in `HeaderBar.tsx`:

| Group | Buttons |
| --- | --- |
| Play | Undo, Redo, Hint, Fork |
| Learn | Trainer, Strategy |
| Settings | Themes, Decks, Stats, Sound, Auto-move toggle, Rules |

**Add a `HeaderMenu`** (a "More" button with a dropdown):
- It holds the Settings group. Stats and Rules stay visible outside it at every width.
- Keyboard and screen-reader support: `aria-haspopup="menu"`, `aria-expanded`, arrow keys, Esc, and click outside to close.
- Add `menuOpen` to `boardKeyboardEnabled` so board keys pause while it's open.

**Breakpoints** in `index.css`:

| Width | Header layout |
| --- | --- |
| ≥1280px | Everything inline, as now |
| <1280px | The Settings group collapses into More |
| <900px | Hide the brand subtitle and the SCORE counter |
| <620px | Two rows: mode and seed on top, actions below. The Learn group also moves into More |

**Smaller fixes:**
- The Vacuum toggle gets the `Magnet` icon and the label "Auto-move safe cards".
- Decks gets the `Layers` icon.
- The seed pill becomes a `<button>` with a ▾ caret and an accessible name, e.g. "Deal options: MED-53792, Medium".
- Gate `H` with `boardKeyboardEnabled`, the way `U` is.
- Accept ⌘⇧Z / Ctrl+Shift+Z as Redo, and update the Rules → Keyboard sheet to match.

### Step 2: Shared modal wrapper

**New `src/components/Modal.tsx`.** It provides:
- the backdrop;
- `role="dialog"`, `aria-modal`, and `aria-labelledby` pointing at the title;
- focus moved into the modal on open, kept inside it, and returned to the opener on close;
- a close button with `aria-label="Close"`.

**Migrate** Stats, Seed, Theme, Deck and Rules to it. Esc stays with App's global listener.

### Step 3: Statistics viewer

**Filters**
- History follows the mode and difficulty filters.
- Drop the Mode and Tier columns, which fixes the table's overflow.
- Pass `currentDifficulty` so the filter opens on the current game's difficulty.

**Tiles**
- Efficiency shows "--" until there's a rated win.
- Replace the emoji tier row with labelled chips: Ace · Eagle · Birdie · Par · Bogey.

**Below 620px**
- History becomes a list of stacked cards.
- The tiles become a 2×2 grid plus one full-width tile.
- The Export/Import/Reset footer stays pinned while the list scrolls.

**No native `alert`/`confirm`**
- Import and Reset get an inline confirmation row in the footer, e.g. "Replace your stats with this backup (42 matches)? [Replace] [Cancel]".
- The result is shown as a small message on the page.
- In the Victory modal, the Share button's label changes to "Copied!", as the Seed modal's Copy button does.

### Step 4: Names and the Seed modal

**One label for each mode**
- Add `modeLabel()` and `difficultyLabel()` in `src/utils/labels.ts`.
- The tabs, confirm dialog, stats and victory text all use them: "Klondike · Draw 1", "Klondike · Draw 3", "Pyramid".

**Tier cards**
- The headings are Easy / Medium / Hard, matching the seed prefixes and the header badge.
- Make the cards a radio group.
- Picking a tier replaces the seed only if the seed was generated or the box is empty.

**Below 620px**
- The tier cards stack vertically and the action row stays pinned.

If time runs short, ship Steps 1–3 and move Step 4 to a follow-up.

### Check in the browser

Use a Playwright script kept in the session scratchpad, at 1440, 1180, 900 and 390px. At each width it:
- checks that the header's `scrollWidth ≤ clientWidth`;
- checks that New Deal, Stats, Rules and Sound can each be reached, inline or in More;
- opens each migrated modal and confirms that focus lands inside it, Tab stays inside it, and Esc closes it and returns focus to the opener;
- takes screenshots of Stats with sample history, to check filtering and the phone card layout.

Then run build, lint and test, delete the screenshots, and add a "Usability pass" entry to `docs/FEATURE_ROADMAP.md`.

## Backlog

These were found in the assessment but left out of this session:

- **Board sizing on phones.** At 390px the Klondike tableau and foundations overflow the screen. This is a card-sizing job (`--card-w`), separate from the header.
- **Daily streak.** "Daily Challenge trophies" is a total across all modes, with no dates. A streak or calendar would give players a reason to come back each day.
- **More history.** Only 15 of the 100 stored matches are shown. Filtering helps; a "Show more" button or paging would finish the job.
- **Par while it's being worked out.** The header shows a bare "…". Use a small spinner with the tooltip "Par: working…".
- **SCORE versus PAR.** The two counters sit side by side, and it isn't clear how they differ. Consider hiding Score by default now that Par is the main measure.
- **Direct Daily entry point.** The Daily is two clicks deep, behind the seed pill. A header or More-menu item would make it easier to find.
- **Theme cards.** In the Theme modal they're clickable `div`s, so the keyboard can't reach them. Make them a radio group like the Seed modal's difficulty tiers.
- **Focus styles.** Only the ScrollRow arrows have a `:focus-visible` style. Everything else relies on the browser default ring, which doesn't match the gold parlor look.
