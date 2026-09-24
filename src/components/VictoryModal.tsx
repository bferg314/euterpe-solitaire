import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import type { GameMode, DifficultyLevel } from '../types/solitaire';
import { Trophy, Clock, CheckCircle2, RotateCcw, Play, Share2 } from 'lucide-react';
import { sound } from '../services/audioService';
import { EfficiencyBadge } from './EfficiencyBadge';
import { calculateEfficiency, formatParDelta } from '../utils/efficiencyRating';

interface VictoryModalProps {
  gameMode: GameMode;
  difficulty: DifficultyLevel;
  seed: string;
  moves: number;
  timeSeconds: number;
  score: number;
  par?: number;
  onPlayAgain: () => void;
  onReplaySeed: () => void;
  onClose: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  gameMode,
  difficulty,
  seed,
  moves,
  timeSeconds,
  score,
  par = 0,
  onPlayAgain,
  onReplaySeed,
  onClose,
}) => {
  useEffect(() => {
    sound.playVictory();

    // Trigger double confetti blast
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      colors: ['#d4af37', '#facc15', '#38bdf8', '#ef4444', '#10b981'],
    };

    confetti({
      ...defaults,
      particleCount: Math.floor(count * 0.6),
      spread: 60,
    });
    confetti({
      ...defaults,
      particleCount: Math.floor(count * 0.4),
      spread: 100,
    });
  }, []);

  const formatTime = (secs: number): string => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}m ${s.toString().padStart(2, '0')}s`;
  };

  const eff = par > 0 ? calculateEfficiency(moves, par) : null;

  const copyShareText = () => {
    const parInfo = eff ? ` (${formatParDelta(eff.delta)} ${eff.label}, ${eff.efficiencyPct}% Efficiency)` : '';
    const text = `♠ Euterpe Solitaire: Solved ${gameMode.toUpperCase()} [${difficulty.toUpperCase()}] in ${moves} moves${parInfo}! Seed: ${seed}`;
    navigator.clipboard.writeText(text);
    alert('Victory score and efficiency rating copied to clipboard!');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card victory-card" onClick={(e) => e.stopPropagation()}>
        <div className="victory-icon-glow">
          <Trophy size={54} className="trophy-gold" />
        </div>

        <h2 className="victory-title">Victory Achieved!</h2>
        <p className="victory-subtitle">
          Superb strategy! You have mastered the cards on {difficulty.toUpperCase()} tier.
        </p>

        {/* Theoretical Par Efficiency Card */}
        {par > 0 && (
          <div className="victory-par-showcase">
            <EfficiencyBadge
              actualMoves={moves}
              par={par}
              showDescription={true}
            />
          </div>
        )}

        <div className="victory-stats-grid">
          <div className="victory-stat-item">
            <span className="v-label">TIME</span>
            <span className="v-val">
              <Clock size={16} /> {formatTime(timeSeconds)}
            </span>
          </div>
          <div className="victory-stat-item">
            <span className="v-label">MOVES</span>
            <span className="v-val">
              <CheckCircle2 size={16} /> {moves}
            </span>
          </div>
          <div className="victory-stat-item">
            <span className="v-label">SCORE</span>
            <span className="v-val trophy-accent">{score}</span>
          </div>
          <div className="victory-stat-item">
            <span className="v-label">SEED</span>
            <span className="v-val seed-code-val">{seed}</span>
          </div>
        </div>

        <div className="modal-actions-row">
          <button className="primary-action-btn" onClick={onPlayAgain}>
            <Play size={16} />
            <span>Next Deal</span>
          </button>
          <button
            className="secondary-action-btn replay-par-btn"
            onClick={onReplaySeed}
            title="Replay this seed to chase an even better Par efficiency"
          >
            <RotateCcw size={16} />
            <span>Chase Better Par</span>
          </button>
          <button className="secondary-action-btn" onClick={copyShareText} title="Share results with efficiency rating">
            <Share2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
