import React from 'react';
import type { CSSProperties } from 'react';
import type { SolitaireCard } from '../types/solitaire';
import type { LoadedDeck } from '../services/deckLoader';

interface CardViewProps {
  card: SolitaireCard;
  deck: LoadedDeck | null;
  isSelected?: boolean;
  isHint?: boolean;
  isDragging?: boolean;
  style?: CSSProperties;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  draggable?: boolean;
}

export const CardView: React.FC<CardViewProps> = ({
  card,
  deck,
  isSelected,
  isHint,
  isDragging,
  style,
  className = '',
  onClick,
  onDoubleClick,
  onDragStart,
  draggable = false,
}) => {
  // Use active deck artwork first for immediate re-skinning, with card instance fallback
  const cardUrls = deck?.cardUrls.get(card.id);
  const faceSvg = cardUrls?.svg || card.resolvedVector;
  const facePng = cardUrls?.png || card.resolvedImage;
  const backSvg = deck?.backSvgUrl;
  const backPng = deck?.backPngUrl;

  const cardClasses = [
    'solitaire-card',
    card.faceUp ? 'face-up' : 'face-down',
    isSelected ? 'selected' : '',
    isHint ? 'hint-pulse' : '',
    isDragging ? 'dragging' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={cardClasses}
      style={style}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onDragStart={onDragStart}
      draggable={draggable && card.faceUp}
      data-card-id={card.id}
      data-card-suit={card.suit}
      data-card-rank={card.rank}
      data-card-value={card.value}
    >
      <div className="card-inner">
        {card.faceUp ? (
          <div className="card-face">
            {faceSvg ? (
              <img
                src={faceSvg}
                alt={card.name || card.label}
                className="card-media"
                draggable={false}
              />
            ) : facePng ? (
              <img
                src={facePng}
                alt={card.name || card.label}
                className="card-media"
                draggable={false}
              />
            ) : (
              <div className="card-fallback" style={{ color: card.color || '#15151a' }}>
                <span className="fallback-rank">{card.rank}</span>
                <span className="fallback-symbol">{card.suit === 'hearts' ? '♥' : card.suit === 'diamonds' ? '♦' : card.suit === 'clubs' ? '♣' : '♠'}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="card-back">
            {backSvg ? (
              <img src={backSvg} alt="Card Back" className="card-media" draggable={false} />
            ) : backPng ? (
              <img src={backPng} alt="Card Back" className="card-media" draggable={false} />
            ) : (
              <div className="card-back-pattern" />
            )}
          </div>
        )}
      </div>
      <div className="card-specular" />
    </div>
  );
};
