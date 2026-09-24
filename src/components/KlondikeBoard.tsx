import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { SolitaireCard, KlondikeState } from '../types/solitaire';
import type { LoadedDeck } from '../services/deckLoader';
import { CardView } from './CardView';
import { CardStack } from './CardStack';
import {
  canDropOnFoundation,
  canDropOnTableau,
  cloneKlondikeState,
} from '../engines/klondikeEngine';
import {
  findSmartDestination,
  findSafeFoundationMove,
} from '../engines/safePlayEngine';
import { FlyingCardOverlay, type FlyingCardAnim } from './FlyingCardOverlay';
import { sound } from '../services/audioService';
import { RefreshCw } from 'lucide-react';

interface KlondikeBoardProps {
  state: KlondikeState;
  deck: LoadedDeck | null;
  hintCardId: string | null;
  ambientVacuumEnabled?: boolean;
  smartTapEnabled?: boolean;
  onStateChange: (newState: KlondikeState, description: string) => void;
}

interface DragPayload {
  source: 'tableau' | 'waste' | 'foundation';
  colIndex?: number;
  cardIndex?: number;
  cards: SolitaireCard[];
}

export const KlondikeBoard: React.FC<KlondikeBoardProps> = ({
  state,
  deck,
  hintCardId,
  ambientVacuumEnabled = true,
  smartTapEnabled = true,
  onStateChange,
}) => {
  const [activeDrag, setActiveDrag] = useState<DragPayload | null>(null);
  const [flyingAnims, setFlyingAnims] = useState<FlyingCardAnim[]>([]);
  const pendingMoveRef = useRef<{ nextState: KlondikeState; description: string } | null>(null);
  const isFlyingRef = useRef(false);
  const animSeqRef = useRef(0);

  // Stock click (draw cards or recycle waste)
  const handleStockClick = () => {
    if (isFlyingRef.current) return;
    sound.playCardSlide();
    const next = cloneKlondikeState(state);

    if (next.stock.length === 0) {
      if (next.waste.length === 0) return;
      // Recycle waste back to stock
      next.stock = next.waste.reverse().map((c) => ({ ...c, faceUp: false }));
      next.waste = [];
      onStateChange(next, 'Recycled waste to stock');
      return;
    }

    const count = Math.min(next.drawCount, next.stock.length);
    for (let i = 0; i < count; i++) {
      const card = next.stock.pop();
      if (card) {
        card.faceUp = true;
        next.waste.push(card);
      }
    }
    onStateChange(next, `Drew ${count} card(s) from stock`);
  };

  // Completion callback for flying card animations
  const handleFlightEnd = useCallback(() => {
    setFlyingAnims([]);
    isFlyingRef.current = false;
    sound.playCardSnap();
    if (pendingMoveRef.current) {
      const { nextState, description } = pendingMoveRef.current;
      pendingMoveRef.current = null;
      onStateChange(nextState, description);
    }
  }, [onStateChange]);

  // Ambient Safe-Play Foundation Vacuum (Ambient Sweep)
  useEffect(() => {
    if (!ambientVacuumEnabled || activeDrag !== null || isFlyingRef.current) return;

    const safeMove = findSafeFoundationMove(state);
    if (!safeMove) return;

    const timer = setTimeout(() => {
      if (isFlyingRef.current || activeDrag !== null) return;

      const srcEl = document.getElementById(`card-${safeMove.card.instanceId}`);
      const dstEl = document.getElementById(`foundation-slot-${safeMove.targetFoundation}`);

      const next = cloneKlondikeState(state);
      let movedCard: SolitaireCard | undefined;
      if (safeMove.from === 'waste') {
        movedCard = next.waste.pop();
      } else if (safeMove.fromCol !== undefined) {
        movedCard = next.tableau[safeMove.fromCol].pop();
        const col = next.tableau[safeMove.fromCol];
        if (col.length > 0 && !col[col.length - 1].faceUp) {
          col[col.length - 1].faceUp = true;
        }
      }

      if (!movedCard) return;
      next.foundations[safeMove.targetFoundation].push(movedCard);
      const desc = `Safe-Play Vacuum: ${movedCard.label} to Foundation`;

      if (srcEl && dstEl) {
        const srcRect = srcEl.getBoundingClientRect();
        const dstRect = dstEl.getBoundingClientRect();
        isFlyingRef.current = true;
        pendingMoveRef.current = { nextState: next, description: desc };
        sound.playCardSlide();
        setFlyingAnims([
          {
            id: `vacuum-${movedCard.instanceId}-${animSeqRef.current++}`,
            card: movedCard,
            startX: srcRect.left,
            startY: srcRect.top,
            targetX: dstRect.left,
            targetY: dstRect.top,
            width: srcRect.width,
            height: srcRect.height,
            isVacuum: true,
          },
        ]);
      } else {
        sound.playCardSnap();
        onStateChange(next, desc);
      }
    }, 140);

    return () => clearTimeout(timer);
  }, [state, ambientVacuumEnabled, activeDrag, onStateChange]);

  // Smart Destination Tap: intelligent move on single/double click with golden vector flight
  const handleCardClick = (card: SolitaireCard) => {
    if (!card.faceUp || isFlyingRef.current) return;

    const move = findSmartDestination(card, state);
    if (!move) {
      sound.playErrorBump();
      return;
    }

    const next = cloneKlondikeState(state);
    let movedCards: SolitaireCard[] = [];

    // Extract moving cards from source
    if (move.from === 'waste') {
      const c = next.waste.pop();
      if (c) movedCards = [c];
    } else if (move.from === 'tableau' && move.fromCol !== undefined && move.cardIndex !== undefined) {
      movedCards = next.tableau[move.fromCol].splice(move.cardIndex);
      const col = next.tableau[move.fromCol];
      if (col.length > 0 && !col[col.length - 1].faceUp) {
        col[col.length - 1].faceUp = true;
      }
    }

    if (movedCards.length === 0) return;

    // Place into target
    if (move.type === 'foundation') {
      next.foundations[move.targetCol].push(...movedCards);
    } else {
      next.tableau[move.targetCol].push(...movedCards);
    }

    const desc =
      move.type === 'foundation'
        ? `Moved ${movedCards[0].label} to Foundation`
        : `Moved ${movedCards[0].label} to Tableau`;

    // Attempt golden vector flight animation
    const srcEl = document.getElementById(`card-${card.instanceId}`);
    let dstRect: DOMRect | null = null;

    if (move.type === 'foundation') {
      const fEl = document.getElementById(`foundation-slot-${move.targetCol}`);
      if (fEl) dstRect = fEl.getBoundingClientRect();
    } else {
      const tColEl = document.getElementById(`tableau-col-${move.targetCol}`);
      if (tColEl) {
        const colRect = tColEl.getBoundingClientRect();
        const currentCount = state.tableau[move.targetCol].length;
        let topOffset = 0;
        for (let i = 0; i < currentCount; i++) {
          topOffset += state.tableau[move.targetCol][i].faceUp ? 30 : 16;
        }
        dstRect = new DOMRect(colRect.left, colRect.top + topOffset, colRect.width, colRect.height);
      }
    }

    if (smartTapEnabled && srcEl && dstRect) {
      const srcRect = srcEl.getBoundingClientRect();
      isFlyingRef.current = true;
      pendingMoveRef.current = { nextState: next, description: desc };
      sound.playCardSlide();
      setFlyingAnims([
        {
          id: `tap-${card.instanceId}-${animSeqRef.current++}`,
          card,
          startX: srcRect.left,
          startY: srcRect.top,
          targetX: dstRect.left,
          targetY: dstRect.top,
          width: srcRect.width,
          height: srcRect.height,
          isVacuum: false,
        },
      ]);
    } else {
      sound.playCardSnap();
      onStateChange(next, desc);
    }
  };

  // Drag start from Tableau
  const handleTableauDragStart = (
    _card: SolitaireCard,
    colIdx: number,
    cardIdx: number,
    e: React.DragEvent
  ) => {
    const movingCards = state.tableau[colIdx].slice(cardIdx);
    if (movingCards.length === 0 || !movingCards[0].faceUp) return;

    sound.playCardSlide();
    const payload: DragPayload = {
      source: 'tableau',
      colIndex: colIdx,
      cardIndex: cardIdx,
      cards: movingCards,
    };
    setActiveDrag(payload);
    e.dataTransfer.setData('application/json', JSON.stringify({ source: 'tableau', colIdx, cardIdx }));
  };

  // Drag start from Waste
  const handleWasteDragStart = (e: React.DragEvent) => {
    if (state.waste.length === 0) return;
    const topCard = state.waste[state.waste.length - 1];

    sound.playCardSlide();
    const payload: DragPayload = {
      source: 'waste',
      cards: [topCard],
    };
    setActiveDrag(payload);
    e.dataTransfer.setData('application/json', JSON.stringify({ source: 'waste' }));
  };

  // Drag start from Foundation
  const handleFoundationDragStart = (fIdx: number, e: React.DragEvent) => {
    const pile = state.foundations[fIdx];
    if (pile.length === 0) return;
    const topCard = pile[pile.length - 1];

    sound.playCardSlide();
    const payload: DragPayload = {
      source: 'foundation',
      colIndex: fIdx,
      cards: [topCard],
    };
    setActiveDrag(payload);
    e.dataTransfer.setData('application/json', JSON.stringify({ source: 'foundation', fIdx }));
  };

  // Drop on Tableau Column
  const handleTableauDrop = (targetColIdx: number, _e: React.DragEvent) => {
    if (!activeDrag || activeDrag.cards.length === 0) return;
    const movingRootCard = activeDrag.cards[0];
    const targetColumn = state.tableau[targetColIdx];

    // Check validity
    if (!canDropOnTableau(movingRootCard, targetColumn)) {
      sound.playErrorBump();
      setActiveDrag(null);
      return;
    }

    sound.playCardSnap();
    const next = cloneKlondikeState(state);

    // Remove cards from source
    if (activeDrag.source === 'tableau' && activeDrag.colIndex !== undefined && activeDrag.cardIndex !== undefined) {
      if (activeDrag.colIndex === targetColIdx) {
        setActiveDrag(null);
        return;
      }
      next.tableau[activeDrag.colIndex].splice(activeDrag.cardIndex);
      const srcCol = next.tableau[activeDrag.colIndex];
      if (srcCol.length > 0 && !srcCol[srcCol.length - 1].faceUp) {
        srcCol[srcCol.length - 1].faceUp = true;
      }
    } else if (activeDrag.source === 'waste') {
      next.waste.pop();
    } else if (activeDrag.source === 'foundation' && activeDrag.colIndex !== undefined) {
      next.foundations[activeDrag.colIndex].pop();
    }

    // Append to target tableau
    next.tableau[targetColIdx].push(...activeDrag.cards);
    setActiveDrag(null);
    onStateChange(next, `Moved cards to column ${targetColIdx + 1}`);
  };

  // Drop on Foundation Pile
  const handleFoundationDrop = (targetFIdx: number, e: React.DragEvent) => {
    e.preventDefault();
    if (!activeDrag || activeDrag.cards.length !== 1) {
      sound.playErrorBump();
      setActiveDrag(null);
      return;
    }

    const card = activeDrag.cards[0];
    const foundationPile = state.foundations[targetFIdx];

    if (!canDropOnFoundation(card, foundationPile)) {
      sound.playErrorBump();
      setActiveDrag(null);
      return;
    }

    sound.playCardSnap();
    const next = cloneKlondikeState(state);

    // Remove from source
    if (activeDrag.source === 'tableau' && activeDrag.colIndex !== undefined && activeDrag.cardIndex !== undefined) {
      next.tableau[activeDrag.colIndex].splice(activeDrag.cardIndex);
      const srcCol = next.tableau[activeDrag.colIndex];
      if (srcCol.length > 0 && !srcCol[srcCol.length - 1].faceUp) {
        srcCol[srcCol.length - 1].faceUp = true;
      }
    } else if (activeDrag.source === 'waste') {
      next.waste.pop();
    } else if (activeDrag.source === 'foundation' && activeDrag.colIndex !== undefined) {
      if (activeDrag.colIndex === targetFIdx) {
        setActiveDrag(null);
        return;
      }
      next.foundations[activeDrag.colIndex].pop();
    }

    next.foundations[targetFIdx].push(card);
    setActiveDrag(null);
    onStateChange(next, `Moved ${card.label} to Foundation`);
  };

  const foundationSuits = ['♠', '♥', '♦', '♣'];

  return (
    <div className="klondike-board">
      {/* Golden Vector Flight Animation Overlay */}
      <FlyingCardOverlay
        animations={flyingAnims}
        deck={deck}
        onAnimationEnd={handleFlightEnd}
      />

      {/* Top Deck Arena (Stock, Waste, Foundations) */}
      <div className="board-top-row">
        <div className="stock-waste-zone">
          {/* Stock Pile */}
          <div
            className={`card-slot stock-slot ${state.stock.length === 0 ? 'empty' : ''}`}
            onClick={handleStockClick}
            title={state.stock.length > 0 ? `Draw card (${state.stock.length} left)` : 'Recycle waste'}
          >
            {state.stock.length > 0 ? (
              <div className="stock-cards-stack">
                <CardView
                  card={state.stock[state.stock.length - 1]}
                  deck={deck}
                  className="stock-top-card"
                />
                <span className="pile-count-badge">{state.stock.length}</span>
              </div>
            ) : (
              <div className="empty-stock-symbol">
                <RefreshCw size={24} className="recycle-icon" />
              </div>
            )}
          </div>

          {/* Waste Pile */}
          <div className="card-slot waste-slot">
            {state.waste.length > 0 ? (
              <div className="waste-cards-container">
                {state.waste.slice(-3).map((card, idx, arr) => {
                  const isTop = idx === arr.length - 1;
                  return (
                    <div
                      key={card.instanceId}
                      id={`card-${card.instanceId}`}
                      className="waste-fanned-card"
                      style={{
                        transform: `translateX(${idx * 16}px)`,
                        zIndex: idx + 1,
                      }}
                    >
                      <CardView
                        card={card}
                        deck={deck}
                        isHint={isTop && hintCardId === card.id}
                        draggable={isTop}
                        onDragStart={isTop ? handleWasteDragStart : undefined}
                        onClick={isTop ? () => handleCardClick(card) : undefined}
                        onDoubleClick={isTop ? () => handleCardClick(card) : undefined}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <span className="slot-watermark">WASTE</span>
            )}
          </div>
        </div>

        {/* Foundations Zone */}
        <div className="foundations-zone">
          {state.foundations.map((pile, fIdx) => {
            const topCard = pile.length > 0 ? pile[pile.length - 1] : null;
            const isSuitRed = fIdx === 1 || fIdx === 2;

            return (
              <div
                key={fIdx}
                id={`foundation-slot-${fIdx}`}
                className="card-slot foundation-slot"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleFoundationDrop(fIdx, e)}
              >
                {topCard ? (
                  <CardView
                    card={topCard}
                    deck={deck}
                    draggable={true}
                    onDragStart={(e) => handleFoundationDragStart(fIdx, e)}
                  />
                ) : (
                  <span
                    className="slot-watermark foundation-symbol"
                    style={{ color: isSuitRed ? 'rgba(239, 68, 68, 0.35)' : 'rgba(255, 255, 255, 0.25)' }}
                  >
                    {foundationSuits[fIdx]}
                  </span>
                )}
                {pile.length > 0 && <span className="pile-count-badge foundation">{pile.length}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tableau Area */}
      <div className="tableau-zone">
        {state.tableau.map((colCards, colIdx) => (
          <CardStack
            key={colIdx}
            columnIndex={colIdx}
            cards={colCards}
            deck={deck}
            hintCardId={hintCardId}
            onCardClick={handleCardClick}
            onCardDoubleClick={handleCardClick}
            onDragStart={handleTableauDragStart}
            onDrop={handleTableauDrop}
          />
        ))}
      </div>
    </div>
  );
};
