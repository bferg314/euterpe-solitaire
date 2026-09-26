import type { KlondikeState, GameMode, DifficultyLevel } from '../../types/solitaire';

/**
 * Heuristic Par estimate for Klondike (a real solver replaces this in a later phase)
 * Uses deep board entropy, hidden card depth analysis, and stock draw requirements
 */
export function estimateKlondikePar(
  state: KlondikeState,
  mode: GameMode,
  difficulty: DifficultyLevel
): number {
  // 1. Inherent absolute minimum foundation moves
  const totalFoundationMoves = 52;

  // 2. Count face-down cards and their depth penalties
  let faceDownCount = 0;
  let depthPenalty = 0;
  let buriedLowCardsPenalty = 0;

  state.tableau.forEach((col) => {
    let colFaceDown = 0;
    col.forEach((c) => {
      if (!c.faceUp) {
        colFaceDown++;
        faceDownCount++;
      } else if (colFaceDown > 0 && c.value !== null && c.value <= 4) {
        // Low cards (Aces, 2s, 3s, 4s) trapped on top of face-down cards that need to move away
        buriedLowCardsPenalty += 1;
      }
    });
    // Columns with 4+ face-down cards require multi-stage shifting to uncover
    if (colFaceDown >= 4) {
      depthPenalty += (colFaceDown - 3) * 2;
    }
  });

  // 3. Stock draw cost based on draw count (Turn 1 vs Turn 3)
  const stockCount = state.stock.length + state.waste.length;
  let stockDrawEstimate = 0;

  if (mode === 'klondike-3') {
    // In Turn 3, stock draws in batches of 3; reaching specific cards takes 1 to 3 passes
    const basePasses = difficulty === 'hard' ? 2.5 : 1.8;
    stockDrawEstimate = Math.round((stockCount / 3) * basePasses);
  } else {
    // In Turn 1, single draws allow immediate access, avg 0.65 draws per stock card needed
    const stockDrawRatio = difficulty === 'easy' ? 0.45 : difficulty === 'hard' ? 0.75 : 0.6;
    stockDrawEstimate = Math.round(stockCount * stockDrawRatio);
  }

  // 4. Tableau maneuver complexity (moving intermediate runs between columns)
  let tableauManeuverCost = 0;
  switch (difficulty) {
    case 'easy':
      tableauManeuverCost = 8;
      break;
    case 'medium':
      tableauManeuverCost = 14;
      break;
    case 'hard':
      tableauManeuverCost = 22;
      break;
    case 'daily':
      tableauManeuverCost = 16;
      break;
  }

  // Sum components
  const calculated =
    totalFoundationMoves +
    faceDownCount +
    depthPenalty +
    buriedLowCardsPenalty +
    stockDrawEstimate +
    tableauManeuverCost;

  // Realistic human-achievable optimal ranges:
  // Klondike 1: 76 - 110 moves
  // Klondike 3: 84 - 130 moves
  const minBound = mode === 'klondike-3' ? 82 : 74;
  const maxBound = mode === 'klondike-3' ? 135 : 118;

  return Math.max(minBound, Math.min(maxBound, calculated));
}
