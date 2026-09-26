import React from 'react';
import type { GameMode, DifficultyLevel } from '../types/solitaire';
import {
  RotateCcw,
  RotateCw,
  Lightbulb,
  Sparkles,
  Trophy,
  Palette,
  Volume2,
  VolumeX,
  HelpCircle,
  Hash,
  FolderOpen,
  PlusCircle,
  GitFork,
} from 'lucide-react';

interface HeaderBarProps {
  gameMode: GameMode;
  difficulty: DifficultyLevel;
  seed: string;
  moves: number;
  timeSeconds: number;
  score: number;
  par?: number;
  /** False when Par is a heuristic estimate (shown as ~N). */
  parExact?: boolean;
  /** The solver is still working out Par for this deal. */
  parPending?: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canAutoFinish: boolean;
  canFork?: boolean;
  branchCount?: number;
  isDeadlocked?: boolean;
  ambientVacuumEnabled?: boolean;
  soundEnabled: boolean;
  onSelectMode: (mode: GameMode) => void;
  onNewGame: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onHint: () => void;
  onAutoFinish: () => void;
  onOpenFork: () => void;
  onToggleAmbientVacuum?: () => void;
  onToggleSound: () => void;
  onOpenSeedModal: () => void;
  onOpenStatsModal: () => void;
  onOpenThemeModal: () => void;
  onOpenDeckModal: () => void;
  onOpenRulesModal: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  gameMode,
  difficulty,
  seed,
  moves,
  timeSeconds,
  score,
  par = 0,
  parExact = true,
  parPending = false,
  canUndo,
  canRedo,
  canAutoFinish,
  canFork = true,
  branchCount = 0,
  isDeadlocked = false,
  ambientVacuumEnabled = true,
  soundEnabled,
  onSelectMode,
  onNewGame,
  onUndo,
  onRedo,
  onHint,
  onAutoFinish,
  onOpenFork,
  onToggleAmbientVacuum,
  onToggleSound,
  onOpenSeedModal,
  onOpenStatsModal,
  onOpenThemeModal,
  onOpenDeckModal,
  onOpenRulesModal,
}) => {
  const formatTime = (secs: number): string => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  const getDifficultyBadge = (diff: DifficultyLevel) => {
    switch (diff) {
      case 'easy':
        return <span className="diff-badge easy">Easy</span>;
      case 'medium':
        return <span className="diff-badge medium">Medium</span>;
      case 'hard':
        return <span className="diff-badge hard">Hard</span>;
      case 'daily':
        return <span className="diff-badge daily">Daily ★</span>;
    }
  };

  return (
    <header className="solitaire-header">
      {/* Left: Brand & Mode Navigation */}
      <div className="header-left">
        <div className="header-brand">
          <div className="brand-crest">♠</div>
          <div className="brand-titles">
            <span className="brand-title">EUTERPE</span>
            <span className="brand-subtitle">Solitaire Parlor</span>
          </div>
        </div>

        <nav className="mode-tabs">
          <button
            className={`mode-tab ${gameMode === 'klondike-1' ? 'active' : ''}`}
            onClick={() => onSelectMode('klondike-1')}
          >
            Klondike (1)
          </button>
          <button
            className={`mode-tab ${gameMode === 'klondike-3' ? 'active' : ''}`}
            onClick={() => onSelectMode('klondike-3')}
          >
            Klondike (3)
          </button>
          <button
            className={`mode-tab ${gameMode === 'pyramid' ? 'active' : ''}`}
            onClick={() => onSelectMode('pyramid')}
          >
            Pyramid
          </button>
        </nav>
      </div>

      {/* Center: Live Status & Counters */}
      <div className="header-center">
        <div className="seed-display-pill" onClick={onOpenSeedModal} title="Click to view seed or pick challenge">
          <Hash size={13} className="pill-icon" />
          <span className="seed-code">{seed}</span>
          {getDifficultyBadge(difficulty)}
        </div>

        <div className="stats-counters">
          <div className="counter-item" title="Move count">
            <span className="counter-label">MOVES</span>
            <span className="counter-val">{moves}</span>
          </div>
          {parPending ? (
            <div className="counter-item par-item" title="Working out Par for this deal…">
              <span className="counter-label">PAR</span>
              <span className="counter-val">…</span>
            </div>
          ) : (
            par > 0 && (
              <div
                className={`counter-item par-item ${moves <= par ? 'under-par' : 'over-par'}`}
                title={`${parExact ? 'Par for this deal' : gameMode === 'pyramid' ? 'Estimated Par (no winning line found)' : 'Estimated Par'}: ${par} moves (${moves <= par ? `${par - moves} under Par` : `${moves - par} over Par`})`}
              >
                <span className="counter-label">PAR</span>
                <span className="counter-val">{parExact ? par : `~${par}`}</span>
              </div>
            )
          )}
          <div className="counter-item" title="Elapsed time">
            <span className="counter-label">TIME</span>
            <span className="counter-val">{formatTime(timeSeconds)}</span>
          </div>
          <div className="counter-item" title="Score">
            <span className="counter-label">SCORE</span>
            <span className="counter-val">{score}</span>
          </div>
        </div>
      </div>

      {/* Right: Actions and Dialog Triggers */}
      <div className="header-right">
        {canAutoFinish && (
          <button
            className="action-btn auto-finish-glow"
            onClick={onAutoFinish}
            title="Auto-Finish remaining cards"
          >
            <Sparkles size={16} />
            <span>Auto Finish</span>
          </button>
        )}

        <button className="action-btn new-game-btn" onClick={onNewGame} title="Deal New Game">
          <PlusCircle size={16} />
          <span>New Deal</span>
        </button>

        <div className="btn-divider" />

        <button
          className="icon-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo move (Ctrl+Z)"
        >
          <RotateCcw size={16} />
        </button>

        <button
          className="icon-btn"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo move (Ctrl+Y)"
        >
          <RotateCw size={16} />
        </button>

        <button className="icon-btn" onClick={onHint} title="Show Hint (H)">
          <Lightbulb size={16} />
        </button>

        <button
          className={`icon-btn btn-fork ${branchCount > 0 ? 'branch-active' : ''} ${isDeadlocked ? 'deadlock-glow' : ''}`}
          onClick={onOpenFork}
          disabled={!canFork}
          title={
            branchCount > 0
              ? `The Fork (Branch #${branchCount}) - Scrub timeline & branch`
              : 'The Fork - Scrub move timeline & branch off a new attempt'
          }
        >
          <GitFork size={16} />
          {branchCount > 0 && <span className="header-branch-badge">{branchCount}</span>}
        </button>

        {onToggleAmbientVacuum && (gameMode === 'klondike-1' || gameMode === 'klondike-3') && (
          <button
            className={`icon-btn btn-vacuum ${ambientVacuumEnabled ? 'vacuum-active' : ''}`}
            onClick={onToggleAmbientVacuum}
            title={
              ambientVacuumEnabled
                ? 'Safe-Play Foundation Vacuum: Enabled (Auto-sweeping safe cards)'
                : 'Safe-Play Foundation Vacuum: Disabled (Click to enable)'
            }
          >
            <Sparkles size={16} />
            {ambientVacuumEnabled && <span className="vacuum-indicator-dot" />}
          </button>
        )}

        <div className="btn-divider" />

        <button className="icon-btn" onClick={onOpenThemeModal} title="Table Themes">
          <Palette size={16} />
        </button>

        <button className="icon-btn" onClick={onOpenDeckModal} title="Open Playing Cards & Deck Manager">
          <FolderOpen size={16} />
        </button>

        <button className="icon-btn" onClick={onOpenStatsModal} title="View Statistics">
          <Trophy size={16} />
        </button>

        <button className="icon-btn" onClick={onToggleSound} title={soundEnabled ? 'Mute Sound' : 'Enable Sound'}>
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>

        <button className="icon-btn" onClick={onOpenRulesModal} title="How to Play / Rules">
          <HelpCircle size={16} />
        </button>
      </div>
    </header>
  );
};
