import React, { useRef, useState } from 'react';
import type { GameMode, DifficultyLevel, MatchHistoryEntry } from '../types/solitaire';
import {
  getStats,
  getMatchHistory,
  getDailyWins,
  resetAllStats,
  exportStatsJson,
  checkStatsBackup,
  importStatsJson,
  ratedWins,
} from '../services/statsService';
import { Trophy, Flame, Clock, CheckCircle2, RotateCcw, Download, Upload, Trash2, Award } from 'lucide-react';
import { EfficiencyBadge } from './EfficiencyBadge';
import { Modal } from './Modal';
import { modeLabel, difficultyLabel } from '../utils/labels';

interface StatsModalProps {
  currentMode: GameMode;
  currentDifficulty: DifficultyLevel;
  onReplaySeed: (mode: GameMode, difficulty: DifficultyLevel, seed: string) => void;
  onClose: () => void;
}

const MODES: GameMode[] = ['klondike-1', 'klondike-3', 'pyramid'];
const DIFFICULTIES: DifficultyLevel[] = ['easy', 'medium', 'hard', 'daily'];
const HISTORY_ROWS = 15;

/** An import or reset waiting for the player to confirm it in the footer. */
type PendingAction = { kind: 'import'; content: string; matches: number } | { kind: 'reset' };

