import type { KlondikeState, SolitaireCard } from '../../types/solitaire';
import type { KlondikeSolverMove } from '../solvers/types';
import { applyKlondikeSolverMove, getMovingCards } from '../klondikeEngine';
import { findKlondikeLine, solveKlondike, type KlondikeLineResult } from '../solvers/klondikeSolver';

/*
 * The Klondike Trainer: the bot's best line, what each move does, and slips to avoid.
 *
 * Unlike Pyramid, the Klondike solver can't prove its line shortest (see `findKlondikeLine`),
 * so there's no Ace-to-Bogey ladder of bots. Instead the trainer plays the bot's line, tags each
 * move with the rule of thumb it follows, and finds tempting alternatives along the way, each
 * costed against the bot's line: "after this, the bot's best finish takes 6 more moves".
 */

const RANK_NAMES = ['', 'Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'];
const isRed = (card: SolitaireCard) => card.suit === 'hearts' || card.suit === 'diamonds';
const label = (card: SolitaireCard) => card.label;

/** Top rank on each suit's foundation, by suit (piles can hold any suit, so look at the cards). */
function homeRanks(state: KlondikeState): Record<string, number> {
  const ranks: Record<string, number> = { spades: 0, hearts: 0, diamonds: 0, clubs: 0 };
  for (const pile of state.foundations) {
    const top = pile[pile.length - 1];
    if (top?.suit) ranks[top.suit] = top.value ?? 0;
  }
  return ranks;
}

/** The vacuum's rule: never needed on the tableau again. */
function isSafeHome(card: SolitaireCard, state: KlondikeState): boolean {
  const rank = card.value ?? 0;
  if (rank <= 2) return true;
  const home = homeRanks(state);
  const opposite = isRed(card) ? ['spades', 'clubs'] : ['hearts', 'diamonds'];
  return opposite.every((suit) => home[suit] >= rank - 1);
}

interface MoveParts {
  cards: SolitaireCard[];
  /** "onto 8♥", "to an empty column", "to the foundation". */
  where: string;
  fromWaste: boolean;
  fromFoundation: boolean;
  toFoundation: boolean;
}

function partsOf(state: KlondikeState, move: KlondikeSolverMove): MoveParts | null {
  if (move.type !== 'move') return null;
  const cards = getMovingCards(state, move.source);
  const toFoundation = move.target.pile === 'foundation';
  let where = 'to the foundation';
  if (move.target.pile === 'tableau') {
    const column = state.tableau[move.target.col];
    const top = column[column.length - 1];
    where = top ? `onto ${label(top)}` : 'to an empty column';
  }
  return { cards, where, fromWaste: move.source.pile === 'waste', fromFoundation: move.source.pile === 'foundation', toFoundation };
}

const runName = (cards: SolitaireCard[]) =>
  cards.length > 1 ? `${label(cards[0])} and the ${cards.length - 1} card${cards.length > 2 ? 's' : ''} on it` : label(cards[0]);

const drawCountFor = (state: KlondikeState) => Math.min(state.drawCount, state.stock.length);
const cardsWord = (n: number) => (n === 1 ? 'a card' : `${n} cards`);

/** "Drew 3 cards", "Moved 7♠ onto 8♥": what a move did. */
export function klondikePastTense(state: KlondikeState, move: KlondikeSolverMove): string {
  if (move.type === 'draw') return `Drew ${cardsWord(drawCountFor(state))}`;
  if (move.type === 'recycle') return 'Recycled the waste';
  const parts = partsOf(state, move)!;
  if (parts.fromFoundation) return `Brought ${runName(parts.cards)} down from the foundation ${parts.where}`;
  return `${parts.toFoundation ? 'Played' : 'Moved'} ${runName(parts.cards)} ${parts.where}`;
}

/** "Draw 3 cards", "Move 7♠ onto 8♥": a move about to be played. */
export function klondikeImperative(state: KlondikeState, move: KlondikeSolverMove): string {
  if (move.type === 'draw') return `Draw ${cardsWord(drawCountFor(state))}`;
  if (move.type === 'recycle') return 'Recycle the waste';
  const parts = partsOf(state, move)!;
  if (parts.fromFoundation) return `Bring ${runName(parts.cards)} down from the foundation ${parts.where}`;
  return `${parts.toFoundation ? 'Play' : 'Move'} ${runName(parts.cards)} ${parts.where}`;
}

