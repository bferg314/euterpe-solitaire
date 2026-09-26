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
}
