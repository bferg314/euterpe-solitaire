import type { KlondikeState, PyramidState } from './solitaire';

export type TimelineDecisionTag =
  | 'deal'
  | 'reveal'
  | 'foundation'
  | 'king'
  | 'draw'
  | 'recycle'
  | 'match'
  | 'move';

export interface TimelineStep<TState = KlondikeState | PyramidState> {
  stepIndex: number;
  state: TState;
  description: string;
  tag: TimelineDecisionTag;
  faceDownCount?: number;
  insight?: string;
  timestamp: number;
}

export interface DeadlockStatus {
  isDeadlocked: boolean;
  reason?: string;
}
