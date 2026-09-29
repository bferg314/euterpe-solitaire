import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

const DURATION_MS = 260;
const EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const STOCK_KEY = '#stock';

type Point = { x: number; y: number };

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The translation a running motion is applying to an element right now. */
function motionOffset(el: HTMLElement): Point {
  if (el.getAnimations().length === 0) return { x: 0, y: 0 };
  const transform = getComputedStyle(el).transform;
  if (!transform || transform === 'none') return { x: 0, y: 0 };
  const m = new DOMMatrixReadOnly(transform);
  return { x: m.m41, y: m.m42 };
}

/**
 * Natural card movement (FLIP): the board updates at once, and every card that changed place
 * slides from where it was to where it is now. So the card itself moves, whatever made it move
 * (click, keyboard, draw, vacuum, auto-finish, undo), and nothing is left behind.
 *
 * Cards are the elements marked `data-motion-id` inside `boardRef`, matched by that id across
 * renders. Positions are relative to the board, so scrolling doesn't count as movement. Cards
 * marked `data-from-stock` that weren't on show before (a Turn 3 draw shows only the stock's top
 * card) start from the stock, marked `data-card-origin="stock"`, when the stock shrank.
 *
 * `skipNextMotion()` places the next change without motion: after a drag, the card is already
 * where the player dropped it.
 */
export function useCardMotion(boardRef: RefObject<HTMLElement | null>, state: { stock: unknown[] }) {
  const placesRef = useRef(new Map<string, Point>());
  const stockSizeRef = useRef(state.stock.length);
  const skipRef = useRef(false);

  const measure = useCallback((animate: boolean, stockShrank: boolean) => {
    const board = boardRef.current;
    if (!board) return;
    const origin = board.getBoundingClientRect();
    const previous = placesRef.current;
    const places = new Map<string, Point>();

    const stock = board.querySelector<HTMLElement>('[data-card-origin="stock"]');
    if (stock) {
      const r = stock.getBoundingClientRect();
      places.set(STOCK_KEY, { x: r.left - origin.left, y: r.top - origin.top });
    }

    board.querySelectorAll<HTMLElement>('[data-motion-id]').forEach((el) => {
      const id = el.dataset.motionId!;
      const r = el.getBoundingClientRect();
      const offset = motionOffset(el);
      // Where layout puts the card now, without any motion still running on it.
      const place = { x: r.left - origin.left - offset.x, y: r.top - origin.top - offset.y };
      places.set(id, place);
      if (!animate) return;

      const known = previous.get(id);
      // Same place as before: leave it be (and let any motion already under way finish).
      if (known && Math.abs(known.x - place.x) < 0.5 && Math.abs(known.y - place.y) < 0.5) return;
      const before = known ?? (stockShrank && el.dataset.fromStock ? previous.get(STOCK_KEY) : undefined);
      if (!before) return;
      // Where it's showing now: its old place plus any motion still under way.
      const dx = before.x + offset.x - place.x;
      const dy = before.y + offset.y - place.y;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      el.getAnimations().forEach((a) => a.cancel());
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)`, zIndex: 1000, filter: 'drop-shadow(0 10px 16px rgba(0, 0, 0, 0.45))' },
          { transform: 'translate(0, 0)', zIndex: 1000, filter: 'drop-shadow(0 0 0 rgba(0, 0, 0, 0))' },
        ],
        { duration: DURATION_MS, easing: EASING }
      );
    });
    placesRef.current = places;
  }, [boardRef]);

  // After every board change, before the browser paints: slide the cards that moved.
  useLayoutEffect(() => {
    const stockShrank = state.stock.length < stockSizeRef.current;
    stockSizeRef.current = state.stock.length;
    const animate = !skipRef.current && !prefersReducedMotion();
    skipRef.current = false;
    measure(animate, stockShrank);
  }, [state, measure]);

  // The board resizing moves cards without a move being made: re-measure, don't animate.
  useEffect(() => {
    const board = boardRef.current;
    if (!board || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measure(false, false));
    observer.observe(board);
    return () => observer.disconnect();
  }, [boardRef, measure]);

  return {
    skipNextMotion: useCallback(() => {
      skipRef.current = true;
    }, []),
  };
}
