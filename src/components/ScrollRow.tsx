import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ScrollRowProps {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  /** Changes to this bring the child marked `.active` into view (e.g. the selected step). */
  activeKey?: unknown;
}

/**
 * A horizontally scrolling row without a scrollbar to grab: the mouse wheel scrolls it
 * sideways, arrow buttons appear at whichever end has more, and the edges fade out.
 */
export const ScrollRow: React.FC<ScrollRowProps> = ({ children, className = '', ariaLabel, activeKey }) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateEnds = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateEnds();
    // Vertical wheel scrolls sideways. Needs a non-passive listener to stop the page scrolling too.
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('scroll', updateEnds, { passive: true });
    const resize = new ResizeObserver(updateEnds);
    resize.observe(el);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('scroll', updateEnds);
      resize.disconnect();
    };
  }, [updateEnds]);

  // Keep the active child in view, without scrolling anything but this row.
  useEffect(() => {
    const el = scrollerRef.current;
    const active = el?.querySelector<HTMLElement>('.active');
    if (!el || !active) return;
    const left = active.offsetLeft - el.offsetLeft;
    const right = left + active.offsetWidth;
    if (left < el.scrollLeft) el.scrollTo({ left: left - 24, behavior: 'smooth' });
    else if (right > el.scrollLeft + el.clientWidth) el.scrollTo({ left: right - el.clientWidth + 24, behavior: 'smooth' });
  }, [activeKey]);

  const page = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <div className={`scroll-row ${canLeft ? 'can-left' : ''} ${canRight ? 'can-right' : ''} ${className}`}>
      <button
        type="button"
        className="scroll-row-arrow left"
        onClick={() => page(-1)}
        tabIndex={canLeft ? 0 : -1}
        aria-hidden={!canLeft}
        aria-label="Scroll left"
      >
        <ChevronLeft size={14} />
      </button>
      <div ref={scrollerRef} className="scroll-row-track" role="group" aria-label={ariaLabel}>
        {children}
      </div>
      <button
        type="button"
        className="scroll-row-arrow right"
        onClick={() => page(1)}
        tabIndex={canRight ? 0 : -1}
        aria-hidden={!canRight}
        aria-label="Scroll right"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
};
