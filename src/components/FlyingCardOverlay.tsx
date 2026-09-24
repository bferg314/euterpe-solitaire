import React, { useEffect, useState } from 'react';
import type { SolitaireCard } from '../types/solitaire';
import type { LoadedDeck } from '../services/deckLoader';
import { CardView } from './CardView';

export interface FlyingCardAnim {
  id: string;
  card: SolitaireCard;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  width: number;
  height: number;
  isVacuum?: boolean;
}

interface FlyingCardOverlayProps {
  animations: FlyingCardAnim[];
  deck: LoadedDeck | null;
  onAnimationEnd: (id: string) => void;
}

interface ActiveFlightItem extends FlyingCardAnim {
  hasStarted: boolean;
}

export const FlyingCardOverlay: React.FC<FlyingCardOverlayProps> = ({
  animations,
  deck,
  onAnimationEnd,
}) => {
  const [activeItems, setActiveItems] = useState<ActiveFlightItem[]>([]);

  useEffect(() => {
    if (animations.length === 0) {
      return;
    }

    let innerFrameId: number | undefined;
    const initialFrameId = requestAnimationFrame(() => {
      setActiveItems(animations.map((anim) => ({ ...anim, hasStarted: false })));

      innerFrameId = requestAnimationFrame(() => {
        setActiveItems((prev) =>
          prev.map((item) => ({
            ...item,
            hasStarted: true,
          }))
        );
      });
    });

    const timer = setTimeout(() => {
      animations.forEach((anim) => onAnimationEnd(anim.id));
      setActiveItems([]);
    }, 240);

    return () => {
      cancelAnimationFrame(initialFrameId);
      if (innerFrameId !== undefined) {
        cancelAnimationFrame(innerFrameId);
      }
      clearTimeout(timer);
    };
  }, [animations, onAnimationEnd]);

  if (activeItems.length === 0) return null;

  return (
    <div className="flying-card-overlay-root">
      {activeItems.map((item) => {
        const currentX = item.hasStarted ? item.targetX : item.startX;
        const currentY = item.hasStarted ? item.targetY : item.startY;
        const currentScale = item.hasStarted ? 1 : 1.05;
        const rotation = item.hasStarted ? 0 : 2;

        return (
          <div
            key={item.id}
            className={`flying-card-wrapper ${item.isVacuum ? 'vacuum-glow' : 'smart-tap-glow'}`}
            style={{
              width: `${item.width}px`,
              height: `${item.height}px`,
              transform: `translate3d(${currentX}px, ${currentY}px, 0) scale(${currentScale}) rotate(${rotation}deg)`,
              transition: item.hasStarted
                ? 'transform 230ms cubic-bezier(0.2, 0.9, 0.3, 1.1)'
                : 'none',
            }}
          >
            <div className="flying-card-inner">
              <CardView card={item.card} deck={deck} />
              {/* Golden vector trail aura */}
              <div className="golden-vector-trail" />
            </div>
          </div>
        );
      })}
    </div>
  );
};
