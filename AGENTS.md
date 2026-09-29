# AGENTS.md

Euterpe Solitaire: a React 19 + TypeScript + Vite solitaire app (Klondike Turn 1 and Turn 3, Pyramid), deployed at https://euterpe.tinyibex.com.

This file holds rules only. What's built and what's next lives in `docs/FEATURE_ROADMAP.md`.

## Commands
- `npm run dev`: dev server.
- `npm run build`: type-check and build.
- `npm run lint`: oxlint.
- `npm test`: Vitest. It should finish in about 10 s; keep it that way.
- `npx vite preview --port 4789 --strictPort`: serve the production build to check the real app in a browser.

## Workflow
- **Start every piece of work on a new branch** off an up-to-date `main` (`git checkout main && git pull && git checkout -b feat/…` or `fix/…`), one branch per feature or fix. Never commit on `main`; merging to `main` deploys. Commit on the branch as you go, but don't push or open a PR until asked. When the user says **"pr and merge"**: push, open a PR with `gh` (what changed, why, how it was tested), squash-merge with `--delete-branch`, then pull `main`.
- **Commit style:** conventional prefixes (`feat:`, `fix:`, `docs:`) with a body explaining why. PR bodies use **Changes** and **Testing** sections, and Testing says what was actually run and checked.
- **Merging deploys.** `.github/workflows/deploy.yml` runs `npm test`, builds, and deploys to Cloudflare Workers (the `CLOUDFLARE_API_TOKEN` repo secret). Watch the run with `gh run watch` and report the result.
- **Before calling work done:** build, lint and tests must pass, and anything visible gets checked in a browser (Playwright against `vite preview`). Delete `.playwright-mcp/` screenshots and any temporary benchmark tests before committing.
- **Big features:** plan first and ship in phases, one PR each (see `docs/`). Keep `docs/FEATURE_ROADMAP.md` current when a feature lands.
- **Measure before deciding.** When a design choice depends on data (solver speed, winnability, difficulty bands, slip costs), benchmark it with a throwaway test and show the numbers. Ask before changing game design (scoring, par, ratings) rather than assuming.

## Architecture rules
- **One rules path.** Moves go through pure engine functions: `applyKlondikeMove` (`src/engines/klondikeEngine.ts`) and `applyPyramidMove` (`src/engines/pyramidEngine.ts`). Boards, keyboard, solver, Trainer bots and tests all use them. Never splice game state directly in components.
- **Solvers run in the worker** (`src/workers/solver.worker.ts`), through `src/services/solverClient.ts` (channels: `par`, `trainer`, `deal`). The worker must stay small: import engine code and `standardPack.ts`, never `deckLoader.ts`, which pulls in JSZip.
- **Par and ratings live in `src/utils/efficiencyRating.ts`** and depend on the game mode:
  - Klondike is golf-exact.
  - Pyramid uses par = Ace + 16 and 4-move bands, because a Pyramid slip usually costs a whole stock pass.
  - Par is cached from the Ace line (`parService.ts`), so formula changes apply to cached deals.
- **Moves count exactly as the game counts them:** draws and recycles count; selecting a Pyramid card doesn't. Solvers and bots must use the same model.
- **Winnable-only dealing** (opt-in, off by default; always on for the Daily) goes through `src/engines/dealFinder.ts` for every game. The Daily walk must stay deterministic (fixed node budgets).

## Tests
- Engine and solver tests load the real deck via `src/test/fixtures.ts` and use **fixed seeds with known results**. Never use random seeds; they make tests slow and flaky.
- Every solver or bot line must replay legally through the engine to a win.
- Note: Easy deals are dealt differently (a King is moved into the bottom row), so the same seed dealt as Easy is a different deal.
- **Known seeds for browser checks** (Pyramid, Medium):
  - `MED-90777`: winnable, 51-move Ace line, par 67. Play the solver's line to reach the Victory dialog on demand.
  - `MED-66732`: unwinnable. Exercises the warnings and unwinnable paths.
- **Known seeds for browser checks** (Klondike Turn 3, Medium):
  - `BENCH-84`: winnable, 94-move bot line (proven shortest), Par ~94. Fast to solve, with slips in the Trainer.
  - `BENCH-53`: no winning line. Exercises the Trainer's best attempt.
- A game with moves is saved to localStorage and resumes on reload; a game with 0 moves isn't saved, so a reload can land on a different mode than expected.

## Windows shell gotchas
- The Bash tool is Git Bash on Windows. Multi-line `sed` inserts (`a\`, `i\`, or `\n` in a replacement) often collapse onto one line: use the edit tool or a heredoc instead.
- Use `python` or `py` (Python 3.14). `python3` is the Microsoft Store placeholder and fails.
- A leftover preview server on port 4789 makes the next `--strictPort` start fail. Stop it with `netstat -ano | grep :4789`, then `taskkill //PID <pid> //F`.
- Put temporary files in the session scratchpad, not `/tmp` or the repo.

## UI conventions
- **Styling:**
  - Match the parlor look: gold `var(--color-gold)`, dark glass panels, theme tokens in `src/index.css`.
  - Cards size from `--card-w`; redefine `--card-h` and `--card-radius` alongside it when overriding.
  - No native-looking scrollbars or tooltips: `title` attributes become anchored tooltips via `TooltipLayer`, and sideways lists use `ScrollRow`.
- **Keyboard and accessibility:**
  - Every game is keyboard-playable (`useBoardKeyboard`), and new modals must close with `Esc` and pause board keys (`boardKeyboardEnabled` in `App.tsx`).
  - Icon-only controls need an accessible name. Update the Rules → Keyboard sheet when adding keys.
- **Copy:** player-facing text is plain and honest. No claims the code doesn't back up (e.g. "verified winnable" only where the solver checked it).
- **Layout:** check narrow screens (390px) for anything in a modal.
