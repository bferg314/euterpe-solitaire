import type { KlondikeState, PyramidState, SolitaireCard } from '../types/solitaire';
import type { DeadlockStatus, TimelineDecisionTag } from '../types/fork';
import { isPyramidCardExposed, isKing, doCardsSumTo13 } from './pyramidEngine';

function isRed(card: SolitaireCard): boolean {
  return card.suit === 'hearts' || card.suit === 'diamonds';
}

function canStackOnTableau(card: SolitaireCard, target: SolitaireCard): boolean {
  if (isRed(card) === isRed(target)) return false;
  const val = card.value || 0;
  const targetVal = target.value || 0;
  return val === targetVal - 1;
}

function canStackOnFoundation(card: SolitaireCard, foundationPile: SolitaireCard[]): boolean {
  if (foundationPile.length === 0) {
    return card.rank === 'A' || card.value === 1;
  }
  const top = foundationPile[foundationPile.length - 1];
  return card.suit === top.suit && (card.value || 0) === (top.value || 0) + 1;
}

/**
 * Checks if a Klondike game has reached an absolute or practical deadlock
 */
export function checkKlondikeDeadlock(state: KlondikeState): DeadlockStatus {
  // 1. Check if any top tableau card can move to any foundation
  for (const col of state.tableau) {
    if (col.length === 0) continue;
    const topCard = col[col.length - 1];
    if (topCard.faceUp) {
      for (const f of state.foundations) {
        if (canStackOnFoundation(topCard, f)) {
          return { isDeadlocked: false };
        }
      }
    }
  }

  // 2. Check if any face-up sequence in tableau can move to another tableau column
  for (let sIdx = 0; sIdx < state.tableau.length; sIdx++) {
    const srcCol = state.tableau[sIdx];
    const faceUpCards = srcCol.filter((c) => c.faceUp);
    if (faceUpCards.length === 0) continue;

    for (const card of faceUpCards) {
      for (let dIdx = 0; dIdx < state.tableau.length; dIdx++) {
        if (sIdx === dIdx) continue;
        const dstCol = state.tableau[dIdx];

        if (dstCol.length === 0) {
          // King can move to empty column
          if (card.rank === 'K' || card.value === 13) {
            // Check if this move is actually productive (e.g. uncovers a face-down card or breaks up a stack)
            const cardIndexInCol = srcCol.findIndex((c) => c.id === card.id);
            if (cardIndexInCol > 0) {
              return { isDeadlocked: false };
            }
          }
        } else {
          const topDst = dstCol[dstCol.length - 1];
          if (topDst.faceUp && canStackOnTableau(card, topDst)) {
            return { isDeadlocked: false };
          }
        }
      }
    }
  }

  // 3. Check if top of waste can move to foundation or tableau
  if (state.waste.length > 0) {
    const topWaste = state.waste[state.waste.length - 1];
    for (const f of state.foundations) {
      if (canStackOnFoundation(topWaste, f)) {
        return { isDeadlocked: false };
      }
    }
    for (const col of state.tableau) {
      if (col.length === 0) {
        if (topWaste.rank === 'K' || topWaste.value === 13) {
          return { isDeadlocked: false };
        }
      } else {
        const topDst = col[col.length - 1];
        if (topDst.faceUp && canStackOnTableau(topWaste, topDst)) {
          return { isDeadlocked: false };
        }
      }
    }
  }

  // 4. Check if any cards in stock could be played on the current board
  const allStockCards = [...state.stock];
  // If stock is empty and waste exists, waste can be recycled
  if (allStockCards.length === 0 && state.waste.length > 0 && (state.passesRemaining === undefined || state.passesRemaining > 0)) {
    allStockCards.push(...state.waste);
  }

  for (const card of allStockCards) {
    for (const f of state.foundations) {
      if (canStackOnFoundation(card, f)) {
        return { isDeadlocked: false };
      }
    }
    for (const col of state.tableau) {
      if (col.length === 0) {
        if (card.rank === 'K' || card.value === 13) {
          return { isDeadlocked: false };
        }
      } else {
        const topDst = col[col.length - 1];
        if (topDst.faceUp && canStackOnTableau(card, topDst)) {
          return { isDeadlocked: false };
        }
      }
    }
  }

  return {
    isDeadlocked: true,
    reason: 'No legal moves remaining on the tableau, waste, or stock.',
  };
}

/**
 * Checks if a Pyramid game has reached a deadlock
 */
