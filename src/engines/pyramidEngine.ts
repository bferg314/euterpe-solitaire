import type { SolitaireCard, PyramidState, DifficultyLevel } from '../types/solitaire';
import { SeededRNG } from '../services/rngService';
import type { LoadedDeck } from '../services/deckLoader';
import { createStandardPack } from '../services/deckLoader';

/**
 * Checks if a card at row, col in the 7-row pyramid is exposed (not covered by row+1 cards)
 */
export function isPyramidCardExposed(pyramid: (SolitaireCard | null)[][], row: number, col: number): boolean {
  if (pyramid[row][col] === null) return false;
  if (row === 6) return true; // Bottom row cards are naturally exposed until covered

  const leftChild = pyramid[row + 1]?.[col];
  const rightChild = pyramid[row + 1]?.[col + 1];

  return leftChild === null && rightChild === null;
}

/**
 * Deal a new Pyramid Solitaire game based on seed and difficulty
 */
export function dealPyramid(
  deck: LoadedDeck,
  seed: string,
  difficulty: DifficultyLevel = 'medium'
): PyramidState {
  const rng = new SeededRNG(seed);
  const cards = createStandardPack(deck);

  let shuffled = rng.shuffle(cards);

  if (difficulty === 'easy') {
    // In easy mode, make sure bottom row (row 6, 7 cards) contains at least one King or an easy pair
    const kings = shuffled.filter((c) => c.rank === 'K');
    if (kings.length > 0) {
      const bottomRowIndexInDeal = 21 + Math.floor(rng.next() * 7);
      const kingIndex = shuffled.findIndex((c) => c.rank === 'K');
      if (kingIndex !== -1) {
        [shuffled[bottomRowIndexInDeal], shuffled[kingIndex]] = [shuffled[kingIndex], shuffled[bottomRowIndexInDeal]];
      }
    }
  }

  // 28 cards in pyramid (rows 0..6)
  const pyramid: (SolitaireCard | null)[][] = [];
  let cardIdx = 0;

  for (let row = 0; row < 7; row++) {
    pyramid[row] = [];
    for (let col = 0; col <= row; col++) {
      const card = { ...shuffled[cardIdx++] };
      card.faceUp = true; // In Pyramid, all cards are face up
      pyramid[row][col] = card;
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
    pyramid,
    stock,
    waste: [],
    selectedCard: null,
    clearedPairs: 0,
  };
}

/**
 * Checks if a card is a King (value = 13)
 */
export function isKing(card: SolitaireCard): boolean {
  return card.value === 13 || card.rank === 'K';
}

/**
 * Checks if two cards sum to 13
 */
export function doCardsSumTo13(c1: SolitaireCard, c2: SolitaireCard): boolean {
  const v1 = c1.value || 0;
  const v2 = c2.value || 0;
  return v1 + v2 === 13;
}

/**
 * Draws from Stock to Waste or recycles Waste back to Stock
 */
export function drawPyramidStock(state: PyramidState): PyramidState {
  const next = clonePyramidState(state);
  next.selectedCard = null; // Reset selection on draw

  if (next.stock.length === 0) {
    if (next.waste.length === 0) return next;
    next.stock = next.waste.reverse().map((c) => ({ ...c, faceUp: false }));
    next.waste = [];
    return next;
  }

  const drawn = next.stock.pop();
  if (drawn) {
    drawn.faceUp = true;
    next.waste.push(drawn);
  }

  return next;
}

/**
 * Checks if the pyramid is completely cleared (Win Condition)
 */
export function isPyramidWon(state: PyramidState): boolean {
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col <= row; col++) {
      if (state.pyramid[row][col] !== null) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Counts how many cards have been cleared from the pyramid (0 to 28)
 */
export function countPyramidCardsCleared(state: PyramidState): number {
  let cleared = 0;
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col <= row; col++) {
      if (state.pyramid[row][col] === null) {
        cleared++;
      }
    }
  }
  return cleared;
}

/**
 * Find available pairs or kings for smart hints
 */
export function findPyramidHint(state: PyramidState): {
  card1: { source: 'pyramid' | 'waste'; row?: number; col?: number };
  card2?: { source: 'pyramid' | 'waste'; row?: number; col?: number };
} | null {
  const exposedPyramidCards: { card: SolitaireCard; row: number; col: number }[] = [];

  for (let row = 0; row < 7; row++) {
    for (let col = 0; col <= row; col++) {
      const card = state.pyramid[row][col];
      if (card && isPyramidCardExposed(state.pyramid, row, col)) {
        if (isKing(card)) {
          return { card1: { source: 'pyramid', row, col } };
        }
        exposedPyramidCards.push({ card, row, col });
      }
    }
  }

  const topWaste = state.waste.length > 0 ? state.waste[state.waste.length - 1] : null;
  if (topWaste && isKing(topWaste)) {
    return { card1: { source: 'waste' } };
  }

  // Look for pairs between exposed pyramid cards
  for (let i = 0; i < exposedPyramidCards.length; i++) {
    for (let j = i + 1; j < exposedPyramidCards.length; j++) {
      const p1 = exposedPyramidCards[i];
      const p2 = exposedPyramidCards[j];
      if (doCardsSumTo13(p1.card, p2.card)) {
        return {
          card1: { source: 'pyramid', row: p1.row, col: p1.col },
          card2: { source: 'pyramid', row: p2.row, col: p2.col },
        };
      }
    }
  }

  // Look for pair between exposed pyramid card and top waste
  if (topWaste) {
    for (const p of exposedPyramidCards) {
      if (doCardsSumTo13(p.card, topWaste)) {
        return {
          card1: { source: 'pyramid', row: p.row, col: p.col },
          card2: { source: 'waste' },
        };
      }
    }
  }

  return null;
}

export function clonePyramidState(state: PyramidState): PyramidState {
  return {
    pyramid: state.pyramid.map((row) => row.map((c) => (c ? { ...c } : null))),
    stock: state.stock.map((c) => ({ ...c })),
    waste: state.waste.map((c) => ({ ...c })),
    selectedCard: state.selectedCard ? { ...state.selectedCard } : null,
    clearedPairs: state.clearedPairs,
  };
}
