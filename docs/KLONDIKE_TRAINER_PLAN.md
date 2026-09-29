# Klondike Solver & Trainer — Implementation Plan `[Phases 0–3 done]`

Bring the Trainer (roadmap 3.4) to Klondike Turn 1 and Turn 3, and make random dealing the default in every game.

## Decisions

- **Deals are random by default, like a real deck.** Some deals can't be won, and that's part of the game. "Winnable deals only" stays available as an option in the seed picker, **off by default**, for Pyramid now and for Klondike once its solver can check deals. The Daily Challenge stays checked as winnable, because everyone plays the same deal.
- **Klondike Par is always an estimate** (`~Par`), with a plain note: *"Estimated Par. There's no guarantee this deal can be won."*
  - It's the length of the best winning line the solver finds, or the old heuristic when it finds none.
  - The note is the same either way, so the header doesn't give away an unwinnable deal.
  - No Ace is awarded, since the solver's line isn't proven shortest. Matching the bot is Par; beating it is Birdie or Eagle.
- **Ratings:**
  - Klondike Turn 1 keeps the golf-exact ladder (1-move bands).
  - Klondike Turn 3 gets wider bands like Pyramid. In Turn 3, one missed play can cost a whole stock pass, and the solver's line is fuzzier. The slack and band width come from the Phase 0 numbers.
- **The Trainer shows hidden cards face-down**, as the player sees them, with the footnote "The bot knows where every card is."
- **The bot can fail.** A deal may be unwinnable, or the solver may run out of its search budget. Either way, the Trainer still plays its **best attempt** and says honestly why it stopped. It never claims a deal is unwinnable unless the solver proved it.
- **It teaches principles, not just lines.** Moves are tagged with the standard Klondike rules of thumb they follow, and slips name the rule they broke.

## Phase 0 results (benchmark)

100 medium deals each, Node, 150k nodes per pass. Every solved line replayed legally through the engine to a win.

| | Turn 1 | Turn 3 |
|---|---|---|
| Won | 83 | 76 |
| No line within the solver's moves | 0 | 10 |
| Out of budget (unknown) | 17 | 14 |
| First line found, median | 152 moves | 129 moves |
| Best line after more passes: median (range) | 123 (97–186) | 102 (81–131) |
| Proven shortest | 3 of 83 | 16 of 76 |
| Solver line at or under the old heuristic Par (113–118 on every deal) | 26 of 83 | 65 of 76 |
| Time per deal: median / slowest | 6.5 s / 11.7 s | 2.7 s / 6.6 s |

What it means:
- **Exact A\* can't finish on a real Klondike deal** in 300k nodes; weighted passes find lines instead.
- **Turn 1 lines are well above optimal:** extra passes keep cutting about 30 moves. Par stays an estimate (above).
- **The old heuristic hardly varied** (113–118 for every deal), so Par now comes from the solver's line.
- **Slip costs can't be measured** against lines that aren't shortest, so the Klondike Trainer changes shape (Phase 3).

Tuning after the benchmark:
- Positions waiting to be explored are stored as (parent, packed step, g) and rebuilt when explored: live memory went from about 590 MB to 120 MB.
- Deduping only at expansion made the search about 1.5× faster than the benchmarked version, with the same lines.
- Checked against a plain A\* over every legal engine move on 13-card end-games: same shortest length on all six.

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

### Phase 3 — Trainer for both games `[Done]`

**Changed after Phase 0:** Klondike has no proven-shortest line to build Ace-to-Bogey bots from, so the generic line builder was dropped. Pyramid keeps its five bots and its builder; the games share the Trainer's screen instead.

What was built:
- **Klondike trainer module** (`engines/trainer/klondikeTrainer.ts`):
  - Move text, e.g. "Moved 7♠ onto 8♥" and "Play A♣ to the foundation".
  - `klondikePrinciple`: the rule of thumb a move follows, such as Aces and 2s home at once, safe to send home, turning over the column hiding the most, emptying a column for a King, or drawing toward a named card. It says what a move does, never why the solver chose it.
  - `findKlondikeSlips`: tempting alternatives along the bot's line. Each is costed by the bot's best finish after it (a weighted search, so the copy says "the bot's best finish takes N more moves"). They're spread across the game, each card used once and draws at most twice, with at most 8 slips and a fixed node budget, so the result is deterministic.
- **Best attempt, both games:** when there's no win, the Trainer plays the furthest line the solver found, says how far it got, and says why it stopped. Klondike never says "can't be won"; Pyramid does, because its solver proves it. For Pyramid a second search keeps exploring dead positions, since the exact solver stops at the first proof.
- **Worker:** a streaming `klondikeTrainer` request (line first, then slips). The line found for Par is reused, so the Trainer opens in under a second.
- **Screen:**
  - `useTrainerPlayback` and `TrainerControls` are shared.
  - `KlondikeTrainerView` shows "Tempting here" before a slip, with "Watch it" and "Back to the bot's line".
  - `KlondikeBoard` got `interactive` and `highlightCardIds`.
  - Both Trainer views load lazily, which keeps the main bundle under 500 kB.

### Phase 4 — Winnable-only Klondike (optional)

- Generalize `dealFinder` so the toggle (off by default) works for Klondike too.
- Base difficulty on each deal's Ace line where the numbers support it.
- Make the Klondike Daily Challenge checked winnable, with a fixed node budget so it's the same deal on every machine.
