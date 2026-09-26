import type { SolitaireCard, KlondikeState, DifficultyLevel } from '../types/solitaire';
import { SeededRNG } from '../services/rngService';
import type { LoadedDeck } from '../services/deckLoader';
import { createStandardPack } from '../services/standardPack';

export interface MoveStep {
  from: 'tableau' | 'waste' | 'foundation';
  fromCol?: number;
  fromIndex?: number;
  to: 'tableau' | 'foundation' | 'waste' | 'stock';
  toCol?: number;
  cards: SolitaireCard[];
  unflippedCard?: { col: number; index: number };
  stockRecycle?: boolean;
}

/**
 * Checks if two card colors alternate (Red on Black or Black on Red)
 */
export function isAlternatingColor(c1: SolitaireCard, c2: SolitaireCard): boolean {
  const isC1Red = c1.suit === 'hearts' || c1.suit === 'diamonds';
  const isC2Red = c2.suit === 'hearts' || c2.suit === 'diamonds';
  return isC1Red !== isC2Red;
}

/**
 * Deal a new Klondike game based on seed and difficulty
 */
export function dealKlondike(
  deck: LoadedDeck,
  seed: string,
  drawCount: 1 | 3 = 1,
  difficulty: DifficultyLevel = 'medium'
): KlondikeState {
  const rng = new SeededRNG(seed);
  const cards = createStandardPack(deck);

  let shuffled: SolitaireCard[];

  if (difficulty === 'easy') {
    // Biased shuffle: pull Aces and lower cards into tableau face-up positions
    shuffled = rng.shuffle(cards);
    // Find Aces and swap them closer to the tableau exposed positions
    const tableauExposedIndices = [0, 2, 5, 9, 14, 20, 27];
    const aceIndices: number[] = [];
    shuffled.forEach((c, i) => {
      if (c.rank === 'A') aceIndices.push(i);
    });

    for (let i = 0; i < Math.min(2, aceIndices.length); i++) {
      const aceIdx = aceIndices[i];
      const targetIdx = tableauExposedIndices[i];
      if (targetIdx !== undefined && aceIdx !== undefined) {
        [shuffled[aceIdx], shuffled[targetIdx]] = [shuffled[targetIdx], shuffled[aceIdx]];
      }
    }
  } else if (difficulty === 'hard') {
    // Ensure Aces are buried deep
    shuffled = rng.shuffle(cards);
    const tableauHiddenIndices = [1, 3, 4, 6, 7, 8, 10, 11, 12, 13];
    const aceIndices: number[] = [];
    shuffled.forEach((c, i) => {
      if (c.rank === 'A') aceIndices.push(i);
    });

    for (let i = 0; i < Math.min(3, aceIndices.length); i++) {
      const aceIdx = aceIndices[i];
      const targetIdx = tableauHiddenIndices[i];
      if (targetIdx !== undefined && aceIdx !== undefined) {
        [shuffled[aceIdx], shuffled[targetIdx]] = [shuffled[targetIdx], shuffled[aceIdx]];
      }
    }
  } else {
    // Standard uniform shuffle
    shuffled = rng.shuffle(cards);
  }

  // Deal 7 tableau columns
  const tableau: SolitaireCard[][] = [[], [], [], [], [], [], []];
  let cardIdx = 0;

  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = { ...shuffled[cardIdx++] };
      card.faceUp = row === col; // Only topmost card is face-up
      tableau[col].push(card);
    }
  }

  // Remaining 24 cards become Stock (all face-down)
  const stock: SolitaireCard[] = [];
  while (cardIdx < shuffled.length) {
    const card = { ...shuffled[cardIdx++] };
    card.faceUp = false;
    stock.push(card);
  }

  return {
    tableau,
    foundations: [[], [], [], []], // 4 suit foundations
    stock,
    waste: [],
    drawCount,
  };
}

/**
 * Checks if a card can be placed on a specific foundation pile
 */
