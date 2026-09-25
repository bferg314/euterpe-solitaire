import { describe, expect, it } from 'vitest';
import type { KlondikeState, SolitaireCard } from '../types/solitaire';
import type { RankId, SuitId } from '../types/openPlayingCards';
import { applyKlondikeMove, getMovingCards } from './klondikeEngine';

const VALUES: Record<RankId, number> = {
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13,
};

let seq = 0;
function card(rank: RankId, suit: SuitId, faceUp = true): SolitaireCard {
  return {
    id: `${suit}-${rank}`,
    instanceId: `${suit}-${rank}-${seq++}`,
    kind: 'standard',
    suit,
    rank,
    value: VALUES[rank],
    label: `${rank}${suit[0]}`,
    name: `${rank} of ${suit}`,
    color: suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black',
    order: 0,
    faceUp,
  };
}

function board(partial: Partial<KlondikeState>): KlondikeState {
  return {
    tableau: [[], [], [], [], [], [], []],
    foundations: [[], [], [], []],
    stock: [],
    waste: [],
    drawCount: 1,
    ...partial,
  };
}

describe('getMovingCards', () => {
  it('returns the face-up run from the index down', () => {
    const state = board({
      tableau: [[card('9', 'clubs', false), card('8', 'hearts'), card('7', 'spades')], [], [], [], [], [], []],
    });
    expect(getMovingCards(state, { pile: 'tableau', col: 0, index: 1 }).map((c) => c.rank)).toEqual(['8', '7']);
  });

  it('refuses runs that include a face-down card', () => {
    const state = board({
      tableau: [[card('9', 'clubs', false), card('8', 'hearts')], [], [], [], [], [], []],
    });
    expect(getMovingCards(state, { pile: 'tableau', col: 0, index: 0 })).toEqual([]);
  });

  it('returns only the top waste card', () => {
    const state = board({ waste: [card('2', 'clubs'), card('5', 'hearts')] });
    expect(getMovingCards(state, { pile: 'waste' }).map((c) => c.rank)).toEqual(['5']);
  });

  it('returns nothing for an empty pile or out-of-range index', () => {
    const state = board({});
    expect(getMovingCards(state, { pile: 'waste' })).toEqual([]);
    expect(getMovingCards(state, { pile: 'foundation', index: 2 })).toEqual([]);
    expect(getMovingCards(state, { pile: 'tableau', col: 3, index: 0 })).toEqual([]);
  });
});

describe('applyKlondikeMove', () => {
  it('moves a run onto an alternating, one-lower column and flips the exposed card', () => {
    const state = board({
      tableau: [
        [card('4', 'clubs', false), card('8', 'hearts'), card('7', 'spades')],
        [card('9', 'spades')],
        [], [], [], [], [],
      ],
    });
    const result = applyKlondikeMove(state, { pile: 'tableau', col: 0, index: 1 }, { pile: 'tableau', col: 1 });
    expect(result).not.toBeNull();
    expect(result!.cards.map((c) => c.rank)).toEqual(['8', '7']);
    expect(result!.next.tableau[1].map((c) => c.rank)).toEqual(['9', '8', '7']);
    expect(result!.next.tableau[0]).toHaveLength(1);
    expect(result!.next.tableau[0][0].faceUp).toBe(true);
  });

  it('does not mutate the input state', () => {
    const state = board({ tableau: [[card('4', 'clubs', false), card('K', 'hearts')], [], [], [], [], [], []] });
    applyKlondikeMove(state, { pile: 'tableau', col: 0, index: 1 }, { pile: 'tableau', col: 1 });
    expect(state.tableau[0]).toHaveLength(2);
    expect(state.tableau[0][0].faceUp).toBe(false);
  });

  it('rejects same-colour and wrong-rank tableau drops', () => {
    const state = board({
      tableau: [[card('8', 'clubs')], [card('9', 'spades')], [card('10', 'hearts')], [], [], [], []],
    });
    expect(applyKlondikeMove(state, { pile: 'tableau', col: 0, index: 0 }, { pile: 'tableau', col: 1 })).toBeNull();
    expect(applyKlondikeMove(state, { pile: 'tableau', col: 0, index: 0 }, { pile: 'tableau', col: 2 })).toBeNull();
  });

  it('only allows a King into an empty column', () => {
    const state = board({ waste: [card('Q', 'hearts')], tableau: [[card('K', 'spades')], [], [], [], [], [], []] });
    expect(applyKlondikeMove(state, { pile: 'waste' }, { pile: 'tableau', col: 1 })).toBeNull();
    const king = applyKlondikeMove(state, { pile: 'tableau', col: 0, index: 0 }, { pile: 'tableau', col: 1 });
    expect(king!.next.tableau[1][0].rank).toBe('K');
  });

  it('treats dropping on the source column as no move', () => {
    const state = board({ tableau: [[card('K', 'spades')], [], [], [], [], [], []] });
    expect(applyKlondikeMove(state, { pile: 'tableau', col: 0, index: 0 }, { pile: 'tableau', col: 0 })).toBeNull();
  });

  it('builds foundations by suit from the Ace up, one card at a time', () => {
    const state = board({
      waste: [card('A', 'hearts')],
      tableau: [[card('3', 'spades'), card('2', 'hearts')], [], [], [], [], [], []],
    });
    const ace = applyKlondikeMove(state, { pile: 'waste' }, { pile: 'foundation', index: 1 });
    expect(ace!.next.foundations[1].map((c) => c.rank)).toEqual(['A']);
    expect(ace!.next.waste).toHaveLength(0);

    const two = applyKlondikeMove(ace!.next, { pile: 'tableau', col: 0, index: 1 }, { pile: 'foundation', index: 1 });
    expect(two!.next.foundations[1].map((c) => c.rank)).toEqual(['A', '2']);

    // A multi-card run can never go to a foundation
    expect(applyKlondikeMove(ace!.next, { pile: 'tableau', col: 0, index: 0 }, { pile: 'foundation', index: 1 })).toBeNull();
  });

  it('moves a foundation card back down to the tableau', () => {
    const state = board({
      foundations: [[], [card('A', 'hearts'), card('2', 'hearts')], [], []],
      tableau: [[card('3', 'spades')], [], [], [], [], [], []],
    });
    const result = applyKlondikeMove(state, { pile: 'foundation', index: 1 }, { pile: 'tableau', col: 0 });
    expect(result!.next.tableau[0].map((c) => c.rank)).toEqual(['3', '2']);
    expect(result!.next.foundations[1]).toHaveLength(1);
  });
});
