import { useEffect, useRef, useState } from 'react';

/**
 * Replaces native `title` tooltips app-wide. The browser draws those under the
 * cursor, where the pointer hides them; this layer lifts each `title` into
 * `data-tooltip` (suppressing the native one) and shows it anchored below the
 * element instead, or above when there's no room below.
 */

const GAP = 8;
const SHOW_DELAY_MS = 350;
const EDGE = 8;

interface TipState {
  text: string;
  x: number;
  y: number;
  placement: 'below' | 'above';
}

function liftTitle(el: Element) {
  const title = el.getAttribute('title');
  if (title === null) return;
  el.removeAttribute('title');
  if (title) {
    el.setAttribute('data-tooltip', title);
    // Icon-only controls relied on `title` for their accessible name.
    if (!el.hasAttribute('aria-label') && !el.textContent?.trim()) {
      el.setAttribute('aria-label', title);
    }
  }
}

export function TooltipLayer() {
  const [tip, setTip] = useState<TipState | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<Element | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    document.querySelectorAll('[title]').forEach(liftTitle);

    const show = (el: Element) => {
      const text = el.getAttribute('data-tooltip');
      if (!text) return;
      const rect = el.getBoundingClientRect();
      const roomBelow = window.innerHeight - rect.bottom;
      setTip({
        text,
        x: rect.left + rect.width / 2,
        y: roomBelow > 48 ? rect.bottom + GAP : rect.top - GAP,
        placement: roomBelow > 48 ? 'below' : 'above',
      });
    };

    const hide = () => {
      window.clearTimeout(timerRef.current);
      anchorRef.current = null;
      setTip(null);
    };

    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const target = e.target as Element | null;
      // Lift any title on the hovered path before the browser's own tooltip delay elapses.
      for (let n = target; n && n !== document.body; n = n.parentElement) liftTitle(n);
      const el = target?.closest('[data-tooltip]') ?? null;
      if (el === anchorRef.current) return;
      hide();
      if (!el) return;
      anchorRef.current = el;
      timerRef.current = window.setTimeout(() => show(el), SHOW_DELAY_MS);
    };

    const onLeaveWindow = (e: PointerEvent) => {
      if (!e.relatedTarget) hide();
    };

    // React re-sets `title` when a dynamic label changes (e.g. "Draw card (15 left)").
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        const el = m.target as Element;
        if (el.hasAttribute('title')) {
          liftTitle(el);
          if (el === anchorRef.current) show(el);
        }
      }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['title'], subtree: true });

    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerout', onLeaveWindow);
    document.addEventListener('pointerdown', hide, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('blur', hide);
    return () => {
      observer.disconnect();
      window.clearTimeout(timerRef.current);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onLeaveWindow);
      document.removeEventListener('pointerdown', hide, true);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('blur', hide);
    };
  }, []);

  // Clamp to the viewport once the tooltip's own width is known.
  useEffect(() => {
    if (!tip || !tipRef.current) {
      setPos(null);
      return;
    }
    const { width, height } = tipRef.current.getBoundingClientRect();
    const left = Math.min(Math.max(tip.x - width / 2, EDGE), window.innerWidth - width - EDGE);
    const top = tip.placement === 'below' ? tip.y : tip.y - height;
    setPos({ left, top });
  }, [tip]);

  if (!tip) return null;
  return (
    <div
      ref={tipRef}
      className="app-tooltip"
      role="tooltip"
      style={{ left: pos?.left ?? tip.x, top: pos?.top ?? tip.y, visibility: pos ? 'visible' : 'hidden' }}
    >
      {tip.text}
    </div>
  );
}