export function canDropOnFoundation(card: SolitaireCard, foundationPile: SolitaireCard[]): boolean {
  if (!card.value || !card.suit) return false;

  if (foundationPile.length === 0) {
    return card.rank === 'A'; // Must start with Ace
  }

  const top = foundationPile[foundationPile.length - 1];
  return top.suit === card.suit && card.value === (top.value || 0) + 1;
}

/**
 * Checks if a card or stack of cards can be dropped onto a tableau column
 */
export function canDropOnTableau(movingCard: SolitaireCard, column: SolitaireCard[]): boolean {
  if (!movingCard.faceUp || !movingCard.value) return false;

  if (column.length === 0) {
    return movingCard.rank === 'K'; // Only King can be placed on empty space
  }

  const top = column[column.length - 1];
  if (!top.faceUp || !top.value) return false;

  return isAlternatingColor(movingCard, top) && movingCard.value === top.value - 1;
}

/**
 * Stock click handler: draws 1 or 3 cards to Waste, or recycles Waste back to Stock
 */
export function drawStock(state: KlondikeState): KlondikeState {
  const next = cloneKlondikeState(state);

  if (next.stock.length === 0) {
    // Recycle waste back to stock
    if (next.waste.length === 0) return next;
    next.stock = next.waste.reverse().map((c) => ({ ...c, faceUp: false }));
    next.waste = [];
    return next;
  }

  const count = Math.min(next.drawCount, next.stock.length);
  for (let i = 0; i < count; i++) {
    const card = next.stock.pop();
    if (card) {
      card.faceUp = true;
      next.waste.push(card);
    }
  }

  return next;
}

/**
 * Automatically find the best move for a clicked card
 */
export function findAutoMove(
  card: SolitaireCard,
  state: KlondikeState
): { type: 'foundation' | 'tableau'; targetCol: number; from: 'tableau' | 'waste'; fromCol?: number; cardIndex?: number } | null {
  if (!card.faceUp) return null;

  // 1. Try to move to Foundations first
  for (let fIdx = 0; fIdx < 4; fIdx++) {
    if (canDropOnFoundation(card, state.foundations[fIdx])) {
      // Find where card is
      if (state.waste.length > 0 && state.waste[state.waste.length - 1].instanceId === card.instanceId) {
        return { type: 'foundation', targetCol: fIdx, from: 'waste' };
      }
      for (let tCol = 0; tCol < 7; tCol++) {
        const col = state.tableau[tCol];
        if (col.length > 0 && col[col.length - 1].instanceId === card.instanceId) {
          return { type: 'foundation', targetCol: fIdx, from: 'tableau', fromCol: tCol, cardIndex: col.length - 1 };
        }
      }
    }
  }

  // 2. Try to move to Tableau
  // Check if card is from waste
  if (state.waste.length > 0 && state.waste[state.waste.length - 1].instanceId === card.instanceId) {
    for (let tCol = 0; tCol < 7; tCol++) {
      if (canDropOnTableau(card, state.tableau[tCol])) {
        return { type: 'tableau', targetCol: tCol, from: 'waste' };
      }
    }
  }

  // Check if card is from tableau
  for (let sCol = 0; sCol < 7; sCol++) {
    const col = state.tableau[sCol];
    const cIdx = col.findIndex((c) => c.instanceId === card.instanceId);
    if (cIdx !== -1 && col[cIdx].faceUp) {
      // If moving a King to an empty column, only do so if it frees up face-down cards
      for (let tCol = 0; tCol < 7; tCol++) {
        if (tCol === sCol) continue;
        if (canDropOnTableau(card, state.tableau[tCol])) {
          // If empty column and King already at bottom of non-empty face-down stack, don't do useless cycle
          if (state.tableau[tCol].length === 0 && cIdx === 0) continue;
          return { type: 'tableau', targetCol: tCol, from: 'tableau', fromCol: sCol, cardIndex: cIdx };
        }
      }
    }
  }

  return null;
}

/**
 * Checks if the game is completely won (all 52 cards on foundations)
 */
export function isKlondikeWon(state: KlondikeState): boolean {
  const totalInFoundations = state.foundations.reduce((sum, f) => sum + f.length, 0);
  return totalInFoundations === 52;
}

