import React, { useState } from 'react';
import type { DifficultyLevel } from '../types/solitaire';
import {
  getDailyChallengeSeed,
  createSeedForDifficulty,
  generateRandomSeed,
} from '../services/rngService';
import { Hash, Sparkles, Copy, Play, X, Calendar, ShieldCheck, Flame, Compass } from 'lucide-react';

interface SeedModalProps {
  currentSeed: string;
  currentDifficulty: DifficultyLevel;
  onApplySeedAndDifficulty: (seed: string, difficulty: DifficultyLevel) => void;
  onClose: () => void;
}

export const SeedModal: React.FC<SeedModalProps> = ({
  currentSeed,
  currentDifficulty,
  onApplySeedAndDifficulty,
  onClose,
}) => {
  const [inputSeed, setInputSeed] = useState(currentSeed);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>(currentDifficulty);
  const [copied, setCopied] = useState(false);

  const todayDailySeed = getDailyChallengeSeed();

  const handleCopySeed = () => {
    navigator.clipboard.writeText(currentSeed);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = (seedToUse: string, diffToUse: DifficultyLevel) => {
    onApplySeedAndDifficulty(seedToUse.trim() || generateRandomSeed(), diffToUse);
    onClose();
  };

  const handleGenerateNew = () => {
    const newSeed = createSeedForDifficulty(selectedDifficulty);
    setInputSeed(newSeed);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card seed-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-title">
            <Hash size={20} className="gold-icon" />
            <h3>Seeded Deals & Challenge Levels</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Daily Challenge Hero Banner */}
        <div className="daily-challenge-hero">
          <div className="hero-text">
            <div className="hero-tag">
              <Calendar size={14} /> TODAY'S DAILY CHALLENGE
            </div>
            <h4>{todayDailySeed}</h4>
            <p>Every player around the world receives this exact verified solvable deal today.</p>
          </div>
          <button
            className="daily-play-btn"
            onClick={() => handleApply(todayDailySeed, 'daily')}
          >
            <Sparkles size={16} /> Play Daily
          </button>
        </div>

        {/* Challenge Level Selector */}
        <div className="challenge-tiers-section">
          <h4>Select Challenge Tier</h4>
          <div className="tiers-grid">
            <div
              className={`tier-card ${selectedDifficulty === 'easy' ? 'selected' : ''}`}
              onClick={() => {
                setSelectedDifficulty('easy');
                setInputSeed(createSeedForDifficulty('easy'));
              }}
            >
              <div className="tier-header">
                <ShieldCheck size={18} className="tier-icon easy" />
                <span className="tier-name">Relaxed</span>
              </div>
              <p className="tier-desc">High initial mobility, accessible Aces, smooth forward momentum.</p>
            </div>

            <div
              className={`tier-card ${selectedDifficulty === 'medium' ? 'selected' : ''}`}
              onClick={() => {
                setSelectedDifficulty('medium');
                setInputSeed(createSeedForDifficulty('medium'));
              }}
            >
              <div className="tier-header">
                <Compass size={18} className="tier-icon medium" />
                <span className="tier-name">Standard</span>
              </div>
              <p className="tier-desc">Classic tournament random distribution requiring keen observation.</p>
            </div>

            <div
              className={`tier-card ${selectedDifficulty === 'hard' ? 'selected' : ''}`}
              onClick={() => {
                setSelectedDifficulty('hard');
                setInputSeed(createSeedForDifficulty('hard'));
              }}
            >
              <div className="tier-header">
                <Flame size={18} className="tier-icon hard" />
                <span className="tier-name">Master</span>
              </div>
              <p className="tier-desc">Constrained initial plays; buried Aces demand multi-turn planning.</p>
            </div>
          </div>
        </div>

        {/* Custom Seed Input */}
        <div className="custom-seed-section">
          <h4>Custom Seed Code</h4>
          <div className="seed-input-row">
            <div className="input-prefix-wrapper">
              <Hash size={16} className="input-icon" />
              <input
                type="text"
                className="seed-input"
                value={inputSeed}
                placeholder="Enter any seed (e.g. EUTERPE-99)"
                onChange={(e) => setInputSeed(e.target.value.toUpperCase())}
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
            onClick={() => handleApply(inputSeed, selectedDifficulty)}
          >
            <Play size={16} /> Deal This Game
          </button>
          <button className="secondary-action-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
