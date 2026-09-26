import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LoadedDeck } from '../services/deckLoader';
import type { OpenPlayingCardsDeck } from '../types/openPlayingCards';

/** The bundled Classic deck, loaded from disk for engine and solver tests (no artwork URLs). */
export function loadTestDeck(): LoadedDeck {
  const path = resolve(__dirname, '../../public/decks/classic-deck-large/deck.json');
  const deck = JSON.parse(readFileSync(path, 'utf-8')) as OpenPlayingCardsDeck;
  return { deck, isCustom: false, cardUrls: new Map() };
}
