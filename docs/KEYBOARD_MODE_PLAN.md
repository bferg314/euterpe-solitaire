# Keyboard Mode — Implementation Plan `[Implemented]`

Play every game (Klondike Turn 1, Klondike Turn 3, Pyramid) without a mouse.

## Where things stand

- **Global keys** live in one `keydown` listener in `App.tsx`: `H` (hint), `Ctrl+Z` / `Ctrl+Y` (undo/redo), `Escape` (close every modal).
- **Cards can't be reached by keyboard.** They are `div`s with `onClick`, no `tabIndex`, and there are no focus styles.
- **Klondike move logic is inside `KlondikeBoard.tsx`.** Drag/drop handlers and the smart-tap handler each splice state on their own. The engine only exposes the rule checks (`canDropOnTableau`, `canDropOnFoundation`) and `findSmartDestination`.
- **Pyramid already works as select-then-pair** (`handleCardInteraction` plus `selectedCard` in state), which maps directly onto keys.

## Interaction model

**Roving cursor.** The board is a single Tab stop with a gold focus cursor that the arrow keys move between piles or cards. Tabbing to each of 52 cards would be slow, and Tab still reaches the header buttons as it does today.

- **Entering and leaving:** keyboard mode turns on at the first arrow, number or Space key while the board is focused. The cursor hides on `pointerdown` or mouse movement over the board, so mouse players never see it.
- **Locked out:** board keys do nothing while a modal is open, during a Fork preview (`forkPreviewIndex !== null`), or while a card is animating (`isFlyingRef`).

### Klondike

| Key | Action |
| --- | --- |
| `←` `→` | Move between piles in the current row (stock, waste, 4 foundations / 7 tableau columns) |
| `↓` from top row | Go to the tableau column below |
| `↑` `↓` in a column | Change how many face-up cards to pick up; `↑` past the top face-up card goes to the top row |
| `Space` | **Pick up** the cards at the cursor. Press again on a pile to **drop** them there. An invalid drop plays the error bump and keeps the cards held |
| `Enter` | **Smart move**: same as a click (`findSmartDestination`), with the gold flight animation |
| `1`–`7` | Jump to a tableau column (drops there if holding cards) |
| `F` | Send the card at the cursor to a foundation, if legal |
| `D` | Draw from stock (or recycle waste when stock is empty) |
| `W` | Jump to the waste |
| `Esc` | Put held cards back. When nothing is held, it closes modals as it does today |

### Pyramid

| Key | Action |
| --- | --- |
| `←` `→` | Previous/next card in the row, skipping cleared slots |
| `↑` `↓` | Move to the nearest card in the row above/below, by position on screen. `↓` from the bottom row goes to stock/waste |
| `Space` / `Enter` | Same as a click: select, pair to 13, or clear a King (existing `handleCardInteraction`) |
| `D` | Draw from stock |
| `W` | Select the top waste card |
| `Esc` | Clear the selection first, then close modals |

The cursor can rest on covered cards so the player can read them, but selecting one plays the error bump, matching the mouse behaviour.

### Shared

- `?` opens a keyboard shortcut sheet, which also becomes a section in `RulesModal`.
- `H`, `Ctrl+Z` and `Ctrl+Y` stay as they are, and `U` also undoes. After undo/redo, move the cursor back onto the nearest valid spot if its pile has shrunk.

## Implementation phases

### Phase 1: Move logic into the engine (refactor, no behaviour change)
Add `applyKlondikeMove(state, source, target): KlondikeState | null` to `klondikeEngine.ts`.
- `source` is `{ pile: 'tableau', col, index } | { pile: 'waste' } | { pile: 'foundation', index }`.
- `target` is `{ pile: 'tableau', col } | { pile: 'foundation', index }`.

It clones the state, validates the move, moves the cards, flips the newly exposed card, and returns `null` for an illegal move. The two drop handlers and `handleCardClick` then call it instead of splicing state themselves, so mouse and keyboard can't drift apart. This is also the right moment to add Vitest with unit tests for this function; it's the riskiest part.

### Phase 2: Cursor model and key routing
- Add `src/hooks/useBoardKeyboard.ts`. It holds the cursor state (`{ zone, pile, depth }` for Klondike, `{ row, col } | stock | waste` for Pyramid) and turns key presses into board actions.
- The board container gets `tabIndex={0}`, `role="application"` and an `aria-label` explaining the controls.
- Change `App.tsx`'s listener so `Escape` first asks the board to cancel whatever is held or selected (a `ref` callback), and only closes modals if nothing was cancelled.

### Phase 3: Klondike
- Connect the cursor to piles using the existing `id`s (`tableau-col-N`, `foundation-slot-N`, `card-<instanceId>`) so the cursor ring and the flight animation positions come from real DOM rectangles.
- Pick-up/drop calls `applyKlondikeMove`; `Enter` calls the existing `handleCardClick(card)`.
- Held cards show as lifted: offset upward with a gold glow, like `activeDrag` does today.

### Phase 4: Pyramid
- Grid navigation with nearest-card lookup for `↑` `↓`, using each card wrapper's position on screen. Pyramid rows are offset from each other, so "the card above" is ambiguous without it.
- Actions call the existing `handleCardInteraction` / `handleStockClick`.

### Phase 5: Visuals and accessibility
- `.kb-cursor`: a gold outline that must look different from `isHint` and `isSelected`, in every theme.
- Honour `prefers-reduced-motion` for the lifted cards and cursor movement.
- A visually hidden `aria-live="polite"` region announcing what's under the cursor and each move result, e.g. "7 of Hearts, column 3, 2 cards", "Moved 7 of Hearts to column 5", "Can't place 7 of Hearts there".

### Phase 6: Discoverability
- `?` shortcut sheet and a Rules section.
- A one-time hint ("Arrow keys to play · ? for shortcuts") the first time the board gets keyboard focus, remembered in `settingsService`.
- Add feature 1.4 to `FEATURE_ROADMAP.md`.

## Open questions

1. ~~**What `Enter` does in Klondike.**~~ Decided: `Enter` plays the card (same as a click); `Space` picks up and drops.
2. **Letter keys vs. typing.** `D`, `F`, `W` and `?` are ignored when focus is in an input (the current guard already covers this). It's worth checking the Seed modal specifically.
3. **Flow-State Auto-Deal (roadmap 2.3)** plans to use `Space` for "deal next hand". That's fine, since it only appears after a win, but it must not also trigger a board action.

## Test checklist

- Win a full Klondike Turn 1 and Turn 3 game, and a Pyramid game, with the keyboard only.
- Undo/redo while holding cards.
- The cursor stays valid after the Safe-Play Vacuum auto-moves a card out from under it.
- Mouse and keyboard mixed mid-game.
- Screen reader smoke test (NVDA + Chrome).
