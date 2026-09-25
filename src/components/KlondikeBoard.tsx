import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { SolitaireCard, KlondikeState } from '../types/solitaire';
import type { LoadedDeck } from '../services/deckLoader';
import { CardView } from './CardView';
import { CardStack } from './CardStack';
import {
  applyKlondikeMove,
  cloneKlondikeState,
  getMovingCards,
  type KlondikeMoveSource,
  type KlondikeMoveTarget,
} from '../engines/klondikeEngine';
import {
  findSmartDestination,
  findSafeFoundationMove,
  getFoundationIndexForSuit,
} from '../engines/safePlayEngine';
import { FlyingCardOverlay, type FlyingCardAnim } from './FlyingCardOverlay';
import { sound } from '../services/audioService';
import { useBoardKeyboard } from '../hooks/useBoardKeyboard';
import { RefreshCw } from 'lucide-react';

interface KlondikeBoardProps {
  state: KlondikeState;
  deck: LoadedDeck | null;
  hintCardId: string | null;
  ambientVacuumEnabled?: boolean;
  smartTapEnabled?: boolean;
  keyboardEnabled?: boolean;
  onKeyboardActivate?: () => void;
  onStateChange: (newState: KlondikeState, description: string) => void;
}

interface DragPayload {
  source: 'tableau' | 'waste' | 'foundation';
  colIndex?: number;
  cardIndex?: number;
  cards: SolitaireCard[];
}

/**
 * Keyboard cursor. The top row has 6 slots: 0 stock, 1 waste, 2–5 foundations.
 * In the tableau, `index` is the card a pick-up would start from (-1 = empty column).
 */
type KlondikeCursor = { zone: 'top'; slot: number } | { zone: 'tableau'; col: number; index: number };

interface HeldCards {
  source: KlondikeMoveSource;
  rootId: string;
}

// Which tableau column sits under each top-row slot, and back (foundations sit over columns 4–7).
const TOP_SLOT_TO_COL = [0, 1, 3, 4, 5, 6];
const COL_TO_TOP_SLOT = [0, 1, 1, 2, 3, 4, 5];
const FOUNDATION_NAMES = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
const TOP_OF_COLUMN = Number.MAX_SAFE_INTEGER;

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);
const cardName = (card: SolitaireCard) => card.name || card.label;

function dragSource(drag: DragPayload): KlondikeMoveSource {
  if (drag.source === 'tableau') return { pile: 'tableau', col: drag.colIndex!, index: drag.cardIndex! };
  if (drag.source === 'foundation') return { pile: 'foundation', index: drag.colIndex! };
  return { pile: 'waste' };
}

/** Keeps the cursor on a real spot after the board changes under it (moves, undo, vacuum). */
function normalizeCursor(cursor: KlondikeCursor, state: KlondikeState): KlondikeCursor {
  if (cursor.zone === 'top') return { zone: 'top', slot: clamp(cursor.slot, 0, 5) };
  const col = clamp(cursor.col, 0, 6);
  const cards = state.tableau[col];
  if (cards.length === 0) return { zone: 'tableau', col, index: -1 };
  const firstFaceUp = cards.findIndex((c) => c.faceUp);
  const minIndex = firstFaceUp === -1 ? cards.length - 1 : firstFaceUp;
  return { zone: 'tableau', col, index: clamp(cursor.index, minIndex, cards.length - 1) };
}

function sameSourcePile(source: KlondikeMoveSource, target: KlondikeMoveTarget): boolean {
  if (source.pile === 'tableau' && target.pile === 'tableau') return source.col === target.col;
  if (source.pile === 'foundation' && target.pile === 'foundation') return source.index === target.index;
  return false;
}

