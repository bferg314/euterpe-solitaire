import React, { useState } from 'react';
import type { DifficultyLevel, GameMode } from '../types/solitaire';
import {
  getDailyChallengeSeed,
  createSeedForDifficulty,
  generateRandomSeed,
} from '../services/rngService';
import { Hash, Sparkles, Copy, Play, Calendar, ShieldCheck, Flame, Compass } from 'lucide-react';
import { Modal } from './Modal';
import { difficultyLabel } from '../utils/labels';

interface SeedModalProps {
  currentSeed: string;
  currentDifficulty: DifficultyLevel;
  gameMode: GameMode;
  winnableOnly: boolean;
  onToggleWinnableOnly: () => void;
  /** `seed` is null when the player chose a difficulty but no seed of their own. */
  onApplySeedAndDifficulty: (seed: string | null, difficulty: DifficultyLevel) => void;
  onClose: () => void;
}

const TIER_CARDS = [
  {
    difficulty: 'easy',
    Icon: ShieldCheck,
    klondike: 'High initial mobility, accessible Aces, smooth forward momentum.',
    pyramid: 'Winnable in 55 moves or fewer: few passes through the stock.',
  },
  {
    difficulty: 'medium',
    Icon: Compass,
    klondike: 'Classic tournament random distribution requiring keen observation.',
    pyramid: 'Winnable in 56–60 moves.',
  },
  {
    difficulty: 'hard',
    Icon: Flame,
    klondike: 'Constrained initial plays; buried Aces demand multi-turn planning.',
    pyramid: 'Winnable, but the best line takes 61+ moves: more stock passes to plan.',
  },
] as const satisfies readonly { difficulty: DifficultyLevel; Icon: unknown; klondike: string; pyramid: string }[];

export const SeedModal: React.FC<SeedModalProps> = ({
  currentSeed,
  currentDifficulty,
  gameMode,
  winnableOnly,
  onToggleWinnableOnly,
  onApplySeedAndDifficulty,
  onClose,
}) => {
  const [inputSeed, setInputSeed] = useState(currentSeed);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>(currentDifficulty);
  const [copied, setCopied] = useState(false);
  // True when the seed in the box came from a tier pick or Randomize rather than the player.
  const [seedIsGenerated, setSeedIsGenerated] = useState(false);
  // True once the player types a seed: picking a tier then keeps it instead of replacing it.
  const [seedTyped, setSeedTyped] = useState(false);
  const isPyramid = gameMode === 'pyramid';
  const pickWinnable = winnableOnly;

  const todayDailySeed = getDailyChallengeSeed();

  const handleCopySeed = () => {
    navigator.clipboard.writeText(currentSeed);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = (seedToUse: string, diffToUse: DifficultyLevel, generated = false) => {
    // A generated seed just stands for "a deal at this tier": let the winnable-deal search pick one.
    if (generated && pickWinnable) {
      onApplySeedAndDifficulty(null, diffToUse);
      onClose();
      return;
    }
    onApplySeedAndDifficulty(seedToUse.trim() || generateRandomSeed(), diffToUse);
    onClose();
  };

  const handleGenerateNew = () => {
    const newSeed = createSeedForDifficulty(selectedDifficulty);
    setInputSeed(newSeed);
    setSeedIsGenerated(true);
    setSeedTyped(false);
  };

  const handlePickTier = (difficulty: DifficultyLevel) => {
    setSelectedDifficulty(difficulty);
    if (seedTyped && inputSeed.trim()) return;
    setInputSeed(createSeedForDifficulty(difficulty));
    setSeedIsGenerated(true);
  };

  return (
    <Modal
      title="Deal Options"
      icon={<Hash size={20} className="gold-icon" />}
      className="seed-modal-card"
      onClose={onClose}
    >
      {/* Daily Challenge Hero Banner */}
      <div className="daily-challenge-hero">
        <div className="hero-text">
          <div className="hero-tag">
            <Calendar size={14} /> TODAY'S DAILY CHALLENGE
          </div>
          <h4>{todayDailySeed}</h4>
          <p>
            Every player gets the same deal today, checked by the solver to be winnable.
          </p>
        </div>
        <button
          className="daily-play-btn"
          onClick={() => handleApply(todayDailySeed, 'daily')}
        >
          <Sparkles size={16} /> Play Daily
        </button>
      </div>

      {/* Difficulty: a radio group, so arrow keys move between tiers */}
      <div className="challenge-tiers-section">
        <h4 id="seed-tier-heading">Difficulty</h4>
        <div className="tiers-grid" role="radiogroup" aria-labelledby="seed-tier-heading">
          {TIER_CARDS.map(({ difficulty, Icon, klondike, pyramid }) => (
            <label key={difficulty} className={`tier-card ${selectedDifficulty === difficulty ? 'selected' : ''}`}>
              <input
                type="radio"
                name="seed-tier"
                className="sr-only"
                checked={selectedDifficulty === difficulty}
                onChange={() => handlePickTier(difficulty)}
              />
              <div className="tier-header">
                <Icon size={18} className={`tier-icon ${difficulty}`} />
                <span className="tier-name">{difficultyLabel(difficulty)}</span>
              </div>
              <p className="tier-desc">
                {isPyramid
                  ? pickWinnable
                    ? pyramid
                    : 'Random deal: it may not be winnable.'
                  : `${klondike} ${pickWinnable ? 'Checked winnable.' : 'It may not be winnable.'}`}
              </p>
            </label>
          ))}
        </div>
      </div>

      {/* Winnable-only dealing */}
      <label className="winnable-toggle">
        <input type="checkbox" checked={winnableOnly} onChange={onToggleWinnableOnly} />
        <span>
          <strong>Winnable deals only</strong>
          <span className="winnable-toggle-hint">
            Off, deals are shuffled at random like a real deck, so some can't be won. On, the solver finds a
            winning line for each new deal first; Pyramid deals are also sorted into tiers by how long their best
            line is. Seeds you type are always dealt as-is.
          </span>
        </span>
      </label>

      {/* Custom Seed Input */}
      <div className="custom-seed-section">
        <h4 id="seed-input-heading">Seed</h4>
        <div className="seed-input-row">
          <div className="input-prefix-wrapper">
            <Hash size={16} className="input-icon" />
            <input
              type="text"
              className="seed-input"
              aria-labelledby="seed-input-heading"
              value={inputSeed}
              placeholder="Enter any seed (e.g. EUTERPE-99)"
              onChange={(e) => {
                setInputSeed(e.target.value.toUpperCase());
                setSeedIsGenerated(false);
                setSeedTyped(true);
              }}
            />
          </div>

          <button className="subtle-btn" onClick={handleGenerateNew} title="Generate random seed for tier">
            Randomize
          </button>
          <button className="subtle-btn" onClick={handleCopySeed} title="Copy seed code">
            <Copy size={15} /> {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Modal Action Buttons */}
      <div className="modal-actions-row">
        <button
          className="primary-action-btn"
          onClick={() => handleApply(inputSeed, selectedDifficulty, seedIsGenerated)}
        >
          <Play size={16} /> Deal This Game
        </button>
        <button className="secondary-action-btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
};
