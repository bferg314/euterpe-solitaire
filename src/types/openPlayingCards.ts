// Open Playing Cards format, version 1
// Based on specification: https://github.com/bferg314/card-atelier/blob/main/docs/open-playing-cards.md

export type SuitId = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type RankId = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface OpenPlayingCardSuit {
  id: string;
  name: string;
  symbol: string;
  color: string;
  order: number;
}

export interface OpenPlayingCardRank {
  id: string;
  label: string;
  value: number;
  indexHeightMm?: number;
}

export interface OpenPlayingCardItem {
  id: string;
  kind: 'standard' | 'joker';
  suit: SuitId | null;
  rank: RankId | null;
  value: number | null;
  label: string;
  name: string;
  color: string;
  order: number;
  image?: string; // Relative path or Data URI (PNG)
  vector?: string; // Relative path or Data URI (SVG)
}

export interface OpenPlayingCardDeckMeta {
  widthMm: number;
  heightMm: number;
  cornerRadiusMm: number;
  bleedMm?: number;
  imageWidth?: number;
  imageHeight?: number;
  dpi?: number;
}

export interface OpenPlayingCardsDeck {
  $schema?: string;
  format: 'open-playing-cards';
  version: 1;
  deckId: string;
  contentHash?: string;
  deckType?: string; // e.g. "french-52"
  name: string;
  author?: string;
  description?: string;
  license?: string;
  source?: string;
  generator?: {
    name: string;
    version: string;
  };
  createdAt?: string;
  card: OpenPlayingCardDeckMeta;
  suits: OpenPlayingCardSuit[];
  ranks: OpenPlayingCardRank[];
  back: {
    image?: string;
    vector?: string;
  };
  cards: OpenPlayingCardItem[];
}
