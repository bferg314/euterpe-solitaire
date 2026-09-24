import React, { useEffect } from 'react';
import type { GameMode, DifficultyLevel } from '../types/solitaire';
import { AlertTriangle, Clock, Play, RotateCcw, X, Hash } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  currentMode: GameMode;
  difficulty: DifficultyLevel;
  moves: number;
  timeSeconds: number;
  score: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Keep Playing',
  currentMode,
  difficulty,
  moves,
  timeSeconds,
  score,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const formatTime = (secs: number): string => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  const getModeLabel = (mode: GameMode): string => {
    switch (mode) {
      case 'klondike-1':
        return 'Klondike (Turn 1)';
      case 'klondike-3':
        return 'Klondike (Turn 3)';
      case 'pyramid':
        return 'Pyramid Solitaire';
    }
  };

  return (
    <div className="modal-backdrop confirm-modal-backdrop" onClick={onCancel}>
      <div
        className="modal-card confirm-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <div className="modal-header">
          <div className="modal-header-title">
            <div className="confirm-icon-badge">
              <AlertTriangle size={20} className="amber-alert-icon" />
            </div>
            <h3 id="confirm-modal-title">{title}</h3>
          </div>
          <button className="modal-close-btn" onClick={onCancel} title="Cancel">
            <X size={18} />
          </button>
        </div>

        <div className="confirm-modal-body">
          <p className="confirm-description">{description}</p>

          {/* Current Game Progress Snapshot */}
          <div className="confirm-progress-card">
            <div className="confirm-progress-header">
              <span className="confirm-mode-tag">
                {getModeLabel(currentMode)} • {difficulty.toUpperCase()}
              </span>
              <span className="confirm-warning-note">Current Game in Progress</span>
            </div>

            <div className="confirm-stats-row">
              <div className="confirm-stat-item">
                <span className="confirm-stat-label">
                  <RotateCcw size={12} /> Moves
                </span>
                <span className="confirm-stat-value">{moves}</span>
              </div>
              <div className="confirm-stat-item">
                <span className="confirm-stat-label">
                  <Clock size={12} /> Time
                </span>
                <span className="confirm-stat-value">{formatTime(timeSeconds)}</span>
              </div>
              <div className="confirm-stat-item">
                <span className="confirm-stat-label">
                  <Hash size={12} /> Score
                </span>
                <span className="confirm-stat-value">{score}</span>
              </div>
            </div>
          </div>

          <div className="confirm-footer-note">
            Starting a new game will forfeit this board. This action cannot be undone.
          </div>
        </div>

        <div className="confirm-actions-row">
          <button className="action-btn confirm-cancel-btn" onClick={onCancel}>
            <Play size={15} />
            <span>{cancelLabel}</span>
          </button>
          <button className="action-btn confirm-proceed-btn" onClick={onConfirm}>
            <AlertTriangle size={15} />
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
