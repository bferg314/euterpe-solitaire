import type { KlondikeMoveSource, KlondikeMoveTarget } from '../klondikeEngine';

/** Where a Pyramid card is taken from: a pyramid position or the top of the waste. */
export type PyramidCardRef = { from: 'pyramid'; row: number; col: number } | { from: 'waste' };

/**
 * One Pyramid move, counted exactly as the game counts moves (selecting a card is not a move).
 */
export type PyramidSolverMove =
  | { type: 'draw' }
  | { type: 'recycle' }
  | { type: 'king'; card: PyramidCardRef }
  | { type: 'pair'; a: PyramidCardRef; b: PyramidCardRef };

/**
 * One Klondike move, counted exactly as the game counts moves: a draw (1 or 3 cards), a
 * recycle, or cards moved from one pile to another.
 */
export type KlondikeSolverMove =
  | { type: 'draw' }
  | { type: 'recycle' }
  | { type: 'move'; source: KlondikeMoveSource; target: KlondikeMoveTarget };

export type SolveStatus =
  /** A winning line was found. */
  | 'solved'
  /** The whole state space was searched and no win exists. */
  | 'unsolvable'
  /** The search budget ran out before a win was found. */
  | 'budget';

export interface SolveResult<TMove> {
  status: SolveStatus;
  /** The winning line when solved, otherwise empty. */
  moves: TMove[];
  /** True when `moves` is proven shortest. */
  exact: boolean;
  /** States expanded, for tuning budgets. */
  nodes: number;
  /** When there's no win: a line to the furthest position reached, the bot's best attempt. */
  bestMoves?: TMove[];
}
