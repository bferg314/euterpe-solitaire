import React, { useState } from 'react';
import type { GameMode, DifficultyLevel, MatchHistoryEntry } from '../types/solitaire';
import {
  getStats,
  getMatchHistory,
  getDailyWins,
  resetAllStats,
  exportStatsJson,
  importStatsJson,
} from '../services/statsService';
import {
  Trophy,
  Flame,
  Clock,
  CheckCircle2,
  X,
  RotateCcw,
  Download,
  Upload,
  Trash2,
  Award,
} from 'lucide-react';
import { EfficiencyBadge } from './EfficiencyBadge';

interface StatsModalProps {
  currentMode: GameMode;
  onReplaySeed: (mode: GameMode, difficulty: DifficultyLevel, seed: string) => void;
  onClose: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({ currentMode, onReplaySeed, onClose }) => {
  const [selectedMode, setSelectedMode] = useState<GameMode>(currentMode);
  const [selectedDiff, setSelectedDiff] = useState<DifficultyLevel>('medium');
  const [history, setHistory] = useState<MatchHistoryEntry[]>(getMatchHistory());

  const stats = getStats(selectedMode, selectedDiff);
  const dailyWins = getDailyWins();

  const winRate =
    stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;
  const avgTime =
    stats.gamesWon > 0 ? Math.round(stats.totalTimeSeconds / stats.gamesWon) : 0;

  const formatTime = (secs: number | null): string => {
    if (secs === null) return '--:--';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

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

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (importStatsJson(content)) {
        alert('Statistics successfully restored!');
        setHistory(getMatchHistory());
      } else {
        alert('Failed to parse stats JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all solitaire statistics and history?')) {
      resetAllStats();
      setHistory([]);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card stats-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-title">
            <Trophy size={20} className="gold-icon" />
            <h3>Statistics & Records</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Mode & Difficulty Tabs */}
        <div className="stats-filter-bar">
          <div className="segmented-group">
            <button
              className={`segment-btn ${selectedMode === 'klondike-1' ? 'active' : ''}`}
              onClick={() => setSelectedMode('klondike-1')}
            >
              Klondike (1)
            </button>
            <button
              className={`segment-btn ${selectedMode === 'klondike-3' ? 'active' : ''}`}
              onClick={() => setSelectedMode('klondike-3')}
            >
              Klondike (3)
            </button>
            <button
              className={`segment-btn ${selectedMode === 'pyramid' ? 'active' : ''}`}
              onClick={() => setSelectedMode('pyramid')}
            >
              Pyramid
            </button>
          </div>

          <div className="segmented-group">
            {(['easy', 'medium', 'hard', 'daily'] as DifficultyLevel[]).map((diff) => (
              <button
                key={diff}
                className={`segment-btn small ${selectedDiff === diff ? 'active' : ''}`}
                onClick={() => setSelectedDiff(diff)}
              >
                {diff.charAt(0).toUpperCase() + diff.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Metrics Grid */}
        <div className="stats-dashboard-grid">
          <div className="stat-card">
            <span className="stat-label">WIN RATE</span>
            <span className="stat-number">{winRate}%</span>
            <span className="stat-subtext">
              {stats.gamesWon} won / {stats.gamesPlayed} played
            </span>
          </div>

          <div className="stat-card">
            <span className="stat-label">PAR EFFICIENCY</span>
            <span className="stat-number">
              {stats.averageEfficiency ? `${stats.averageEfficiency}%` : '100%'}
            </span>
            <span className="stat-subtext" title="Ace, Eagle, Birdie and Par solves">
              ♠ {stats.acesCount || 0} · 🦅 {stats.eaglesCount || 0} · 🐦 {stats.birdiesCount || 0} · ⛳ {stats.parsCount || 0}
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

        {/* Daily Challenges Badge */}
        {dailyWins.length > 0 && (
          <div className="daily-wins-callout">
            <Award size={18} className="crown-icon" />
            <span>
              <strong>{dailyWins.length}</strong> Daily Challenge trophies earned!
            </span>
          </div>
        )}

        {/* Recent Match History */}
        <div className="history-section">
          <h4>Recent Matches</h4>
          {history.length === 0 ? (
            <div className="empty-history-text">No matches recorded yet. Play a game to see your history!</div>
          ) : (
            <div className="history-table-container">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Mode</th>
                    <th>Tier</th>
                    <th>Result</th>
                    <th>Rating</th>
                    <th>Moves</th>
                    <th>Time</th>
                    <th>Seed</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 15).map((entry) => (
                    <tr key={entry.id}>
                      <td>{new Date(entry.timestamp).toLocaleDateString()}</td>
                      <td>{entry.gameMode}</td>
                      <td>
                        <span className={`diff-tag ${entry.difficulty}`}>{entry.difficulty}</span>
                      </td>
                      <td>
                        <span className={`result-tag ${entry.won ? 'won' : 'lost'}`}>
                          {entry.won ? 'Won' : 'Abandoned'}
                        </span>
                      </td>
                      <td>
                        {entry.won && entry.par ? (
                          <EfficiencyBadge actualMoves={entry.moves} par={entry.par} ace={entry.ace} compact={true} />
                        ) : (
                          <span className="par-na">--</span>
                        )}
                      </td>
                      <td>{entry.moves}</td>
                      <td>{formatTime(entry.timeSeconds)}</td>
                      <td className="seed-cell">{entry.seed}</td>
                      <td>
                        <button
                          className="replay-btn"
                          title="Replay this match"
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

        {/* Backup & Reset Toolbar */}
        <div className="modal-footer-toolbar">
          <div className="toolbar-left">
            <button className="subtle-btn" onClick={handleExport} title="Export statistics backup">
              <Download size={14} /> Export Backup
            </button>
            <label className="subtle-btn file-label" title="Import statistics backup">
              <Upload size={14} /> Import Backup
              <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
            </label>
          </div>
          <button className="danger-btn" onClick={handleReset} title="Reset all data">
            <Trash2 size={14} /> Reset Data
          </button>
        </div>
      </div>
    </div>
  );
};