function gerund(state: KlondikeState, move: KlondikeSolverMove): string {
  if (move.type === 'draw') return `drawing ${cardsWord(drawCountFor(state))}`;
  if (move.type === 'recycle') return 'recycling the waste';
  const parts = partsOf(state, move)!;
  if (parts.fromFoundation) return `bringing ${runName(parts.cards)} down ${parts.where}`;
  return `${parts.toFoundation ? 'playing' : 'moving'} ${runName(parts.cards)} ${parts.where}`;
}

/** The cards a move is about to play, to light up on the board. */
export function klondikeMoveCardIds(state: KlondikeState, move: KlondikeSolverMove | undefined): string[] {
  if (!move) return [];
  if (move.type === 'draw') return state.stock.slice(-state.drawCount).map((c) => c.id);
  if (move.type === 'recycle') return [];
  return getMovingCards(state, move.source).map((c) => c.id);
}

/** Does this move turn a face-down card over? */
function turnsCardOver(state: KlondikeState, move: KlondikeSolverMove): boolean {
  if (move.type !== 'move' || move.source.pile !== 'tableau') return false;
  const below = state.tableau[move.source.col][move.source.index - 1];
  return Boolean(below && !below.faceUp);
}

const hiddenCount = (column: SolitaireCard[]) => column.filter((c) => !c.faceUp).length;

/**
 * The Klondike rule of thumb a move follows, in plain words, or null for a move that's just
 * part of the plan. It says what the move does, never why the solver chose it.
 * `following` is the rest of the line after this move.
 */
export function klondikePrinciple(state: KlondikeState, move: KlondikeSolverMove, following: KlondikeSolverMove[]): string | null {
  if (move.type === 'draw') {
    // Name the waste card these draws are for, if the line plays one before drawing on.
    let s = applyKlondikeSolverMove(state, move);
    for (const next of following) {
      if (!s || next.type !== 'draw') {
        if (s && next.type === 'move' && next.source.pile === 'waste') {
          const card = s.waste[s.waste.length - 1];
          return `Drawing toward the ${label(card)}, which plays next.`;
        }
        return null;
      }
      s = applyKlondikeSolverMove(s, next);
    }
    return null;
  }
  if (move.type === 'recycle') {
    return state.drawCount === 3
      ? 'Another pass through the stock. Cards played from the waste shift the groups of three, so new cards come up.'
      : 'Another pass through the stock. Each pass costs a draw per card, so give each one a purpose.';
  }

  const parts = partsOf(state, move)!;
  const card = parts.cards[0];
  const rank = card.value ?? 0;

  if (parts.toFoundation) {
    if (rank <= 2) return `${RANK_NAMES[rank]}s go home at once: they're never needed on the tableau.`;
    if (isSafeHome(card, state)) {
      return `Safe to send home: both ${isRed(card) ? 'black' : 'red'} ${RANK_NAMES[rank - 1]}s are already there, so nothing can use the ${label(card)}.`;
    }
    if (turnsCardOver(state, move)) return `Sends the ${label(card)} home to turn over the card beneath it.`;
    return null;
  }

  if (parts.fromFoundation) {
    const after = applyKlondikeSolverMove(state, move);
    const next = following[0];
    if (after && next?.type === 'move' && next.target.pile === 'tableau' && move.target.pile === 'tableau' && next.target.col === move.target.col) {
      const held = getMovingCards(after, next.source)[0];
      if (held) return `Brings the ${label(card)} back down to hold the ${label(held)}: sometimes a card has to leave the foundation.`;
    }
    return 'Brings a card back down from the foundation to build on.';
  }

  if (turnsCardOver(state, move) && move.type === 'move' && move.source.pile === 'tableau') {
    const hidden = hiddenCount(state.tableau[move.source.col]);
    const most = state.tableau.every((column) => hiddenCount(column) <= hidden);
    return most
      ? 'Turns over a face-down card from the column hiding the most. Uncovering cards is what wins Klondike.'
      : 'Turns over a face-down card. Uncovering cards is what wins Klondike.';
  }
  if (move.type === 'move' && move.source.pile === 'tableau' && move.source.index === 0) {
    if (rank === 13) return null; // a King moving between empty columns
    return 'Empties a column, making room for a King.';
  }
  if (rank === 13 && parts.where === 'to an empty column') return 'A King takes the empty column.';
  if (parts.fromWaste) {
    return state.drawCount === 3
      ? `Plays the ${label(card)} from the waste. In Turn 3 that also changes which cards the next pass brings up.`
      : `Plays the ${label(card)} from the waste, so the card under it is ready.`;
  }
  if (move.type === 'move' && move.source.pile === 'tableau') {
    const freed = state.tableau[move.source.col][move.source.index - 1];
    if (freed) return `Moves the run to free the ${label(freed)}.`;
  }
  return null;
}