/**
 * Checks if auto-finish is possible (all tableau cards face-up, stock and waste empty)
 */
export function canAutoFinish(state: KlondikeState): boolean {
  if (state.stock.length > 0 || state.waste.length > 0) return false;
  for (const col of state.tableau) {
    for (const c of col) {
      if (!c.faceUp) return false;
    }
  }
  return !isKlondikeWon(state);
}

/**
 * Performs one auto-finish step
 */
export function getNextAutoFinishMove(state: KlondikeState): { fromCol: number; toFoundation: number } | null {
  for (let colIdx = 0; colIdx < 7; colIdx++) {
    const col = state.tableau[colIdx];
    if (col.length === 0) continue;
    const top = col[col.length - 1];
    for (let fIdx = 0; fIdx < 4; fIdx++) {
      if (canDropOnFoundation(top, state.foundations[fIdx])) {
        return { fromCol: colIdx, toFoundation: fIdx };
      }
    }
  }
  return null;
}

export function cloneKlondikeState(state: KlondikeState): KlondikeState {
  return {
    tableau: state.tableau.map((col) => col.map((c) => ({ ...c }))),
    foundations: state.foundations.map((pile) => pile.map((c) => ({ ...c }))),
    stock: state.stock.map((c) => ({ ...c })),
    waste: state.waste.map((c) => ({ ...c })),
    drawCount: state.drawCount,
  };
}

export type KlondikeMoveSource =
  | { pile: 'tableau'; col: number; index: number }
  | { pile: 'waste' }
  | { pile: 'foundation'; index: number };

export type KlondikeMoveTarget =
  | { pile: 'tableau'; col: number }
  | { pile: 'foundation'; index: number };

/**
 * Returns the cards a move would lift from `source` (the tableau run from `index` down,
 * or the top waste/foundation card), or an empty array if nothing movable is there.
 */
export function getMovingCards(state: KlondikeState, source: KlondikeMoveSource): SolitaireCard[] {
  if (source.pile === 'tableau') {
    const col = state.tableau[source.col];
    if (!col || source.index < 0 || source.index >= col.length) return [];
    const run = col.slice(source.index);
    return run.every((c) => c.faceUp) ? run : [];
  }
  const pile = source.pile === 'waste' ? state.waste : state.foundations[source.index];
  return pile && pile.length > 0 ? [pile[pile.length - 1]] : [];
}

/**
 * Applies a single Klondike move (drag/drop, smart tap or keyboard): validates it,
 * moves the cards and flips the newly exposed tableau card. Returns the next state
 * and the moved cards, or null when the move is illegal or goes nowhere.
 */
export function applyKlondikeMove(
  state: KlondikeState,
  source: KlondikeMoveSource,
  target: KlondikeMoveTarget
): { next: KlondikeState; cards: SolitaireCard[] } | null {
  const cards = getMovingCards(state, source);
  if (cards.length === 0) return null;

  if (target.pile === 'tableau') {
    if (source.pile === 'tableau' && source.col === target.col) return null;
    const column = state.tableau[target.col];
    if (!column || !canDropOnTableau(cards[0], column)) return null;
  } else {
    if (source.pile === 'foundation' && source.index === target.index) return null;
    const pile = state.foundations[target.index];
    if (!pile || cards.length !== 1 || !canDropOnFoundation(cards[0], pile)) return null;
  }

  const next = cloneKlondikeState(state);
  let moved: SolitaireCard[];
  if (source.pile === 'tableau') {
    moved = next.tableau[source.col].splice(source.index);
    const srcCol = next.tableau[source.col];
    if (srcCol.length > 0 && !srcCol[srcCol.length - 1].faceUp) {
      srcCol[srcCol.length - 1].faceUp = true;
    }
  } else if (source.pile === 'waste') {
    moved = [next.waste.pop()!];
  } else {
    moved = [next.foundations[source.index].pop()!];
  }

  if (target.pile === 'tableau') {
    next.tableau[target.col].push(...moved);
  } else {
    next.foundations[target.index].push(...moved);
  }
  return { next, cards: moved };
}
