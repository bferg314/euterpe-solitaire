# Klondike Solver & Trainer — Implementation Plan `[Planned]`

Bring the Trainer (roadmap 3.4) to Klondike Turn 1 and Turn 3, and make random dealing the default in every game.

## Decisions

- **Deals are random by default, like a real deck.** Some deals can't be won, and that's part of the game. "Winnable deals only" stays available as an option in the seed picker, **off by default**, for Pyramid now and for Klondike once its solver can check deals. The Daily Challenge stays checked as winnable, because everyone plays the same deal.
- **Par comes from the solver only when it finds a win.** Otherwise Par is the estimate (`~Par`), with a plain note: *"Estimated Par. There's no guarantee this deal can be won."* The note is the same whether the solver proved the deal unwinnable or ran out of time, so the header doesn't give away an unwinnable deal.
- **Ratings:**
  - Klondike Turn 1 keeps the golf-exact ladder (1-move bands).
  - Klondike Turn 3 gets wider bands like Pyramid. In Turn 3, one missed play can cost a whole stock pass, and the solver's line is fuzzier. The slack and band width come from the Phase 0 numbers.
- **The Trainer shows hidden cards face-down**, as the player sees them, with the footnote "The bot knows where every card is."
- **The bot can fail.** A deal may be unwinnable, or the solver may run out of its search budget. Either way, the Trainer still plays its **best attempt** and says honestly why it stopped. It never claims a deal is unwinnable unless the solver proved it.
- **It teaches principles, not just lines.** Moves are tagged with the standard Klondike rules of thumb they follow, and slips name the rule they broke.

## Where things stand (review of the Pyramid Trainer)

- **Solver:** `pyramidSolver.ts` is an exact A* search over bitmask states with an admissible heuristic. It clears exposed Kings first (a forced move), and a `maxLength` cap makes "is there a finish within N moves?" cheap to answer.
- **Line builder:** `lineBuilder.ts` builds each tier by taking the Ace line and swapping in real slips: a different legal move, then the shortest finish from there. `FinishCache` shares re-solves across the tiers. Lines stream from the worker Ace first, and `TrainerView` replays them through `applyPyramidMove` on a read-only `PyramidBoard`.
- **Hard-wired to Pyramid:**
  - the line builder: `PyramidState`, `solvePyramid`, `stateKey`, the move text, `tierRange(… 'pyramid')` and `BOGEY_MAX_OVER_PAR`
  - the worker message types in `solverClient.ts`
  - `TrainerView`: `dealPyramid`, `PyramidBoard`, `cardIdsFor` and the Pyramid deal finder
- **Klondike bypasses the engine** in three places: the safe-play vacuum (`KlondikeBoard.tsx`), auto-finish (`App.tsx`), and draw/recycle (`handleStockClick`, while `drawStock` goes unused). Bot lines have to replay through the same rules path, so these move into the engine first.
- **Each deal is solved twice:** once for Par and again when the Trainer opens, because `parService` caches only the Ace length. Klondike solves will be slower, so the Trainer should reuse the par solve.
- **Unwinnable deals have no Trainer content.** Pyramid only offers "Find a winnable deal"; with random dealing as the default, that becomes common.

## How Klondike differs

- **How moves are counted** (matching `handleKlondikeChange`). Each of these is 1 move:
  - a tableau run moved (any length)
  - a waste or tableau card to a foundation
  - a foundation card back to the tableau
  - a draw (1 or 3 cards)
  - a recycle (unlimited passes)
  - each vacuum or auto-finish card

  Every card must reach a foundation exactly once, so the vacuum and auto-finish never add moves to a win.
- **Keeping the search small:**
  - Play safe foundation moves automatically (the same rule as the vacuum), like Pyramid's forced Kings.
  - Ignore column order in the state key, so boards that differ only by which column holds what count as one state.
  - Store the stock and waste like Pyramid's reserve: a mask of removed cards plus a pointer, which handles Turn 3 cleanly.
  - Use a packed representation instead of cloning `KlondikeState`.
- **Lower bound for A\*:** cards not yet on a foundation, plus the draws still needed (Turn 1: one per stock card; Turn 3: one per three). Tighten it only if Phase 0 shows it's too weak.
- **Slips:** in Turn 1 a slip usually costs 1–3 moves. In Turn 3 a missed play can cost a whole stock pass, much like Pyramid.