export interface KlondikeSlip {
  /** Position in the bot's line where the slip is tempting (before move `at`). */
  at: number;
  /** The tempting move, played instead of the line's move at `at`. */
  move: KlondikeSolverMove;
  /** Extra moves the bot's best finish takes after it, compared to its own line. */
  cost: number;
  /** The rest of the game after the slip, as the bot would play it. */
  finish: KlondikeSolverMove[];
  /** "Drew instead of turning over a card. After that, …", for once the slip has been played. */
  lesson: string;
  /** The rule of thumb the slip breaks, or '' when it's just a worse plan. */
  rule: string;
}

const pileKey = (piles: SolitaireCard[][]) => piles.map((p) => p.map((c) => `${c.id}${c.faceUp ? '' : '*'}`).join(',')).join('|');
const boardKey = (s: KlondikeState) =>
  [...s.tableau.map((c) => c.map((x) => `${x.id}${x.faceUp ? '' : '*'}`).join(',')).sort(), pileKey(s.foundations), pileKey([s.stock, s.waste])].join('/');

/** Moves a player might reach for: anything to a foundation, a draw, a waste play, or a card turned over. */
function temptingMoves(state: KlondikeState): KlondikeSolverMove[] {
  const moves: KlondikeSolverMove[] = [];
  if (state.stock.length > 0) moves.push({ type: 'draw' });
  const sources = [
    ...(state.waste.length > 0 ? [{ pile: 'waste' as const }] : []),
    ...state.tableau.flatMap((column, col) => {
      const first = column.findIndex((c) => c.faceUp);
      return first < 0 ? [] : [{ pile: 'tableau' as const, col, index: first }, { pile: 'tableau' as const, col, index: column.length - 1 }];
    }),
  ];
  for (const source of sources) {
    for (let index = 0; index < 4; index++) moves.push({ type: 'move', source, target: { pile: 'foundation', index } });
    for (let col = 0; col < 7; col++) moves.push({ type: 'move', source, target: { pile: 'tableau', col } });
  }
  return moves.filter((m) => {
    const next = applyKlondikeSolverMove(state, m);
    if (!next) return false;
    if (m.type !== 'move' || m.source.pile !== 'tableau' || m.target.pile !== 'tableau') return true;
    // Tableau shuffles only tempt when they turn a card over.
    return turnsCardOver(state, m);
  });
}

/** Why a slip is a slip, when it breaks a rule of thumb the line keeps. */
function ruleBroken(state: KlondikeState, slip: KlondikeSolverMove, line: KlondikeSolverMove): string {
  if (slip.type === 'draw' && turnsCardOver(state, line)) return 'Turn over face-down cards before reaching for the stock.';
  if (slip.type === 'move' && slip.target.pile === 'foundation') {
    const card = getMovingCards(state, slip.source)[0];
    if (card && !isSafeHome(card, state)) {
      return `The ${label(card)} wasn't safe to send home yet: a ${isRed(card) ? 'black' : 'red'} ${RANK_NAMES[(card.value ?? 1) - 1]} may still need it.`;
    }
  }
  return '';
}

