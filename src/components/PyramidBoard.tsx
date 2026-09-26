import React, { useRef, useState } from 'react';
import type { SolitaireCard, PyramidState } from '../types/solitaire';
import type { LoadedDeck } from '../services/deckLoader';
import { CardView } from './CardView';
import {
  isPyramidCardExposed,
  isKing,
  doCardsSumTo13,
  clonePyramidState,
  countPyramidCardsCleared,
  applyPyramidMove,
  describePyramidMove,
} from '../engines/pyramidEngine';
import { sound } from '../services/audioService';
import { useBoardKeyboard } from '../hooks/useBoardKeyboard';
import type { PyramidCardRef, PyramidSolverMove } from '../engines/solvers/types';
import { RefreshCw } from 'lucide-react';

interface PyramidBoardProps {
  state: PyramidState;
  deck: LoadedDeck | null;
  hintCardId: string | null;
  keyboardEnabled?: boolean;
  onKeyboardActivate?: () => void;
  onStateChange: (newState: PyramidState, description: string) => void;
  /** Selection changes are not moves: no history, move count or score. */
  onSelectionChange: (newState: PyramidState) => void;
  /** False for a read-only replay (the Trainer): clicks and keys do nothing. */
  interactive?: boolean;
  /** Cards to light up, e.g. the ones a replayed move is about to play. */
  highlightCardIds?: string[];
}

type PyramidCursor = { zone: 'pyramid'; row: number; col: number } | { zone: 'stock' } | { zone: 'waste' };

// Horizontal position in card widths from the centre line: rows are centred, so each
// row starts half a card further left than the one above. Stock and waste sit centred below.
const pyramidX = (row: number, col: number) => col - row / 2;
const FOOTER_X = { stock: -0.6, waste: 0.6 };
const cardName = (card: SolitaireCard) => card.name || card.label;

/** The card in `row` nearest to horizontal position `x`, if the row has any left. */
function nearestInRow(pyramid: (SolitaireCard | null)[][], row: number, x: number): PyramidCursor | null {
  let best: PyramidCursor | null = null;
  let bestDist = Infinity;
  pyramid[row]?.forEach((card, col) => {
    const dist = Math.abs(pyramidX(row, col) - x);
    if (card && dist < bestDist) {
      best = { zone: 'pyramid', row, col };
      bestDist = dist;
    }
  });
  return best;
}

/** Nearest card scanning rows from `fromRow` in `step` direction. */
function nearestInDirection(
  pyramid: (SolitaireCard | null)[][],
  fromRow: number,
  step: 1 | -1,
  x: number
): PyramidCursor | null {
  for (let row = fromRow; row >= 0 && row < pyramid.length; row += step) {
    const found = nearestInRow(pyramid, row, x);
    if (found) return found;
  }
  return null;
}

/** Keeps the cursor on a card that still exists after pairs are cleared or undone. */
function normalizePyramidCursor(cursor: PyramidCursor, pyramid: (SolitaireCard | null)[][]): PyramidCursor {
  if (cursor.zone !== 'pyramid' || pyramid[cursor.row]?.[cursor.col]) return cursor;
  const x = pyramidX(cursor.row, cursor.col);
  return (
    nearestInRow(pyramid, cursor.row, x) ??
    nearestInDirection(pyramid, cursor.row + 1, 1, x) ??
    nearestInDirection(pyramid, cursor.row - 1, -1, x) ?? { zone: 'stock' }
  );
}

