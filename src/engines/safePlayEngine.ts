import type { SolitaireCard, KlondikeState } from '../types/solitaire';
import { canDropOnFoundation, canDropOnTableau } from './klondikeEngine';

export function getFoundationIndexForSuit(suit?: string | null): number {
  switch (suit) {
    case 'spades':
      return 0;
    case 'hearts':
      return 1;
    case 'diamonds':
      return 2;
    case 'clubs':
      return 3;
    default:
      return 0;
  }
}

/**
 * Mathematical Safe-Play Rule:
 * A card of rank V and color C is guaranteed safe to move to its foundation if:
 * 1. V <= 2 (Aces and 2s can never hold other cards on the tableau).
 * 2. V >= 3 AND both foundations of the opposite color are at least rank (V - 1).
 *    Because both opposite-color cards of rank (V - 1) are locked into foundations,
 *    neither can ever need to be placed on this card on the tableau!
 */
export function isCardSafeForFoundation(
  card: SolitaireCard,
  foundations: SolitaireCard[][]
): boolean {
  if (!card.faceUp || !card.value) return false;
  const val = card.value;

  if (val <= 2) {
    return true;
  }

  const topSpades = foundations[0]?.length > 0 ? (foundations[0][foundations[0].length - 1].value || 0) : 0;
  const topHearts = foundations[1]?.length > 0 ? (foundations[1][foundations[1].length - 1].value || 0) : 0;
  const topDiamonds = foundations[2]?.length > 0 ? (foundations[2][foundations[2].length - 1].value || 0) : 0;
  const topClubs = foundations[3]?.length > 0 ? (foundations[3][foundations[3].length - 1].value || 0) : 0;

  const isBlack = card.suit === 'spades' || card.suit === 'clubs';

  if (isBlack) {
    // Opposite color is Red (Hearts & Diamonds)
    return topHearts >= val - 1 && topDiamonds >= val - 1;
  } else {
    // Opposite color is Black (Spades & Clubs)
    return topSpades >= val - 1 && topClubs >= val - 1;
  }
}

export interface SafeFoundationMove {
  card: SolitaireCard;
  from: 'tableau' | 'waste';
  fromCol?: number;
  cardIndex?: number;
  targetFoundation: number;
}

/**
 * Searches the board for any card that can safely be vacuumed to foundations
 */
export function findSafeFoundationMove(state: KlondikeState): SafeFoundationMove | null {
  // 1. Check top card of each tableau column
  for (let cIdx = 0; cIdx < state.tableau.length; cIdx++) {
    const col = state.tableau[cIdx];
    if (col.length === 0) continue;
    const top = col[col.length - 1];

    if (top.faceUp) {
      const fIdx = getFoundationIndexForSuit(top.suit);
      if (
        canDropOnFoundation(top, state.foundations[fIdx]) &&
        isCardSafeForFoundation(top, state.foundations)
      ) {
        return {
          card: top,
          from: 'tableau',
          fromCol: cIdx,
          cardIndex: col.length - 1,
          targetFoundation: fIdx,
        };
      }
    }
  }

  // 2. Check top of waste
  if (state.waste.length > 0) {
    const top = state.waste[state.waste.length - 1];
    if (top.faceUp) {
      const fIdx = getFoundationIndexForSuit(top.suit);
      if (
        canDropOnFoundation(top, state.foundations[fIdx]) &&
        isCardSafeForFoundation(top, state.foundations)
      ) {
        return {
          card: top,
          from: 'waste',
          targetFoundation: fIdx,
        };
      }
    }
  }

  return null;
}

export interface SmartDestinationResult {
  type: 'foundation' | 'tableau';
  targetCol: number;
  from: 'tableau' | 'waste';
  fromCol?: number;
  cardIndex?: number;
}

/**
 * Evaluates all candidate destinations for a tapped card and returns the most strategic choice
 */
export function findSmartDestination(
  card: SolitaireCard,
  state: KlondikeState
): SmartDestinationResult | null {
  if (!card.faceUp) return null;

  // 1. Foundations take highest priority
  const fIdx = getFoundationIndexForSuit(card.suit);
  if (canDropOnFoundation(card, state.foundations[fIdx])) {
    // Check if card is from waste
    if (state.waste.length > 0 && state.waste[state.waste.length - 1].instanceId === card.instanceId) {
      return { type: 'foundation', targetCol: fIdx, from: 'waste' };
    }
    // Check if card is from tableau (must be top card to go to foundation)
    for (let tCol = 0; tCol < 7; tCol++) {
      const col = state.tableau[tCol];
      if (col.length > 0 && col[col.length - 1].instanceId === card.instanceId) {
        return { type: 'foundation', targetCol: fIdx, from: 'tableau', fromCol: tCol, cardIndex: col.length - 1 };
      }
    }
  }

  // 2. Check Tableau destination columns
  const isFromWaste =
    state.waste.length > 0 && state.waste[state.waste.length - 1].instanceId === card.instanceId;

  let sourceColIdx: number | undefined;
  let cardIdxInSource: number | undefined;
  let sourceHasFaceDown = false;

  if (!isFromWaste) {
    for (let sCol = 0; sCol < 7; sCol++) {
      const col = state.tableau[sCol];
      const foundIdx = col.findIndex((c) => c.instanceId === card.instanceId);
      if (foundIdx !== -1) {
        sourceColIdx = sCol;
        cardIdxInSource = foundIdx;
        sourceHasFaceDown = col.slice(0, foundIdx).some((c) => !c.faceUp);
        break;
      }
    }
    if (sourceColIdx === undefined || cardIdxInSource === undefined) {
      return null;
    }
  }

  // Find all legal destination columns and rank them
  interface Candidate {
    colIndex: number;
    score: number;
  }
  const candidates: Candidate[] = [];

  for (let destColIdx = 0; destColIdx < 7; destColIdx++) {
    if (destColIdx === sourceColIdx) continue;
    const destCol = state.tableau[destColIdx];

    if (canDropOnTableau(card, destCol)) {
      let score = 0;

      if (destCol.length === 0) {
        // King to empty column
        if (sourceHasFaceDown) {
          // Excellent move: frees up face-down cards!
          score += 200;
        } else if (isFromWaste) {
          score += 100;
        } else {
          // Pointless King shuffle between empty columns
          score -= 50;
        }
      } else {
        // Move onto an existing column
        const faceDownInDest = destCol.filter((c) => !c.faceUp).length;
        // Prioritize columns with more cards and face-down cards
        score += faceDownInDest * 25;
        score += destCol.length * 10;
      }

      candidates.push({ colIndex: destColIdx, score });
    }
  }

  if (candidates.length === 0) return null;

  // Sort descending by score
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  if (isFromWaste) {
    return { type: 'tableau', targetCol: best.colIndex, from: 'waste' };
  } else {
    return {
      type: 'tableau',
      targetCol: best.colIndex,
      from: 'tableau',
      fromCol: sourceColIdx,
      cardIndex: cardIdxInSource,
    };
  }
}
