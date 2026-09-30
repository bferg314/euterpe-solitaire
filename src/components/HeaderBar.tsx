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
  Layers,
  Magnet,
  PlusCircle,
  GitFork,
  GraduationCap,
  BookOpen,
  ChevronDown,
} from 'lucide-react';
import { HeaderMenu, type HeaderMenuItem } from './HeaderMenu';
import { modeLabel, difficultyLabel } from '../utils/labels';

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
  onOpenTrainer?: () => void;
  onOpenStrategy?: () => void;
  /** The More menu opened or closed: board keys pause while it's open. */
  onMenuOpenChange: (open: boolean) => void;
}

const MODES: GameMode[] = ['klondike-1', 'klondike-3', 'pyramid'];

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
  onOpenTrainer,
  onOpenStrategy,
  onMenuOpenChange,
}) => {
  const formatTime = (secs: number): string => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  const isKlondike = gameMode === 'klondike-1' || gameMode === 'klondike-3';
  const showVacuum = Boolean(onToggleAmbientVacuum) && isKlondike;
  const trainerLabel =
    gameMode === 'pyramid'
      ? 'Trainer - Watch a bot win this deal at five skill levels'
      : "Trainer - Watch the bot's best line for this deal, and the slips to avoid";

  // Settings live in the More menu. The Learn buttons join them below 1160px, where they leave the header.
  const menuItems: HeaderMenuItem[] = [
    ...(onOpenTrainer
      ? [{ key: 'trainer', label: 'Trainer', icon: <GraduationCap size={16} />, onSelect: onOpenTrainer, narrowOnly: true }]
      : []),
    ...(onOpenStrategy
      ? [{ key: 'strategy', label: 'Strategy guide', icon: <BookOpen size={16} />, onSelect: onOpenStrategy, narrowOnly: true }]
      : []),
    { key: 'themes', label: 'Table themes', icon: <Palette size={16} />, onSelect: onOpenThemeModal },
    { key: 'decks', label: 'Card decks', icon: <Layers size={16} />, onSelect: onOpenDeckModal },
    {
      key: 'sound',
      label: 'Sound',
      icon: soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />,
      onSelect: onToggleSound,
      checked: soundEnabled,
    },
    ...(showVacuum && onToggleAmbientVacuum
      ? [
          {
            key: 'vacuum',
            label: 'Auto-move safe cards',
            icon: <Magnet size={16} />,
            onSelect: onToggleAmbientVacuum,
            checked: ambientVacuumEnabled,
          },
        ]
      : []),
  ];

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

        <nav className="mode-tabs" aria-label="Game">
          {MODES.map((mode) => (
            <button
              key={mode}
              className={`mode-tab ${gameMode === mode ? 'active' : ''}`}
              aria-pressed={gameMode === mode}
              aria-label={modeLabel(mode)}
              onClick={() => onSelectMode(mode)}
            >
              {mode === 'pyramid' ? (
                'Pyramid'
              ) : (
                <>
                  <span className="mode-tab-game">Klondike </span>
                  {mode === 'klondike-3' ? 'Turn 3' : 'Turn 1'}
                </>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Center: Live Status & Counters */}
      <div className="header-center">
        <button
          className="seed-display-pill"
          onClick={onOpenSeedModal}
          title="Deal options: seed, difficulty and the Daily Challenge"
          aria-label={`Deal options: seed ${seed}, ${difficultyLabel(difficulty)}`}
        >
          <Hash size={13} className="pill-icon" />
          <span className="seed-code">{seed}</span>
          <span className={`diff-badge ${difficulty}`}>
            {difficultyLabel(difficulty)}
            {difficulty === 'daily' ? ' ★' : ''}
          </span>
          <ChevronDown size={13} className="pill-caret" />
        </button>

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
                title={`${parExact ? 'Par for this deal' : 'Estimated Par'}: ${par} moves (${moves <= par ? `${par - moves} under Par` : `${moves - par} over Par`})${parExact ? '' : ". There's no guarantee this deal can be won."}`}
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
          <div className="counter-item counter-score" title="Score">
            <span className="counter-label">SCORE</span>
            <span className="counter-val">{score}</span>
          </div>
        </div>
      </div>

      {/* Right: Play, Learn and Settings groups */}
      <div className="header-right">
        {canAutoFinish && (
          <button
            className="action-btn auto-finish-glow"
            onClick={onAutoFinish}
            title="Auto-Finish remaining cards"
            aria-label="Auto Finish"
          >
            <Sparkles size={16} />
            <span className="action-label">Auto Finish</span>
          </button>
        )}

        <button className="action-btn new-game-btn" onClick={onNewGame} title="Deal New Game" aria-label="New Deal">
          <PlusCircle size={16} />
          <span className="action-label">New Deal</span>
        </button>

        <div className="btn-divider" />

        {/* Play */}
        <button
          className="icon-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo move (Ctrl+Z)"
          aria-label="Undo"
        >
          <RotateCcw size={16} />
        </button>

        <button
          className="icon-btn"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo move (Ctrl+Y)"
          aria-label="Redo"
        >
          <RotateCw size={16} />
        </button>

        <button className="icon-btn" onClick={onHint} title="Show Hint (H)" aria-label="Hint">
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
          aria-label="The Fork"
        >
          <GitFork size={16} />
          {branchCount > 0 && <span className="header-branch-badge">{branchCount}</span>}
        </button>

        {/* Learn: moves into the More menu below 1160px */}
        {(onOpenTrainer || onOpenStrategy) && <div className="btn-divider header-learn" />}

        {onOpenTrainer && (
          <button className="icon-btn header-learn" onClick={onOpenTrainer} title={trainerLabel} aria-label="Trainer">
            <GraduationCap size={16} />
          </button>
        )}

        {onOpenStrategy && (
          <button
            className="icon-btn header-learn"
            onClick={onOpenStrategy}
            title="Strategy Guide - How to win and not miss moves"
            aria-label="Strategy guide"
          >
            <BookOpen size={16} />
          </button>
        )}

        <div className="btn-divider" />

        {/* Settings (themes, decks, sound, auto-move) live in the More menu */}
        <button className="icon-btn" onClick={onOpenStatsModal} title="Statistics" aria-label="Statistics">
          <Trophy size={16} />
        </button>

        <button className="icon-btn" onClick={onOpenRulesModal} title="How to Play / Rules" aria-label="Rules">
          <HelpCircle size={16} />
        </button>

        <HeaderMenu items={menuItems} onOpenChange={onMenuOpenChange} />
      </div>
    </header>
  );
};
