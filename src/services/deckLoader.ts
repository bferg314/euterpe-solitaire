import JSZip from 'jszip';
import type { OpenPlayingCardsDeck } from '../types/openPlayingCards';
import type { SolitaireCard } from '../types/solitaire';
import { getSelectedDeckChoice, loadCustomDeckFromStorage } from './deckStorageService';

export interface LoadedDeck {
  deck: OpenPlayingCardsDeck;
  isCustom: boolean;
  backSvgUrl?: string;
  backPngUrl?: string;
  cardUrls: Map<string, { svg?: string; png?: string }>;
}

let activeDeckCache: LoadedDeck | null = null;
const blobUrlsToRevoke: string[] = [];

/**
 * Clean up previously created Object URLs to prevent memory leaks
 */
export function revokeCustomDeckUrls(): void {
  for (const url of blobUrlsToRevoke) {
    URL.revokeObjectURL(url);
  }
  blobUrlsToRevoke.length = 0;
}

/**
 * Loads the default bundled starter deck ("Classic Deck Large")
 */
export async function loadStarterDeck(): Promise<LoadedDeck> {
  const basePath = '/decks/classic-deck-large';
  const response = await fetch(`${basePath}/deck.json`);
  if (!response.ok) {
    throw new Error(`Failed to load starter deck: ${response.statusText}`);
  }
  const deckData: OpenPlayingCardsDeck = await response.json();

  const cardUrls = new Map<string, { svg?: string; png?: string }>();
  for (const card of deckData.cards) {
    cardUrls.set(card.id, {
      svg: card.vector ? `${basePath}/${card.vector}` : undefined,
      png: card.image ? `${basePath}/${card.image}` : undefined,
    });
  }

  const loaded: LoadedDeck = {
    deck: deckData,
    isCustom: false,
    backSvgUrl: deckData.back.vector ? `${basePath}/${deckData.back.vector}` : undefined,
    backPngUrl: deckData.back.image ? `${basePath}/${deckData.back.image}` : undefined,
    cardUrls,
  };

  activeDeckCache = loaded;
  return loaded;
}

/**
 * Loads the active deck based on user preference (stored custom deck if available, else starter deck)
 */
export async function loadInitialDeck(): Promise<LoadedDeck> {
  const choice = getSelectedDeckChoice();
  if (choice === 'custom') {
    const stored = await loadCustomDeckFromStorage();
    if (stored && stored.blob) {
      try {
        const loaded = await loadDeckFromFile(stored.blob, stored.name);
        return loaded;
      } catch (err) {
        console.warn('Failed to restore custom deck, falling back to starter deck:', err);
      }
    }
  }
  return loadStarterDeck();
}

/**
 * Ingests a custom `.cards.zip` or `.cards.json` uploaded by the user or restored from storage
 */
export async function loadDeckFromFile(file: File | Blob, fileName = ''): Promise<LoadedDeck> {
  revokeCustomDeckUrls();

  const name = 'name' in file ? (file as File).name : fileName;
  const isJson = name.endsWith('.json') || file.type === 'application/json';

  if (isJson) {
    const text = await file.text();
    const deckData: OpenPlayingCardsDeck = JSON.parse(text);
    return processDeckJson(deckData);
  }

  // Handle .zip archive (.cards.zip or .zip)
  const zip = await JSZip.loadAsync(file);
  const deckJsonFile = zip.file('deck.json');
  if (!deckJsonFile) {
    throw new Error('Invalid Open Playing Cards archive: missing deck.json');
  }

  const deckJsonText = await deckJsonFile.async('text');
  const deckData: OpenPlayingCardsDeck = JSON.parse(deckJsonText);

  // Validate format
  if (deckData.format !== 'open-playing-cards') {
    throw new Error(`Unsupported format "${deckData.format}". Expected "open-playing-cards".`);
  }

  const cardUrls = new Map<string, { svg?: string; png?: string }>();

  // Extract card images / SVGs safely
  for (const card of deckData.cards) {
    let svgUrl: string | undefined;
    let pngUrl: string | undefined;

    if (card.vector) {
      const sanitized = sanitizeZipPath(card.vector);
      const zipEntry = zip.file(sanitized);
      if (zipEntry) {
        const blob = await zipEntry.async('blob');
        const url = URL.createObjectURL(blob.slice(0, blob.size, 'image/svg+xml'));
        blobUrlsToRevoke.push(url);
        svgUrl = url;
      }
    }

    if (card.image) {
      const sanitized = sanitizeZipPath(card.image);
      const zipEntry = zip.file(sanitized);
      if (zipEntry) {
        const blob = await zipEntry.async('blob');
        const url = URL.createObjectURL(blob.slice(0, blob.size, 'image/png'));
        blobUrlsToRevoke.push(url);
        pngUrl = url;
      }
    }

    cardUrls.set(card.id, { svg: svgUrl, png: pngUrl });
  }

  // Extract back artwork
  let backSvgUrl: string | undefined;
  let backPngUrl: string | undefined;

  if (deckData.back.vector) {
    const sanitized = sanitizeZipPath(deckData.back.vector);
    const zipEntry = zip.file(sanitized);
    if (zipEntry) {
      const blob = await zipEntry.async('blob');
      const url = URL.createObjectURL(blob.slice(0, blob.size, 'image/svg+xml'));
      blobUrlsToRevoke.push(url);
      backSvgUrl = url;
    }
  }

  if (deckData.back.image) {
    const sanitized = sanitizeZipPath(deckData.back.image);
    const zipEntry = zip.file(sanitized);
    if (zipEntry) {
      const blob = await zipEntry.async('blob');
      const url = URL.createObjectURL(blob.slice(0, blob.size, 'image/png'));
      blobUrlsToRevoke.push(url);
      backPngUrl = url;
    }
  }

  const loaded: LoadedDeck = {
    deck: deckData,
    isCustom: true,
    backSvgUrl,
    backPngUrl,
    cardUrls,
  };

  activeDeckCache = loaded;
  return loaded;
}

function processDeckJson(deckData: OpenPlayingCardsDeck): LoadedDeck {
  const cardUrls = new Map<string, { svg?: string; png?: string }>();
  for (const card of deckData.cards) {
    cardUrls.set(card.id, {
      svg: card.vector,
      png: card.image,
    });
  }

  const loaded: LoadedDeck = {
    deck: deckData,
    isCustom: true,
    backSvgUrl: deckData.back.vector,
    backPngUrl: deckData.back.image,
    cardUrls,
  };

  activeDeckCache = loaded;
  return loaded;
}

/**
 * Enforces Open Playing Cards spec path safety: no leading '/', no '..'
 */
function sanitizeZipPath(rawPath: string): string {
  const normalized = rawPath.replace(/\\/g, '/');
  if (normalized.startsWith('/') || normalized.includes('..')) {
    throw new Error(`Security violation: Invalid path "${rawPath}" inside deck zip.`);
  }
  return normalized;
}

export function getActiveDeck(): LoadedDeck | null {
  return activeDeckCache;
}

/**
 * Creates 52 SolitaireCard objects based on the active deck
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