export interface SlipSearchOptions {
  /** Most slips to find. */
  maxSlips?: number;
  /** Largest cost worth showing, in moves. */
  maxCost?: number;
  /** Node budget for each finish search, and for the whole scan. */
  nodesPerSolve?: number;
  totalNodes?: number;
}

/**
 * Tempting alternatives along the bot's line, each costed by the bot's best finish from after
 * it (a weighted search, so the cost is the bot's, not a proven minimum). Scans positions in
 * order at a stride so slips spread across the game; stops at `maxSlips` or the node budget.
 * Deterministic for a given line: fixed stride, move order and node budgets.
 */
export function findKlondikeSlips(
  start: KlondikeState,
  line: KlondikeSolverMove[],
  options: SlipSearchOptions = {},
  onSlip?: (slip: KlondikeSlip) => void
): KlondikeSlip[] {
  const maxSlips = options.maxSlips ?? 8;
  const maxCost = options.maxCost ?? 20;
  const nodesPerSolve = options.nodesPerSolve ?? 15_000;
  let nodesLeft = options.totalNodes ?? 1_200_000;

  const states: KlondikeState[] = [start];
  for (const move of line) states.push(applyKlondikeSolverMove(states[states.length - 1], move)!);

  const slips: KlondikeSlip[] = [];
  // Variety: each card is the slip at most once, and drawing at most twice.
  const used = new Map<string, number>();
  const slipKey = (state: KlondikeState, move: KlondikeSolverMove) =>
    move.type === 'move' ? getMovingCards(state, move.source)[0]?.id ?? '' : move.type;
  const allowed = (key: string) => (used.get(key) ?? 0) < (key === 'draw' ? 2 : 1);
  const stride = Math.max(1, Math.floor(line.length / (maxSlips * 2)));
  for (let at = 0; at < line.length && slips.length < maxSlips && nodesLeft > 0; at += stride) {
    const state = states[at];
    const lineNext = boardKey(states[at + 1]);
    const remaining = line.length - at;
    let found: KlondikeSlip | null = null;
    for (const move of temptingMoves(state)) {
      const next = applyKlondikeSolverMove(state, move)!;
      if (boardKey(next) === lineNext) continue; // the line's own move, or an equivalent one
      if (!allowed(slipKey(state, move))) continue;
      const result = solveKlondike(next, { weight: 2, maxNodes: nodesPerSolve, maxLength: remaining - 1 + maxCost });
      nodesLeft -= result.nodes;
      if (result.status === 'solved') {
        const cost = 1 + result.moves.length - remaining;
        // The costliest tempting move here teaches the most. Cheaper-or-equal finishes aren't slips.
        if (cost >= 2 && (!found || cost > found.cost)) {
          const rule = ruleBroken(state, move, line[at]);
          found = {
            at,
            move,
            cost,
            finish: result.moves,
            lesson: `${klondikePastTense(state, move)} instead of ${gerund(state, line[at])}. After that, the bot's best finish takes ${cost} more moves.${rule ? ` ${rule}` : ''}`,
            rule,
          };
        }
      }
      if (nodesLeft <= 0) break;
    }
    if (found) {
      const key = slipKey(state, found.move);
      used.set(key, (used.get(key) ?? 0) + 1);
      slips.push(found);
      onSlip?.(found);
    }
  }
  return slips;
}

/**
 * Everything the Klondike Trainer needs, streamed: the bot's line (or best attempt) first, then
 * slips as they're found. A line already known (from working out Par) skips the solve.
 */
export function runKlondikeTrainer(
  state: KlondikeState,
  knownLine: KlondikeSolverMove[] | null,
  onLine: (result: KlondikeLineResult) => void,
  onSlip: (slip: KlondikeSlip) => void
): void {
  const result: KlondikeLineResult = knownLine
    ? { status: 'solved', moves: knownLine, exact: false, nodes: 0, bestHome: 52, bestMoves: knownLine }
    : findKlondikeLine(state);
  onLine(result);
  if (result.status === 'solved') findKlondikeSlips(state, result.moves, {}, onSlip);
}
