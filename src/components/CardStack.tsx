import React from 'react';
import type { SolitaireCard } from '../types/solitaire';
import type { LoadedDeck } from '../services/deckLoader';
import { CardView } from './CardView';

interface CardStackProps {
  cards: SolitaireCard[];
  deck: LoadedDeck | null;
  columnIndex: number;
  hintCardId?: string | null;
  /** Keyboard cursor: the card a pick-up starts from, -1 for an empty column, null when elsewhere. */
  cursorIndex?: number | null;
  /** The cursor marks a drop target (cards are held) rather than a pick-up. */
  cursorIsTarget?: boolean;
  /** Cards from this index down are held by the keyboard. */
  heldFromIndex?: number | null;
  onCardClick?: (card: SolitaireCard, colIdx: number, cardIdx: number) => void;
  onCardDoubleClick?: (card: SolitaireCard, colIdx: number, cardIdx: number) => void;
  onDragStart?: (card: SolitaireCard, colIdx: number, cardIdx: number, e: React.DragEvent) => void;
  onDrop?: (targetColIdx: number, e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
}

// Vertical offset of each card: tighter for face-down, wider for face-up
function cardOffsets(cards: SolitaireCard[]): number[] {
  const offsets: number[] = [];
  let top = 0;
  for (const card of cards) {
    offsets.push(top);
    top += card.faceUp ? 30 : 16;
  }
  return offsets;
}

export const CardStack: React.FC<CardStackProps> = ({
  cards,
  deck,
  columnIndex,
  hintCardId,
  cursorIndex = null,
  cursorIsTarget = false,
  heldFromIndex = null,
  onCardClick,
  onCardDoubleClick,
  onDragStart,
  onDrop,
  onDragOver,
}) => {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (onDragOver) onDragOver(e);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (onDrop) onDrop(columnIndex, e);
  };

  const offsets = cardOffsets(cards);
  // The ring wraps the run from the cursor card to the bottom of the column.
  const ringTop = cursorIndex !== null && cursorIndex >= 0 ? offsets[cursorIndex] : 0;
  const ringSpan = cards.length > 0 && cursorIndex !== null && cursorIndex >= 0 ? offsets[cards.length - 1] - ringTop : 0;

  return (
    <div
      id={`tableau-col-${columnIndex}`}
      className="card-stack-column"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      data-column-index={columnIndex}
    >
      <div className="card-slot empty-tableau-slot">
        <span className="slot-watermark">K</span>
      </div>

      {cards.map((card, idx) => {
        const isHint = hintCardId === card.id;
        const isHeld = heldFromIndex !== null && idx >= heldFromIndex;

        return (
          <div
            key={card.instanceId}
            id={`card-${card.instanceId}`}
            className={`stacked-card-wrapper ${isHeld ? 'kb-held' : ''}`}
            style={{
              top: `${offsets[idx]}px`,
              zIndex: idx + 1,
            }}
          >
            <CardView
              card={card}
              deck={deck}
              isHint={isHint}
              draggable={card.faceUp}
              onClick={() => onCardClick && onCardClick(card, columnIndex, idx)}
              onDoubleClick={() => onCardDoubleClick && onCardDoubleClick(card, columnIndex, idx)}
              onDragStart={(e) => onDragStart && onDragStart(card, columnIndex, idx, e)}
            />
          </div>
        );
      })}

      {cursorIndex !== null && (
        <div
          className={`kb-column-ring ${cursorIsTarget ? 'target' : ''}`}
          style={{ top: `${ringTop}px`, height: `calc(${ringSpan}px + var(--card-h))` }}
          aria-hidden="true"
        />
      )}
    </div>
  );
};
