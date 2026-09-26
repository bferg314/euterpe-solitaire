import React from 'react';
import {
  GitFork,
  X,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Unlock,
  Crown,
  Landmark,
  Layers,
  Sparkles,
  ArrowRightLeft,
  RotateCcw,
} from 'lucide-react';
import type { TimelineStep, TimelineDecisionTag } from '../types/fork';
import { ScrollRow } from './ScrollRow';

interface ForkModalProps {
  isOpen: boolean;
  timeline: TimelineStep[];
  previewIndex: number;
  branchCount: number;
  onSelectPreviewIndex: (index: number) => void;
  onBranch: (stepIndex: number) => void;
  onClose: () => void;
}

export const ForkModal: React.FC<ForkModalProps> = ({
  isOpen,
  timeline,
  previewIndex,
  branchCount,
  onSelectPreviewIndex,
  onBranch,
  onClose,
}) => {
  if (!isOpen || timeline.length === 0) return null;

  const maxIndex = timeline.length - 1;
  const currentStep = timeline[previewIndex] || timeline[maxIndex];

  const getTagBadge = (tag: TimelineDecisionTag) => {
    switch (tag) {
      case 'reveal':
        return (
          <span className="step-tag-pill tag-reveal">
            <Unlock size={12} /> Card Uncovered
          </span>
        );
      case 'foundation':
        return (
          <span className="step-tag-pill tag-foundation">
            <Landmark size={12} /> Foundation
          </span>
        );
      case 'king':
        return (
          <span className="step-tag-pill tag-king">
            <Crown size={12} /> King Placed
          </span>
        );
      case 'match':
        return (
          <span className="step-tag-pill tag-match">
            <Sparkles size={12} /> Pair Matched
          </span>
        );
      case 'draw':
        return (
          <span className="step-tag-pill tag-draw">
            <Layers size={12} /> Stock Draw
          </span>
        );
      case 'recycle':
        return (
          <span className="step-tag-pill tag-recycle">
            <RotateCcw size={12} /> Stock Cycle
          </span>
        );
      case 'deal':
        return (
          <span className="step-tag-pill tag-deal">
            <span>♠</span> Initial Deal
          </span>
        );
      default:
        return (
          <span className="step-tag-pill tag-move">
            <ArrowRightLeft size={12} /> Move
          </span>
        );
    }
  };

  // Find key decision steps to populate quick jump bookmarks
  const keyDecisions = timeline.filter(
    (step) =>
      step.stepIndex === 0 ||
      step.tag === 'reveal' ||
      step.tag === 'king' ||
      step.tag === 'foundation' ||
      step.tag === 'match'
  );

  return (
    <div className="modal-backdrop fork-modal-backdrop" onClick={onClose}>
      <div className="modal-card fork-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-title">
            <GitFork size={20} className="gold-icon" />
            <div>
              <h3>The Fork</h3>
              <span className="modal-subtitle">Timeline Branching & Retrospective</span>
            </div>
          </div>
          <div className="fork-header-right">
            <span className="branch-counter-pill" title="Active Branch Iteration">
              Branch #{branchCount}
            </span>
            <button className="modal-close-btn" onClick={onClose} title="Close Timeline">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Timeline Slider Control */}
        <div className="timeline-slider-section">
          <div className="timeline-slider-header">
            <span className="timeline-move-indicator">
              MOVE <strong>{previewIndex}</strong> <span className="total-moves">/ {maxIndex}</span>
            </span>
            <span className="timeline-hint">Scrub backwards to pinpoint when moves diverged</span>
          </div>

          <div className="slider-wrapper">
            <input
              type="range"
              min={0}
              max={maxIndex}
              value={previewIndex}
              onChange={(e) => onSelectPreviewIndex(Number(e.target.value))}
              className="timeline-range-slider"
            />
            {/* Visual key markers */}
            <div className="slider-tick-track">
              {keyDecisions.map((kd) => {
                const pct = maxIndex > 0 ? (kd.stepIndex / maxIndex) * 100 : 0;
                return (
                  <div
                    key={kd.stepIndex}
                    className={`slider-tick ${kd.tag}`}
                    style={{ left: `${pct}%` }}
                    onClick={() => onSelectPreviewIndex(kd.stepIndex)}
                    title={`Jump to Step ${kd.stepIndex}: ${kd.description}`}
                  />
                );
              })}
            </div>
          </div>

          {/* Step Navigation Controls */}
          <div className="timeline-nav-buttons">
            <button
              className="timeline-nav-btn"
              onClick={() => onSelectPreviewIndex(0)}
              disabled={previewIndex === 0}
              title="Jump to Initial Deal (Move 0)"
            >
              <SkipBack size={15} />
              <span>Deal</span>
            </button>
            <button
              className="timeline-nav-btn"
              onClick={() => onSelectPreviewIndex(Math.max(0, previewIndex - 1))}
              disabled={previewIndex === 0}
              title="Previous Move"
            >
              <ChevronLeft size={16} />
              <span>Prev</span>
            </button>
            <button
              className="timeline-nav-btn"
              onClick={() => onSelectPreviewIndex(Math.min(maxIndex, previewIndex + 1))}
              disabled={previewIndex === maxIndex}
              title="Next Move"
            >
              <span>Next</span>
              <ChevronRight size={16} />
            </button>
            <button
              className="timeline-nav-btn"
              onClick={() => onSelectPreviewIndex(maxIndex)}
              disabled={previewIndex === maxIndex}
              title="Jump to Current Live Move"
            >
              <span>Present</span>
              <SkipForward size={15} />
            </button>
          </div>
        </div>

        {/* Quick Jump Bookmarks for Crucial Choices */}
        <div className="key-decision-chips-section">
          <span className="chips-label">KEY JUNCTURES:</span>
          <ScrollRow className="chips-scroll-row" ariaLabel="Key junctures" activeKey={previewIndex}>
            {keyDecisions.map((kd) => (
              <button
                key={kd.stepIndex}
                className={`key-decision-chip ${kd.stepIndex === previewIndex ? 'active' : ''}`}
                onClick={() => onSelectPreviewIndex(kd.stepIndex)}
                title={kd.description}
              >
                <span className="chip-step">#{kd.stepIndex}</span>
                <span className="chip-desc">{kd.tag.toUpperCase()}</span>
              </button>
            ))}
          </ScrollRow>
        </div>

        {/* Selected Step Card */}
        <div className="fork-step-card">
          <div className="step-card-header">
            <div className="step-info">
              <span className="step-num-badge">Move #{previewIndex}</span>
              {getTagBadge(currentStep.tag)}
            </div>
            <span className="step-time">
              {new Date(currentStep.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          <div className="step-description-text">{currentStep.description}</div>

          {currentStep.insight && (
            <div className="step-insight-callout">
              <Sparkles size={14} className="gold-icon" />
              <span>{currentStep.insight}</span>
            </div>
          )}
        </div>

        {/* Action Row */}
        <div className="fork-modal-actions">
          <div className="fork-live-status-note">
            The board is currently displaying the layout at <strong>Move {previewIndex}</strong>.
          </div>

          <div className="fork-actions-btns">
            <button className="secondary-action-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              className="primary-action-btn branch-confirm-btn"
              onClick={() => onBranch(previewIndex)}
              title={`Branch off a new attempt from Move ${previewIndex}`}
            >
              <GitFork size={16} />
              <span>
                {previewIndex === maxIndex ? 'Continue from Current' : `Branch From Move ${previewIndex}`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
