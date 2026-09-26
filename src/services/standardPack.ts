import type { SolitaireCard } from '../types/solitaire';
import type { LoadedDeck } from './deckLoader';

/**
 * Creates 52 SolitaireCard objects based on the active deck.
 * Kept apart from the deck loader so the solver worker can deal without bundling deck import code.
 */
export function createStandardPack(deck: LoadedDeck): SolitaireCard[] {
  const standardCards = deck.deck.cards.filter((c) => c.kind === 'standard' && c.suit && c.rank);

  return standardCards.map((c, index) => {
    const urls = deck.cardUrls.get(c.id);
    return {
      ...c,
      instanceId: `${c.id}-${index}-${Date.now()}`,
      faceUp: false,
      resolvedVector: urls?.svg,
      resolvedImage: urls?.png,
    };
  });
}
