import React, { useEffect, useRef, useState } from 'react';
import { Check, MoreHorizontal } from 'lucide-react';

export interface HeaderMenuItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  /** Set for on/off settings: the item becomes a checkbox item. */
  checked?: boolean;
  /** Only listed on narrow screens, where its header button is hidden. */
  narrowOnly?: boolean;
}

interface HeaderMenuProps {
  items: HeaderMenuItem[];
  /** Lets App pause board keys while the menu is open. */
  onOpenChange: (open: boolean) => void;
}

/** The header's "More" menu: the settings that don't fit inline on narrower screens. */
export const HeaderMenu: React.FC<HeaderMenuProps> = ({ items, onOpenChange }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Items hidden by CSS on this screen width can't be reached.
  const visibleItems = () =>
    Array.from(popupRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []).filter(
      (el) => el.offsetParent !== null
    );

  const setMenuOpen = (next: boolean) => {
    setOpen(next);
    onOpenChange(next);
  };

  useEffect(() => {
    if (!open) return;
    visibleItems()[0]?.focus();
    const closeOnOutside = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    return () => document.removeEventListener('pointerdown', closeOnOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    const list = visibleItems();
    const index = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      list[(index + step + list.length) % list.length]?.focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      list[e.key === 'Home' ? 0 : list.length - 1]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setMenuOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'Tab') {
      setMenuOpen(false);
    }
  };

  const select = (item: HeaderMenuItem) => {
    // Focus the trigger first, so a modal the item opens hands focus back here when it closes.
    triggerRef.current?.focus();
    setMenuOpen(false);
    item.onSelect();
  };

  return (
    <div className="header-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        className={`icon-btn ${open ? 'menu-open' : ''}`}
        aria-label="More options"
        title="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setMenuOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setMenuOpen(true);
          }
        }}
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div className="header-menu-popup" role="menu" aria-label="More options" ref={popupRef} onKeyDown={handleMenuKeyDown}>
          {items.map((item) => (
            <button
              key={item.key}
              className={`header-menu-item ${item.narrowOnly ? 'narrow-only' : ''}`}
              role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
              aria-checked={item.checked}
              tabIndex={-1}
              onClick={() => select(item)}
            >
              <span className="header-menu-icon">{item.icon}</span>
              <span className="header-menu-label">{item.label}</span>
              {item.checked !== undefined && (
                <span className={`header-menu-check ${item.checked ? 'on' : ''}`}>
                  {item.checked ? <Check size={14} /> : 'Off'}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
