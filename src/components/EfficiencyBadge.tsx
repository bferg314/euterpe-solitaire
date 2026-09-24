import React from 'react';
import { calculateEfficiency, formatParDelta } from '../utils/efficiencyRating';

interface EfficiencyBadgeProps {
  actualMoves: number;
  par: number;
  compact?: boolean;
  showDescription?: boolean;
  className?: string;
}

export const EfficiencyBadge: React.FC<EfficiencyBadgeProps> = ({
  actualMoves,
  par,
  compact = false,
  showDescription = false,
  className = '',
}) => {
  const result = calculateEfficiency(actualMoves, par);
  const formattedDelta = formatParDelta(result.delta);

  if (compact) {
    return (
      <span
        className={`efficiency-badge-compact ${result.tier} ${className}`}
        style={{
          borderColor: result.accentColor,
          boxShadow: `0 0 10px ${result.bgGlow}`,
        }}
        title={`${result.label} (${formattedDelta}) • ${result.efficiencyPct}% Efficiency`}
      >
        <span className="badge-emblem">{result.emblem}</span>
        <span className="badge-tier" style={{ color: result.accentColor }}>
          {result.label}
        </span>
        <span className="badge-delta">
          {formattedDelta}
        </span>
      </span>
    );
  }

  return (
    <div
      className={`efficiency-card ${result.tier} ${className}`}
      style={{
        borderColor: result.accentColor,
        background: `radial-gradient(ellipse at 50% 20%, ${result.bgGlow} 0%, rgba(10, 15, 12, 0.75) 80%)`,
        boxShadow: `0 8px 24px rgba(0,0,0,0.5), 0 0 20px ${result.bgGlow}`,
      }}
    >
      <div className="efficiency-card-header">
        <div
          className="efficiency-emblem-ring"
          style={{
            borderColor: result.accentColor,
            boxShadow: `0 0 16px ${result.bgGlow}`,
          }}
        >
          <span className="card-emblem-icon">{result.emblem}</span>
        </div>
        <div className="efficiency-title-block">
          <div className="efficiency-super-title">THEORETICAL PAR EFFICIENCY</div>
          <h3 className="efficiency-tier-name" style={{ color: result.accentColor }}>
            {result.label}
          </h3>
          <span className="efficiency-score-pill" style={{ color: result.accentColor }}>
            {formattedDelta} ({result.efficiencyPct}% Par Efficiency)
          </span>
        </div>
      </div>

      <div className="efficiency-metrics-grid">
        <div className="eff-metric-col">
          <span className="eff-label">PLAYER MOVES</span>
          <span className="eff-value">{actualMoves}</span>
        </div>
        <div className="eff-metric-col">
          <span className="eff-label">THEORETICAL PAR</span>
          <span className="eff-value">{par}</span>
        </div>
        <div className="eff-metric-col">
          <span className="eff-label">PAR DELTA</span>
          <span
            className="eff-value"
            style={{ color: result.delta <= 0 ? '#4ade80' : '#f87171' }}
          >
            {formattedDelta}
          </span>
        </div>
      </div>

      {showDescription && (
        <p className="efficiency-description">{result.description}</p>
      )}
    </div>
  );
};