## Phases (one PR each)

### Phase 0 — Benchmark (throwaway test, no PR)

Prototype the solver and run it on about 100 fixed seeds each for Turn 1 and Turn 3. Report:

- how many deals it solves, proves unwinnable, or gives up on (out of budget) within about 2–4 s
- the spread of node counts and Ace lengths
- the slip-cost distribution (to set the Turn 3 bands)
- how far `estimateKlondikePar` lands from the solver's line

### Phase 1 — Random by default

- Set the `winnableOnly` default to `false`.
- Add the no-guarantee note to the estimated Par tooltip (the Victory dialog keeps "PAR (EST.)": a won deal was winnable).
- Update the seed picker copy: a random deal "may not be winnable", and the toggle hint says what checking it does.
- Update the Strategy Guide and the roadmap entry for 1.5.
- Keep the explicit-seed "heads up" as it is.

### Phase 2 — Klondike engine path and solver

- **Engine:**
  - Add a `KlondikeSolverMove` type (`move | draw | recycle`) and `applyKlondikeSolverMove` / `listKlondikeMoves`.
  - Route draw, recycle, the vacuum and auto-finish through the engine.
- **Solver:** build it in `klondikeSolver.ts`. `estimateKlondikePar` stays as the fallback. The solver also reports its **best attempt** when it doesn't win: the line reaching the position with the most cards home, fewest moves on a tie.
- **Worker and Par:**
  - Add a `mode` field to the worker's `solve` request.
  - `parService`: solver-based Par for Klondike when solved, the estimate plus the note otherwise.
- **Ratings:** add a Turn 3 ladder in `efficiencyRating.ts` (`ladderFor` per mode).
- **Tests:**
  - compare against a brute-force search on small hand-built positions
  - use fixed seeds with known results (solved, unwinnable, out of budget)
  - replay every line legally through the engine
  - keep `npm test` near 10 s

### Phase 3 — Generic Trainer, then Klondike

- **Generic builder:**
  - Extract a `TrainerGame<S, M>` interface: solve, list moves, apply, state key, move text, mode and Bogey cap.
  - `lineBuilder` becomes generic, and Pyramid gets an adapter.
  - Snapshot Pyramid's current lines for fixed seeds first; the refactor must reproduce them exactly.
- **Klondike adapter:**
  - move text: "Moved 7♠ onto 8♥", "Drew three cards", "Played A♣ to the foundation"
  - a per-mode Bogey cap
- **Worker and caching:** make the worker's messages and the `tierLines` request work for both games, and reuse the par solve's line instead of solving again.
- **Board:** `KlondikeBoard` gets `interactive` and `highlightCardIds` props, and `TrainerView` picks the board by game mode.
- **Best attempt** (both games), used when there's no winning line:
  - Replace the dead end with a single "Best attempt" line.
  - Say how far it got ("41 of 52 cards home" / "24 of 28 cleared").
  - Say why it stopped: "This deal can't be won" only when proven; otherwise "The bot didn't find a win. This deal may still be winnable."
  - Keep "Find a winnable deal" next to it.
- **Principles:**
  - A pure `principleFor(state, move)` tags moves with the rule of thumb they follow:
    - play Aces and 2s at once
    - turn over face-down cards, biggest hidden pile first
    - don't empty a column without a King to fill it
    - send cards to the foundation only when safe or when it frees something
    - Turn 3: plan draws so the stock order changes
  - Slip lessons name the rule the slip broke.
  - The copy says what a move does, never that it's *why* the solver chose it.
- **Entry points and copy:**
  - Enable the header Trainer button and Victory's "Watch the Ace line" for Klondike.
  - Update the Strategy Guide and the roadmap.
  - The keyboard sheet is unchanged (same keys).

### Phase 4 — Winnable-only Klondike (optional)

- Generalize `dealFinder` so the toggle (off by default) works for Klondike too.
- Base difficulty on each deal's Ace line where the numbers support it.
- Make the Klondike Daily Challenge checked winnable, with a fixed node budget so it's the same deal on every machine.