export function checkPyramidDeadlock(state: PyramidState): DeadlockStatus {
  const exposed: SolitaireCard[] = [];

  for (let r = 0; r < 7; r++) {
    for (let c = 0; c <= r; c++) {
      const card = state.pyramid[r]?.[c];
      if (card && isPyramidCardExposed(state.pyramid, r, c)) {
        if (isKing(card)) {
          return { isDeadlocked: false };
        }
        exposed.push(card);
      }
    }
  }

  // Check pairs among exposed pyramid cards
  for (let i = 0; i < exposed.length; i++) {
    for (let j = i + 1; j < exposed.length; j++) {
      if (doCardsSumTo13(exposed[i], exposed[j])) {
        return { isDeadlocked: false };
      }
    }
  }

  // Check top of waste
  const topWaste = state.waste.length > 0 ? state.waste[state.waste.length - 1] : null;
  if (topWaste) {
    if (isKing(topWaste)) {
      return { isDeadlocked: false };
    }
    for (const card of exposed) {
      if (doCardsSumTo13(card, topWaste)) {
        return { isDeadlocked: false };
      }
    }
  }

  // Check if any card in stock or waste could match any exposed card
  const availableDraws = [...state.stock];
  if (availableDraws.length === 0 && state.waste.length > 0) {
    availableDraws.push(...state.waste);
  }

  for (const card of availableDraws) {
    if (isKing(card)) {
      return { isDeadlocked: false };
    }
    for (const exp of exposed) {
      if (doCardsSumTo13(card, exp)) {
        return { isDeadlocked: false };
      }
    }
  }

  return {
    isDeadlocked: true,
    reason: 'No matching pairs can be made with remaining exposed cards or stock.',
  };
}

/**
 * Analyzes the difference between two consecutive game states to tag the move
 */
export function tagMoveTransition(
  prevKlondike: KlondikeState | null,
  nextKlondike: KlondikeState | null,
  prevPyramid: PyramidState | null,
  nextPyramid: PyramidState | null,
  rawDesc: string
): { tag: TimelineDecisionTag; insight?: string } {
  if (prevKlondike && nextKlondike) {
    // Count face-down cards
    const prevFaceDown = prevKlondike.tableau.reduce(
      (sum, col) => sum + col.filter((c) => !c.faceUp).length,
      0
    );
    const nextFaceDown = nextKlondike.tableau.reduce(
      (sum, col) => sum + col.filter((c) => !c.faceUp).length,
      0
    );

    if (nextFaceDown < prevFaceDown) {
      return {
        tag: 'reveal',
        insight: `Critical Choice: A face-down card was uncovered. If multiple columns were available to play on, branching from here lets you test other paths.`,
      };
    }

    // Foundations count
    const prevFoundations = prevKlondike.foundations.reduce((sum, f) => sum + f.length, 0);
    const nextFoundations = nextKlondike.foundations.reduce((sum, f) => sum + f.length, 0);
    if (nextFoundations > prevFoundations) {
      return {
        tag: 'foundation',
        insight: `Foundation Lift: Moved a card to foundation. Ensure you didn't need this rank to stage opposite-colored tableau cards!`,
      };
    }

    // King placement
    if (rawDesc.toLowerCase().includes('king') || rawDesc.toLowerCase().includes('empty')) {
      return {
        tag: 'king',
        insight: `Empty Space Placement: Placed a King. If you had other Kings in waste or columns, another choice could unlock different cards.`,
      };
    }

    // Stock draw or recycle
    if (rawDesc.toLowerCase().includes('recycled') || rawDesc.toLowerCase().includes('stock')) {
      return {
        tag: rawDesc.toLowerCase().includes('recycled') ? 'recycle' : 'draw',
        insight: `Stock Progression: Cycled cards from the stock pile.`,
      };
    }

    return { tag: 'move' };
  }

  if (prevPyramid && nextPyramid) {
    if (rawDesc.toLowerCase().includes('king')) {
      return {
        tag: 'king',
        insight: `King Removed: Directly cleared a King from the pyramid.`,
      };
    }
    if (rawDesc.toLowerCase().includes('matched pair')) {
      return {
        tag: 'match',
        insight: `Pair Matched: Cleared a sum-of-13 pair. Check if matching with a different card could expose deeper pyramid rows!`,
      };
    }
    if (rawDesc.toLowerCase().includes('stock') || rawDesc.toLowerCase().includes('recycled')) {
      return {
        tag: rawDesc.toLowerCase().includes('recycled') ? 'recycle' : 'draw',
      };
    }
  }

  return { tag: 'move' };
}
