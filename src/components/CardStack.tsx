import React from 'react';
import type { SolitaireCard } from '../types/solitaire';
import type { LoadedDeck } from '../services/deckLoader';
import { CardView } from './CardView';

interface CardStackProps {
  cards: SolitaireCard[];
  deck: LoadedDeck | null;
  columnIndex: number;
  hintCardId?: string | null;
  onCardClick?: (card: SolitaireCard, colIdx: number, cardIdx: number) => void;
  onCardDoubleClick?: (card: SolitaireCard, colIdx: number, cardIdx: number) => void;
  onDragStart?: (card: SolitaireCard, colIdx: number, cardIdx: number, e: React.DragEvent) => void;
  onDrop?: (targetColIdx: number, e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
}

export const CardStack: React.FC<CardStackProps> = ({
  cards,
  deck,
  columnIndex,
  hintCardId,
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

  return (
    <div
      className="card-stack-column"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      data-column-index={columnIndex}
    >
      <div className="card-slot empty-tableau-slot">
        <span className="slot-watermark">K</span>
      </div>

      {cards.map((card, idx) => {
        // Calculate vertical offset: tighter for face-down, wider for face-up
        let topOffset = 0;
        for (let i = 0; i < idx; i++) {
          topOffset += cards[i].faceUp ? 30 : 16;
        }

        const isHint = hintCardId === card.id;

        return (
          <div
            key={card.instanceId}
            className="stacked-card-wrapper"
            style={{
              top: `${topOffset}px`,
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
    </div>
  );
};