export const KlondikeBoard: React.FC<KlondikeBoardProps> = ({
  state,
  deck,
  hintCardId,
  ambientVacuumEnabled = true,
  smartTapEnabled = true,
  keyboardEnabled = true,
  onKeyboardActivate,
  onStateChange,
}) => {
  const [activeDrag, setActiveDrag] = useState<DragPayload | null>(null);
  const [flyingAnims, setFlyingAnims] = useState<FlyingCardAnim[]>([]);
  const pendingMoveRef = useRef<{ nextState: KlondikeState; description: string } | null>(null);
  const isFlyingRef = useRef(false);
  const animSeqRef = useRef(0);
  const boardRef = useRef<HTMLDivElement>(null);

  const [rawCursor, setCursor] = useState<KlondikeCursor>({ zone: 'top', slot: 0 });
  const [rawHeld, setHeld] = useState<HeldCards | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const cursor = normalizeCursor(rawCursor, state);
  // Held cards are dropped if the board changed underneath them (undo, draw, vacuum).
  const heldCards = rawHeld ? getMovingCards(state, rawHeld.source) : [];
  const held = rawHeld && heldCards[0]?.instanceId === rawHeld.rootId ? rawHeld : null;

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
  const isHolding = held !== null;
  useEffect(() => {
    if (!ambientVacuumEnabled || activeDrag !== null || isHolding || isFlyingRef.current) return;

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
  }, [state, ambientVacuumEnabled, activeDrag, isHolding, onStateChange]);

  // Smart Destination Tap: intelligent move on single/double click with golden vector flight.
  // Returns whether a move was found.
  const handleCardClick = (card: SolitaireCard): boolean => {
    if (!card.faceUp || isFlyingRef.current) return false;

    const move = findSmartDestination(card, state);
    const source: KlondikeMoveSource | null =
      move?.from === 'waste'
        ? { pile: 'waste' }
        : move?.fromCol !== undefined && move.cardIndex !== undefined
        ? { pile: 'tableau', col: move.fromCol, index: move.cardIndex }
        : null;
    const result =
      move && source
        ? applyKlondikeMove(
            state,
            source,
            move.type === 'foundation'
              ? { pile: 'foundation', index: move.targetCol }
              : { pile: 'tableau', col: move.targetCol }
          )
        : null;
    if (!move || !result) {
      sound.playErrorBump();
      return false;
    }

    const { next, cards: movedCards } = result;
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
    return true;
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
    const drag = activeDrag;
    setActiveDrag(null);
    if (drag.source === 'tableau' && drag.colIndex === targetColIdx) return;

    const result = applyKlondikeMove(state, dragSource(drag), { pile: 'tableau', col: targetColIdx });
    if (!result) {
      sound.playErrorBump();
      return;
    }
    sound.playCardSnap();
    onStateChange(result.next, `Moved cards to column ${targetColIdx + 1}`);
  };

  // Drop on Foundation Pile
  const handleFoundationDrop = (targetFIdx: number, e: React.DragEvent) => {
    e.preventDefault();
    const drag = activeDrag;
    setActiveDrag(null);
    if (drag?.source === 'foundation' && drag.colIndex === targetFIdx) return;

    const result =
      drag && drag.cards.length === 1
        ? applyKlondikeMove(state, dragSource(drag), { pile: 'foundation', index: targetFIdx })
        : null;
    if (!result) {
      sound.playErrorBump();
      return;
    }
    sound.playCardSnap();
    onStateChange(result.next, `Moved ${result.cards[0].label} to Foundation`);
  };

  // ---------------------------------------------------------------------------
  // Keyboard mode
  // ---------------------------------------------------------------------------

  const describeCursor = (c: KlondikeCursor): string => {
    if (c.zone === 'top') {
      if (c.slot === 0) {
        return state.stock.length > 0 ? `Stock, ${state.stock.length} cards` : 'Stock empty, recycle waste';
      }
      if (c.slot === 1) {
        const top = state.waste[state.waste.length - 1];
        return top ? `Waste: ${cardName(top)}` : 'Waste, empty';
      }
      const pile = state.foundations[c.slot - 2];
      const top = pile[pile.length - 1];
      return `${FOUNDATION_NAMES[c.slot - 2]} foundation: ${top ? cardName(top) : 'empty'}`;
    }
    const cards = state.tableau[c.col];
    if (c.index < 0) return `Column ${c.col + 1}, empty`;
    const run = cards.length - c.index;
    const hidden = cards.filter((card) => !card.faceUp).length;
    return [
      `Column ${c.col + 1}: ${cardName(cards[c.index])}`,
      run > 1 ? `${run} cards` : '',
      hidden > 0 ? `${hidden} hidden` : '',
    ]
      .filter(Boolean)
      .join(', ');
  };

  const moveCursorTo = (next: KlondikeCursor) => {
    const normalized = normalizeCursor(next, state);
    setCursor(normalized);
    setAnnouncement(describeCursor(normalized));
  };

  const cursorSource = (c: KlondikeCursor): KlondikeMoveSource | null => {
    if (c.zone === 'top') {
      if (c.slot === 1) return { pile: 'waste' };
      if (c.slot >= 2) return { pile: 'foundation', index: c.slot - 2 };
      return null;
    }
    return c.index >= 0 ? { pile: 'tableau', col: c.col, index: c.index } : null;
  };

  const cursorTarget = (c: KlondikeCursor): KlondikeMoveTarget | null => {
    if (c.zone === 'tableau') return { pile: 'tableau', col: c.col };
    return c.slot >= 2 ? { pile: 'foundation', index: c.slot - 2 } : null;
  };

  const pickUp = () => {
    const source = cursorSource(cursor);
    const cards = source ? getMovingCards(state, source) : [];
    if (!source || cards.length === 0) {
      sound.playErrorBump();
      setAnnouncement('Nothing to pick up here');
      return;
    }
    sound.playCardSlide();
    setHeld({ source, rootId: cards[0].instanceId });
    setAnnouncement(
      `Holding ${cardName(cards[0])}${cards.length > 1 ? ` and ${cards.length - 1} more` : ''}. Move to a pile and press Space to drop`
    );
  };

  const dropOn = (target: KlondikeMoveTarget | null) => {
    if (!held) return;
    if (target && sameSourcePile(held.source, target)) {
      setHeld(null);
      setAnnouncement('Put back');
      return;
    }
    const result = target ? applyKlondikeMove(state, held.source, target) : null;
    if (!target || !result) {
      sound.playErrorBump();
      setAnnouncement(`Can't place ${cardName(heldCards[0])} there`);
      return;
    }
    const desc =
      target.pile === 'tableau'
        ? `Moved cards to column ${target.col + 1}`
        : `Moved ${result.cards[0].label} to Foundation`;
    sound.playCardSnap();
    setHeld(null);
    onStateChange(result.next, desc);
    setAnnouncement(
      target.pile === 'tableau'
        ? `Moved ${cardName(result.cards[0])} to column ${target.col + 1}`
        : `Moved ${cardName(result.cards[0])} to foundation`
    );
  };

  const sendToFoundation = () => {
    let source: KlondikeMoveSource | null = null;
    if (held && heldCards.length === 1) {
      source = held.source;
    } else if (cursor.zone === 'tableau' && cursor.index >= 0) {
      source = { pile: 'tableau', col: cursor.col, index: state.tableau[cursor.col].length - 1 };
    } else if (cursor.zone === 'top' && cursor.slot === 1) {
      source = { pile: 'waste' };
    }
    const card = source ? getMovingCards(state, source)[0] : undefined;
    const result =
      source && card
        ? applyKlondikeMove(state, source, { pile: 'foundation', index: getFoundationIndexForSuit(card.suit) })
        : null;
    if (!card || !result) {
      sound.playErrorBump();
      setAnnouncement(card ? `${cardName(card)} can't go to a foundation yet` : 'No card to send to a foundation');
      return;
    }
    sound.playCardSnap();
    setHeld(null);
    onStateChange(result.next, `Moved ${card.label} to Foundation`);
    setAnnouncement(`Moved ${cardName(card)} to foundation`);
  };

  const drawFromStock = () => {
    setHeld(null);
    const recycling = state.stock.length === 0;
    if (recycling && state.waste.length === 0) {
      sound.playErrorBump();
      setAnnouncement('Stock and waste are empty');
      return;
    }
    handleStockClick();
    setAnnouncement(recycling ? 'Recycled waste to stock' : 'Drew from stock');
  };

  const playAtCursor = () => {
    if (cursor.zone === 'top' && cursor.slot === 0) {
      drawFromStock();
      return;
    }
    const source = cursorSource(cursor);
    const card = source ? getMovingCards(state, source)[0] : undefined;
    if (!card) {
      sound.playErrorBump();
      setAnnouncement('Nothing to play here');
      return;
    }
    setAnnouncement(handleCardClick(card) ? `Played ${cardName(card)}` : `No move for ${cardName(card)}`);
  };

  const handleKey = (e: KeyboardEvent): boolean => {
    const busy = isFlyingRef.current;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowRight': {
        const step = e.key === 'ArrowLeft' ? -1 : 1;
        moveCursorTo(
          cursor.zone === 'top'
            ? { zone: 'top', slot: cursor.slot + step }
            : { zone: 'tableau', col: cursor.col + step, index: TOP_OF_COLUMN }
        );
        return true;
      }
      case 'ArrowDown':
        if (cursor.zone === 'top') {
          moveCursorTo({ zone: 'tableau', col: TOP_SLOT_TO_COL[cursor.slot], index: TOP_OF_COLUMN });
        } else if (!held) {
          moveCursorTo({ ...cursor, index: cursor.index + 1 });
        }
        return true;
      case 'ArrowUp': {
        if (cursor.zone === 'top') return true;
        const cards = state.tableau[cursor.col];
        const firstFaceUp = cards.findIndex((c) => c.faceUp);
        if (held || cursor.index <= firstFaceUp || cursor.index < 0) {
          moveCursorTo({ zone: 'top', slot: COL_TO_TOP_SLOT[cursor.col] });
        } else {
          moveCursorTo({ ...cursor, index: cursor.index - 1 });
        }
        return true;
      }
      case ' ':
      case 'Enter':
        if (busy) return true;
        if (held) dropOn(cursorTarget(cursor));
        else if (e.key === ' ' && !(cursor.zone === 'top' && cursor.slot === 0)) pickUp();
        else playAtCursor();
        return true;
      case 'd':
      case 'D':
        if (!busy) drawFromStock();
        return true;
      case 'w':
      case 'W':
        moveCursorTo({ zone: 'top', slot: 1 });
        return true;
      case 'f':
      case 'F':
        if (!busy) sendToFoundation();
        return true;
      case 'Escape':
        if (!held) return false;
        setHeld(null);
        setAnnouncement('Put back');
        return true;
      default:
        if (/^[1-7]$/.test(e.key)) {
          const col = Number(e.key) - 1;
          moveCursorTo({ zone: 'tableau', col, index: TOP_OF_COLUMN });
          if (held && !busy) dropOn({ pile: 'tableau', col });
          return true;
        }
        return false;
    }
  };

  const keyboard = useBoardKeyboard({
    boardRef,
    enabled: keyboardEnabled,
    onKey: handleKey,
    onPointer: () => setHeld(null),
    onActivate: onKeyboardActivate,
  });
  const showCursor = keyboard.active;

  const topSlotClass = (slot: number) => (showCursor && cursor.zone === 'top' && cursor.slot === slot ? 'kb-cursor' : '');
  const foundationSuits = ['♠', '♥', '♦', '♣'];

  return (
    <div
      ref={boardRef}
      className={`klondike-board ${showCursor ? 'kb-mode' : ''}`}
      tabIndex={0}
      role="application"
      aria-roledescription="Klondike board"
      aria-label="Klondike board. Arrow keys move, Space picks up or drops, Enter plays a card, D draws, 1 to 7 jump to a column. Press ? for all shortcuts."
      onFocus={keyboard.onBoardFocus}
    >
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
            className={`card-slot stock-slot ${state.stock.length === 0 ? 'empty' : ''} ${topSlotClass(0)}`}
            onClick={handleStockClick}
            aria-label={state.stock.length > 0 ? `Draw card (${state.stock.length} left)` : 'Recycle waste'}
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
          {/* The waste fans right, so the cursor rings its top card rather than the slot */}
          <div className={`card-slot waste-slot ${state.waste.length === 0 ? topSlotClass(1) : ''}`}>
            {state.waste.length > 0 ? (
              <div className="waste-cards-container">
                {state.waste.slice(-3).map((card, idx, arr) => {
                  const isTop = idx === arr.length - 1;
                  return (
                    <div
                      key={card.instanceId}
                      id={`card-${card.instanceId}`}
                      className={`waste-fanned-card ${isTop && held?.source.pile === 'waste' ? 'kb-held' : ''} ${isTop ? topSlotClass(1) : ''}`}
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
            const isHeld = held?.source.pile === 'foundation' && held.source.index === fIdx;

            return (
              <div
                key={fIdx}
                id={`foundation-slot-${fIdx}`}
                className={`card-slot foundation-slot ${topSlotClass(fIdx + 2)} ${isHeld ? 'kb-held' : ''}`}
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
            cursorIndex={showCursor && cursor.zone === 'tableau' && cursor.col === colIdx ? cursor.index : null}
            cursorIsTarget={held !== null}
            heldFromIndex={held?.source.pile === 'tableau' && held.source.col === colIdx ? held.source.index : null}
            onCardClick={handleCardClick}
            onCardDoubleClick={handleCardClick}
            onDragStart={handleTableauDragStart}
            onDrop={handleTableauDrop}
          />
        ))}
      </div>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
};
