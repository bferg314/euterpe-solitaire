import { useEffect, useRef, useState } from 'react';
import type { FocusEvent, RefObject } from 'react';

interface BoardKeyboardOptions {
  boardRef: RefObject<HTMLElement | null>;
  /** False while a modal, Fork preview or shuffle owns the screen. */
  enabled: boolean;
  /** Handle a key; return true if the board consumed it. */
  onKey: (e: KeyboardEvent) => boolean;
  /** The player went back to the mouse (cancel held cards, etc.). */
  onPointer?: () => void;
  /** Keyboard mode just turned on. */
  onActivate?: () => void;
}

/**
 * Routes keys to a game board while the board (or nothing in particular) has focus,
 * and tracks whether the player is in keyboard mode so the cursor only shows then.
 * Listens in the capture phase so a board can claim Escape before the app-wide
 * listener closes modals with it.
 */
export function useBoardKeyboard({ boardRef, enabled, onKey, onPointer, onActivate }: BoardKeyboardOptions) {
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);
  const handlers = useRef({ onKey, onPointer, onActivate });

  useEffect(() => {
    handlers.current = { onKey, onPointer, onActivate };
  });

  const activate = () => {
    if (activeRef.current) return;
    activeRef.current = true;
    setActive(true);
    handlers.current.onActivate?.();
  };
  const activateRef = useRef(activate);
  useEffect(() => {
    activateRef.current = activate;
  });

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const board = boardRef.current;
      if (!board) return;
      const focused = document.activeElement;
      const boardOwnsFocus = !focused || focused === document.body || board.contains(focused);
      if (!boardOwnsFocus) return;
      if (!handlers.current.onKey(e)) return;

      e.preventDefault();
      e.stopPropagation();
      if (!board.contains(focused)) board.focus({ preventScroll: true });
      activateRef.current();
    };

    const leaveKeyboardMode = () => {
      activeRef.current = false;
      setActive(false);
      handlers.current.onPointer?.();
    };
    // Browsers send movement-less mousemoves when content shifts under a still cursor.
    const onMouseMove = (e: MouseEvent) => {
      if (activeRef.current && (e.movementX !== 0 || e.movementY !== 0)) leaveKeyboardMode();
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('pointerdown', leaveKeyboardMode, true);
    window.addEventListener('mousemove', onMouseMove, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('pointerdown', leaveKeyboardMode, true);
      window.removeEventListener('mousemove', onMouseMove, true);
    };
  }, [enabled, boardRef]);

  /** Tabbing onto the board counts as entering keyboard mode. */
  const onBoardFocus = (e: FocusEvent<HTMLElement>) => {
    if (e.target === e.currentTarget && e.currentTarget.matches(':focus-visible')) activate();
  };

  return { active: enabled && active, onBoardFocus };
}
