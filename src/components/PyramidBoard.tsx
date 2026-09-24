import React from 'react';
import type { SolitaireCard, PyramidState } from '../types/solitaire';
import type { LoadedDeck } from '../services/deckLoader';
import { CardView } from './CardView';
import {
  isPyramidCardExposed,
  isKing,
  doCardsSumTo13,
  clonePyramidState,
  countPyramidCardsCleared,
} from '../engines/pyramidEngine';
import { sound } from '../services/audioService';
import { RefreshCw } from 'lucide-react';

interface PyramidBoardProps {
  state: PyramidState;
  deck: LoadedDeck | null;
  hintCardId: string | null;
  onStateChange: (newState: PyramidState, description: string) => void;
}

export const PyramidBoard: React.FC<PyramidBoardProps> = ({
  state,
  deck,
  hintCardId,
  onStateChange,
}) => {
  const { pyramid, stock, waste, selectedCard } = state;

  // Handle stock click (draw 1 card or recycle waste)
  const handleStockClick = () => {
    sound.playCardSlide();
    const next = clonePyramidState(state);
    next.selectedCard = null;

    if (next.stock.length === 0) {
      if (next.waste.length === 0) return;
      next.stock = next.waste.reverse().map((c) => ({ ...c, faceUp: false }));
      next.waste = [];
      onStateChange(next, 'Recycled waste pile to stock');
      return;
    }

    const drawn = next.stock.pop();
    if (drawn) {
      drawn.faceUp = true;
      next.waste.push(drawn);
    }
    onStateChange(next, 'Drew card from stock');
  };

  // Process pairing or King removal
  const handleCardInteraction = (
    card: SolitaireCard,
    source: 'pyramid' | 'waste',
    pos?: { row: number; col: number }
  ) => {
    // 1. King single-click removal (value = 13)
    if (isKing(card)) {
      sound.playCardSnap();
      const next = clonePyramidState(state);
      next.selectedCard = null;

      if (source === 'pyramid' && pos) {
        next.pyramid[pos.row][pos.col] = null;
      } else if (source === 'waste') {
        next.waste.pop();
      }

      next.clearedPairs += 1;
      onStateChange(next, `Cleared King (${card.label})`);
      return;
    }

    // 2. No card currently selected -> Select this one
    if (!selectedCard) {
      sound.playCardSlide();
      const next = clonePyramidState(state);
      next.selectedCard = { source, pos, card };
      onStateChange(next, `Selected ${card.label}`);
      return;
    }

    // 3. User clicked the same card -> Deselect
    if (
      selectedCard.card.instanceId === card.instanceId
    ) {
      sound.playCardSlide();
      const next = clonePyramidState(state);
      next.selectedCard = null;
      onStateChange(next, 'Deselected card');
      return;
    }

    // 4. Check if the two cards sum to 13
    if (doCardsSumTo13(selectedCard.card, card)) {
      sound.playCardSnap();
      const next = clonePyramidState(state);
      next.selectedCard = null;

      // Remove first selected card
      if (selectedCard.source === 'pyramid' && selectedCard.pos) {
        next.pyramid[selectedCard.pos.row][selectedCard.pos.col] = null;
      } else if (selectedCard.source === 'waste') {
        // Find by instanceId in waste
        const idx = next.waste.findIndex((c) => c.instanceId === selectedCard.card.instanceId);
        if (idx !== -1) next.waste.splice(idx, 1);
      }

      // Remove second clicked card
      if (source === 'pyramid' && pos) {
        next.pyramid[pos.row][pos.col] = null;
      } else if (source === 'waste') {
        const idx = next.waste.findIndex((c) => c.instanceId === card.instanceId);
        if (idx !== -1) next.waste.splice(idx, 1);
      }

      next.clearedPairs += 1;
      onStateChange(next, `Matched pair: ${selectedCard.card.label} + ${card.label} = 13`);
    } else {
      // Invalid pair
      sound.playErrorBump();
      const next = clonePyramidState(state);
      // Switch selection to this card
      next.selectedCard = { source, pos, card };
      onStateChange(next, `Selected ${card.label}`);
    }
  };

  const clearedCount = countPyramidCardsCleared(state);
  const topWaste = waste.length > 0 ? waste[waste.length - 1] : null;

  return (
    <div className="pyramid-board">
      {/* Pyramid Progress Header */}
      <div className="pyramid-progress-bar">
        <div className="pyramid-metric">
          <span className="metric-label">PYRAMID CLEARED:</span>
          <span className="metric-val">{clearedCount} / 28</span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${(clearedCount / 28) * 100}%` }}
          />
        </div>
      </div>

      {/* 7-Row Triangular Pyramid */}
      <div className="pyramid-grid">
        {pyramid.map((rowCards, rowIdx) => (
          <div key={rowIdx} className="pyramid-row" data-row={rowIdx}>
            {rowCards.map((card, colIdx) => {
              if (!card) {
                return (
                  <div
                    key={`empty-${rowIdx}-${colIdx}`}
                    className="card-slot pyramid-empty-slot"
                  />
                );
              }

              const isExposed = isPyramidCardExposed(pyramid, rowIdx, colIdx);
              const isSelected =
                selectedCard?.source === 'pyramid' &&
                selectedCard?.pos?.row === rowIdx &&
                selectedCard?.pos?.col === colIdx;
              const isHint = hintCardId === card.id;

              return (
                <div
                  key={card.instanceId}
                  className={`pyramid-card-wrapper ${isExposed ? 'exposed' : 'covered'}`}
                >
                  <CardView
                    card={card}
                    deck={deck}
                    isSelected={isSelected}
                    isHint={isHint}
                    className={isExposed ? 'interactive-card' : 'disabled-card'}
                    onClick={() => {
                      if (isExposed) {
                        handleCardInteraction(card, 'pyramid', { row: rowIdx, col: colIdx });
                      } else {
                        sound.playErrorBump();
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom Area: Stock & Waste */}
      <div className="pyramid-footer-row">
        <div className="stock-waste-zone pyramid-reserve">
          {/* Stock */}
          <div
            className={`card-slot stock-slot ${stock.length === 0 ? 'empty' : ''}`}
            onClick={handleStockClick}
            title={stock.length > 0 ? `Draw card (${stock.length} left)` : 'Recycle waste'}
          >
            {stock.length > 0 ? (
              <div className="stock-cards-stack">
                <CardView card={stock[stock.length - 1]} deck={deck} />
                <span className="pile-count-badge">{stock.length}</span>
              </div>
            ) : (
              <div className="empty-stock-symbol">
                <RefreshCw size={24} className="recycle-icon" />
              </div>
            )}
          </div>

          {/* Waste */}
          <div className="card-slot waste-slot">
            {topWaste ? (
              <div className="waste-cards-container">
                <CardView
                  card={topWaste}
                  deck={deck}
                  isSelected={selectedCard?.source === 'waste'}
                  isHint={hintCardId === topWaste.id}
                  onClick={() => handleCardInteraction(topWaste, 'waste')}
                />
                <span className="pile-count-badge waste-count">{waste.length}</span>
              </div>
            ) : (
              <span className="slot-watermark">WASTE</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
