import type React from 'react';
import { useEffect, useState } from 'react';

const BASE_STEP_MS = 1100;

export interface TrainerPlayback {
  index: number;
  setIndex: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  setPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  speed: number;
  setSpeed: (speed: number) => void;
  total: number;
}

/**
 * Playback over a line of `total` moves: autoplay one move per tick, and the Trainer's keys
 * (Esc, Space, ←/→, Home/End). Trainer keys win over the game's while it's open.
 */
export function useTrainerPlayback(total: number, ready: boolean, onClose: () => void): TrainerPlayback {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  // Autoplay: one move per tick. Reaching the end simply stops it.
  const isPlaying = playing && index < total && ready;
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setTimeout(() => setIndex((i) => Math.min(total, i + 1)), BASE_STEP_MS / speed);
    return () => clearTimeout(timer);
  }, [isPlaying, index, total, speed]);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      let handled = true;
      if (e.key === 'Escape') onClose();
      else if (e.key === ' ') setPlaying(index < total && !isPlaying);
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(total, i + 1));
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
      else if (e.key === 'Home') setIndex(0);
      else if (e.key === 'End') setIndex(total);
      else handled = false;
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handle, true);
    return () => window.removeEventListener('keydown', handle, true);
  }, [index, total, isPlaying, onClose]);

  return { index, setIndex, isPlaying, setPlaying, speed, setSpeed, total };
}
