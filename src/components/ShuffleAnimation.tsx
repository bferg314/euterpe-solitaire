import React, { useEffect, useState } from 'react';
import type { LoadedDeck } from '../services/deckLoader';
import { sound } from '../services/audioService';

interface ShuffleAnimationProps {
  deck: LoadedDeck | null;
  onComplete: () => void;
}

export const ShuffleAnimation: React.FC<ShuffleAnimationProps> = ({ deck, onComplete }) => {
  const [phase, setPhase] = useState<'split' | 'riffle' | 'square' | 'deal'>('split');

  useEffect(() => {
    sound.playShuffle();

    const t1 = setTimeout(() => setPhase('riffle'), 300);
    const t2 = setTimeout(() => setPhase('square'), 900);
    const t3 = setTimeout(() => setPhase('deal'), 1250);
    const t4 = setTimeout(() => onComplete(), 1650);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onComplete]);

  const backSvg = deck?.backSvgUrl;
  const backPng = deck?.backPngUrl;

  return (
    <div className="shuffle-overlay" onClick={onComplete}>
      <div className="shuffle-stage">
        <div className={`shuffle-deck-half left ${phase}`}>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="shuffle-card"
              style={{
                transform: `translate3d(${i * -1.5}px, ${i * -0.5}px, ${i * 2}px)`,
              }}
            >
              {backSvg ? (
                <img src={backSvg} alt="Deck" className="card-media" draggable={false} />
              ) : backPng ? (
                <img src={backPng} alt="Deck" className="card-media" draggable={false} />
              ) : (
                <div className="card-back-pattern" />
              )}
            </div>
          ))}
        </div>

        <div className={`shuffle-deck-half right ${phase}`}>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="shuffle-card"
              style={{
                transform: `translate3d(${i * 1.5}px, ${i * -0.5}px, ${i * 2}px)`,
              }}
            >
              {backSvg ? (
                <img src={backSvg} alt="Deck" className="card-media" draggable={false} />
              ) : backPng ? (
                <img src={backPng} alt="Deck" className="card-media" draggable={false} />
              ) : (
                <div className="card-back-pattern" />
              )}
            </div>
          ))}
        </div>

        {phase === 'deal' && (
          <div className="dealing-burst">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="dealing-card"
                style={{
                  '--deal-angle': `${(i / 8) * 360}deg`,
                  '--deal-dist': '180px',
                } as React.CSSProperties}
              >
                {backSvg ? (
                  <img src={backSvg} alt="Deal" className="card-media" draggable={false} />
                ) : (
                  <div className="card-back-pattern" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="shuffle-footer">
        <span className="shuffle-text">Shuffling & Dealing...</span>
        <button
          className="shuffle-skip-btn"
          onClick={(e) => {
            e.stopPropagation();
            onComplete();
          }}
        >
          Skip
        </button>
      </div>
    </div>
  );
};