export const PyramidBoard: React.FC<PyramidBoardProps> = ({
  state,
  deck,
  hintCardId,
  keyboardEnabled = true,
  onKeyboardActivate,
  onStateChange,
  onSelectionChange,
  interactive = true,
  highlightCardIds = [],
}) => {
  const { pyramid, stock, waste, selectedCard } = state;
  const boardRef = useRef<HTMLDivElement>(null);
  const [rawCursor, setCursor] = useState<PyramidCursor>({ zone: 'pyramid', row: 6, col: 0 });
  const [announcement, setAnnouncement] = useState('');
  const cursor = normalizePyramidCursor(rawCursor, pyramid);

  // Handle stock click (draw 1 card or recycle waste)
  const handleStockClick = () => {
    if (!interactive) return;
    const move: PyramidSolverMove = stock.length > 0 ? { type: 'draw' } : { type: 'recycle' };
    const next = applyPyramidMove(state, move);
    if (!next) return;
    sound.playCardSlide();
    onStateChange(next, describePyramidMove(state, move));
  };

  // Process pairing or King removal
  const handleCardInteraction = (
    card: SolitaireCard,
    source: 'pyramid' | 'waste',
    pos?: { row: number; col: number }
  ) => {
    if (!interactive) return;
    const ref: PyramidCardRef = source === 'pyramid' && pos ? { from: 'pyramid', ...pos } : { from: 'waste' };

    // 1. King single-click removal (value = 13)
    if (isKing(card)) {
      const move: PyramidSolverMove = { type: 'king', card: ref };
      const next = applyPyramidMove(state, move);
      if (!next) return;
      sound.playCardSnap();
      onStateChange(next, describePyramidMove(state, move));
      return;
    }

    // 2. No card currently selected -> Select this one
    if (!selectedCard) {
      sound.playCardSlide();
      const next = clonePyramidState(state);
      next.selectedCard = { source, pos, card };
      onSelectionChange(next);
      return;
    }

    // 3. User clicked the same card -> Deselect
    if (
      selectedCard.card.instanceId === card.instanceId
    ) {
      sound.playCardSlide();
      const next = clonePyramidState(state);
      next.selectedCard = null;
      onSelectionChange(next);
      return;
    }

    // 4. Check if the two cards sum to 13
    const selectedRef: PyramidCardRef =
      selectedCard.source === 'pyramid' && selectedCard.pos ? { from: 'pyramid', ...selectedCard.pos } : { from: 'waste' };
    const move: PyramidSolverMove = { type: 'pair', a: selectedRef, b: ref };
    const next = doCardsSumTo13(selectedCard.card, card) ? applyPyramidMove(state, move) : null;
    if (next) {
      sound.playCardSnap();
      onStateChange(next, describePyramidMove(state, move));
    } else {
      // Invalid pair
      sound.playErrorBump();
      const switched = clonePyramidState(state);
      // Switch selection to this card
      switched.selectedCard = { source, pos, card };
      onSelectionChange(switched);
    }
  };

  const clearedCount = countPyramidCardsCleared(state);
  const topWaste = waste.length > 0 ? waste[waste.length - 1] : null;

  // ---------------------------------------------------------------------------
  // Keyboard mode
  // ---------------------------------------------------------------------------

  const describeCursor = (c: PyramidCursor): string => {
    if (c.zone === 'stock') return stock.length > 0 ? `Stock, ${stock.length} cards` : 'Stock empty, recycle waste';
    if (c.zone === 'waste') return topWaste ? `Waste: ${cardName(topWaste)}` : 'Waste, empty';
    const card = pyramid[c.row][c.col]!;
    const covered = !isPyramidCardExposed(pyramid, c.row, c.col);
    const selected = selectedCard?.card.instanceId === card.instanceId;
    return [cardName(card), `row ${c.row + 1}`, covered ? 'covered' : '', selected ? 'selected' : '']
      .filter(Boolean)
      .join(', ');
  };

  const moveCursorTo = (next: PyramidCursor | null) => {
    if (!next) return;
    setCursor(next);
    setAnnouncement(describeCursor(next));
  };

  /** Same as clicking the card, plus an announcement of what happened. */
  const interact = (card: SolitaireCard, source: 'pyramid' | 'waste', pos?: { row: number; col: number }) => {
    let outcome: string;
    if (isKing(card)) outcome = `Cleared ${cardName(card)}`;
    else if (!selectedCard) outcome = `Selected ${cardName(card)}`;
    else if (selectedCard.card.instanceId === card.instanceId) outcome = 'Deselected';
    else if (doCardsSumTo13(selectedCard.card, card)) outcome = `Matched ${cardName(selectedCard.card)} and ${cardName(card)}`;
    else outcome = `${cardName(selectedCard.card)} and ${cardName(card)} don't make 13. Selected ${cardName(card)}`;
    handleCardInteraction(card, source, pos);
    setAnnouncement(outcome);
  };

  const drawFromStock = () => {
    if (stock.length === 0 && waste.length === 0) {
      sound.playErrorBump();
      setAnnouncement('Stock and waste are empty');
      return;
    }
    const recycling = stock.length === 0;
    handleStockClick();
    setAnnouncement(recycling ? 'Recycled waste to stock' : 'Drew from stock');
  };

  const playAtCursor = () => {
    if (cursor.zone === 'stock') {
      drawFromStock();
    } else if (cursor.zone === 'waste') {
      if (topWaste) interact(topWaste, 'waste');
      else {
        sound.playErrorBump();
        setAnnouncement('Waste is empty');
      }
    } else {
      const card = pyramid[cursor.row][cursor.col];
      if (card && isPyramidCardExposed(pyramid, cursor.row, cursor.col)) {
        interact(card, 'pyramid', { row: cursor.row, col: cursor.col });
      } else {
        sound.playErrorBump();
        setAnnouncement(card ? `${cardName(card)} is covered` : 'No card here');
      }
    }
  };

  const handleKey = (e: KeyboardEvent): boolean => {
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowRight': {
        const step = e.key === 'ArrowLeft' ? -1 : 1;
        if (cursor.zone === 'pyramid') {
          const row = pyramid[cursor.row];
          for (let col = cursor.col + step; col >= 0 && col < row.length; col += step) {
            if (row[col]) {
              moveCursorTo({ zone: 'pyramid', row: cursor.row, col });
              break;
            }
          }
        } else {
          moveCursorTo({ zone: step < 0 ? 'stock' : 'waste' });
        }
        return true;
      }
      case 'ArrowUp':
        if (cursor.zone === 'pyramid') {
          moveCursorTo(nearestInDirection(pyramid, cursor.row - 1, -1, pyramidX(cursor.row, cursor.col)));
        } else {
          moveCursorTo(nearestInDirection(pyramid, pyramid.length - 1, -1, FOOTER_X[cursor.zone]));
        }
        return true;
      case 'ArrowDown':
        if (cursor.zone === 'pyramid') {
          const x = pyramidX(cursor.row, cursor.col);
          moveCursorTo(nearestInDirection(pyramid, cursor.row + 1, 1, x) ?? { zone: x < 0 ? 'stock' : 'waste' });
        }
        return true;
      case ' ':
      case 'Enter':
        playAtCursor();
        return true;
      case 'd':
      case 'D':
        drawFromStock();
        return true;
      case 'w':
      case 'W':
        setCursor({ zone: 'waste' });
        if (topWaste) interact(topWaste, 'waste');
        else {
          sound.playErrorBump();
          setAnnouncement('Waste is empty');
        }
        return true;
      case 'Escape': {
        if (!selectedCard) return false;
        const next = clonePyramidState(state);
        next.selectedCard = null;
        onSelectionChange(next);
        setAnnouncement('Deselected');
        return true;
      }
      default:
        return false;
    }
  };

  const keyboard = useBoardKeyboard({
    boardRef,
    enabled: keyboardEnabled && interactive,
    onKey: handleKey,
    onActivate: onKeyboardActivate,
  });
  const showCursor = keyboard.active;
  const cursorClass = (zone: PyramidCursor['zone'], row?: number, col?: number) =>
    showCursor &&
    cursor.zone === zone &&
    (cursor.zone !== 'pyramid' || (cursor.row === row && cursor.col === col))
      ? 'kb-cursor'
      : '';

  return (
    <div
      ref={boardRef}
      className={`pyramid-board ${showCursor ? 'kb-mode' : ''} ${interactive ? '' : 'read-only'}`}
      tabIndex={interactive ? 0 : -1}
      role="application"
      aria-roledescription="Pyramid board"
      aria-label="Pyramid board. Arrow keys move, Space or Enter selects and pairs cards, D draws, W takes the waste card. Press ? for all shortcuts."
      onFocus={keyboard.onBoardFocus}
    >
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
              const isHint = hintCardId === card.id || highlightCardIds.includes(card.id);

              return (
                <div
                  key={card.instanceId}
                  className={`pyramid-card-wrapper ${isExposed ? 'exposed' : 'covered'} ${cursorClass('pyramid', rowIdx, colIdx)}`}
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
                      } else if (interactive) {
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
            className={`card-slot stock-slot ${stock.length === 0 ? 'empty' : ''} ${cursorClass('stock')}`}
            onClick={handleStockClick}
            aria-label={stock.length > 0 ? `Draw card (${stock.length} left)` : 'Recycle waste'}
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
          <div className={`card-slot waste-slot ${cursorClass('waste')}`}>
            {topWaste ? (
              <div className="waste-cards-container">
                <CardView
                  card={topWaste}
                  deck={deck}
                  isSelected={selectedCard?.source === 'waste'}
                  isHint={hintCardId === topWaste.id || highlightCardIds.includes(topWaste.id)}
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

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
};