const formatTime = (secs: number | null): string => {
  if (secs === null) return '--:--';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 'es'}`;

export const StatsModal: React.FC<StatsModalProps> = ({ currentMode, currentDifficulty, onReplaySeed, onClose }) => {
  const [selectedMode, setSelectedMode] = useState<GameMode>(currentMode);
  const [selectedDiff, setSelectedDiff] = useState<DifficultyLevel>(currentDifficulty);
  const [history, setHistory] = useState<MatchHistoryEntry[]>(getMatchHistory());
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stats = getStats(selectedMode, selectedDiff);
  const dailyWins = getDailyWins();
  const rated = ratedWins(stats);
  const filteredHistory = history.filter((e) => e.gameMode === selectedMode && e.difficulty === selectedDiff);

  const winRate = stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;
  const avgTime = stats.gamesWon > 0 ? Math.round(stats.totalTimeSeconds / stats.gamesWon) : null;
  const tiers = [
    ['Ace', stats.acesCount],
    ['Eagle', stats.eaglesCount],
    ['Birdie', stats.birdiesCount],
    ['Par', stats.parsCount],
    ['Bogey', stats.bogeysCount],
  ] as const;

  const handleExport = () => {
    const json = exportStatsJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `euterpe-solitaire-stats-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear the picker so choosing the same file again still fires a change.
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const check = checkStatsBackup(content);
      if (check.ok) {
        setNotice(null);
        setPending({ kind: 'import', content, matches: check.matches });
      } else {
        setPending(null);
        setNotice({ tone: 'error', text: "That file isn't a Euterpe stats backup. Nothing was changed." });
      }
    };
    reader.readAsText(file);
  };

  const confirmPending = () => {
    if (!pending) return;
    if (pending.kind === 'import') {
      const result = importStatsJson(pending.content);
      setNotice(
        result.ok
          ? { tone: 'ok', text: `Restored your stats and ${plural(result.matches, 'match')}.` }
          : { tone: 'error', text: "That file isn't a Euterpe stats backup. Nothing was changed." }
      );
    } else {
      resetAllStats();
      setNotice({ tone: 'ok', text: 'All stats and match history deleted.' });
    }
    setHistory(getMatchHistory());
    setPending(null);
  };

  return (
    <Modal
      title="Statistics & Records"
      icon={<Trophy size={20} className="gold-icon" />}
      className="stats-modal-card"
      onClose={onClose}
    >
      <div className="stats-scroll">
        {/* Mode & Difficulty filters: they apply to the tiles and the match history */}
        <div className="stats-filter-bar">
          <div className="segmented-group" role="group" aria-label="Game">
            {MODES.map((mode) => (
              <button
                key={mode}
                className={`segment-btn ${selectedMode === mode ? 'active' : ''}`}
                aria-pressed={selectedMode === mode}
                onClick={() => setSelectedMode(mode)}
              >
                {modeLabel(mode)}
              </button>
            ))}
          </div>

          <div className="segmented-group" role="group" aria-label="Difficulty">
            {DIFFICULTIES.map((diff) => (
              <button
                key={diff}
                className={`segment-btn small ${selectedDiff === diff ? 'active' : ''}`}
                aria-pressed={selectedDiff === diff}
                onClick={() => setSelectedDiff(diff)}
              >
                {difficultyLabel(diff)}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Metrics Grid */}
        <div className="stats-dashboard-grid">
          <div className="stat-card">
            <span className="stat-label">WIN RATE</span>
            <span className="stat-number">{stats.gamesPlayed > 0 ? `${winRate}%` : '--'}</span>
            <span className="stat-subtext">
              {stats.gamesWon} won / {stats.gamesPlayed} played
            </span>
          </div>

          <div className="stat-card">
            <span className="stat-label">PAR EFFICIENCY</span>
            <span className="stat-number">
              {rated > 0 && stats.averageEfficiency !== undefined ? `${stats.averageEfficiency}%` : '--'}
            </span>
            <span className="stat-subtext">
              {rated > 0 ? `Over ${rated} rated ${rated === 1 ? 'win' : 'wins'}` : 'No rated wins yet'}
            </span>
          </div>

          <div className="stat-card">
            <span className="stat-label">WIN STREAK</span>
            <span className="stat-number">
              <Flame size={20} className="flame-icon" /> {stats.currentStreak}
            </span>
            <span className="stat-subtext">Longest: {stats.longestStreak}</span>
          </div>

          <div className="stat-card">
            <span className="stat-label">BEST TIME</span>
            <span className="stat-number">
              <Clock size={18} /> {formatTime(stats.bestTimeSeconds)}
            </span>
            <span className="stat-subtext">Avg: {formatTime(avgTime)}</span>
          </div>

          <div className="stat-card">
            <span className="stat-label">FEWEST MOVES</span>
            <span className="stat-number">
              <CheckCircle2 size={18} /> {stats.fewestMoves ?? '--'}
            </span>
            <span className="stat-subtext">High Score: {stats.highScore}</span>
          </div>
        </div>

        {/* Rating tiers of rated wins */}
        <div className="tier-chips" aria-label="Wins by rating">
          {tiers.map(([name, count]) => (
            <span key={name} className={`tier-chip ${count ? '' : 'empty'}`}>
              {name} <strong>{count || 0}</strong>
            </span>
          ))}
        </div>

        {/* Daily Challenges Badge */}
        {dailyWins.length > 0 && (
          <div className="daily-wins-callout">
            <Award size={18} className="crown-icon" />
            <span>
              <strong>{dailyWins.length}</strong> Daily Challenge trophies earned!
            </span>
          </div>
        )}

        {/* Recent Match History for the selected game and difficulty */}
        <div className="history-section">
          <h4>Recent Matches</h4>
          {filteredHistory.length === 0 ? (
            <div className="empty-history-text">
              {history.length === 0
                ? 'No matches recorded yet. Play a game to see your history!'
                : `No ${modeLabel(selectedMode)} ${difficultyLabel(selectedDiff)} matches yet.`}
            </div>
          ) : (
            <div className="history-table-container">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Result</th>
                    <th>Rating</th>
                    <th>Moves</th>
                    <th>Time</th>
                    <th>Seed</th>
                    <th>
                      <span className="sr-only">Replay</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.slice(0, HISTORY_ROWS).map((entry) => (
                    <tr key={entry.id}>
                      <td>{new Date(entry.timestamp).toLocaleDateString()}</td>
                      <td>
                        <span className={`result-tag ${entry.won ? 'won' : 'lost'}`}>
                          {entry.won ? 'Won' : 'Abandoned'}
                        </span>
                      </td>
                      <td>
                        {entry.won && entry.par ? (
                          <EfficiencyBadge
                            actualMoves={entry.moves}
                            par={entry.par}
                            ace={entry.ace}
                            mode={entry.gameMode}
                            compact={true}
                          />
                        ) : (
                          <span className="par-na">--</span>
                        )}
                      </td>
                      <td data-label="Moves">{entry.moves}</td>
                      <td data-label="Time">{formatTime(entry.timeSeconds)}</td>
                      <td className="seed-cell" data-label="Seed">
                        {entry.seed}
                      </td>
                      <td className="replay-cell">
                        <button
                          className="replay-btn"
                          aria-label={`Replay ${entry.seed}`}
                          onClick={() => {
                            onReplaySeed(entry.gameMode, entry.difficulty, entry.seed);
                            onClose();
                          }}
                        >
                          <RotateCcw size={13} /> Replay
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Backup & Reset: pinned below the scrolling content */}
      <div className="stats-footer">
        {notice && (
          <div className={`stats-notice ${notice.tone}`} role="status">
            {notice.text}
          </div>
        )}
        {pending ? (
          <div className="stats-confirm-row" role="alertdialog" aria-label="Confirm">
            <span>
              {pending.kind === 'import'
                ? `Replace your stats and history with this backup (${plural(pending.matches, 'match')})? This can't be undone.`
                : "Delete all stats, match history and Daily trophies? This can't be undone."}
            </span>
            <div className="stats-confirm-actions">
              <button className="subtle-btn" onClick={() => setPending(null)} autoFocus>
                Cancel
              </button>
              <button className="danger-btn" onClick={confirmPending}>
                {pending.kind === 'import' ? 'Replace' : 'Delete'}
              </button>
            </div>
          </div>
        ) : (
          <div className="modal-footer-toolbar">
            <div className="toolbar-left">
              <button className="subtle-btn" onClick={handleExport}>
                <Download size={14} /> Export Backup
              </button>
              <button className="subtle-btn" onClick={() => fileInputRef.current?.click()}>
                <Upload size={14} /> Import Backup
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportFile}
                hidden
              />
            </div>
            <button
              className="danger-btn"
              onClick={() => {
                setNotice(null);
                setPending({ kind: 'reset' });
              }}
            >
              <Trash2 size={14} /> Reset Data
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};
