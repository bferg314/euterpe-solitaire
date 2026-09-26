import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GraduationCap,
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Shuffle,
} from 'lucide-react';
import type { DifficultyLevel, PyramidState } from '../types/solitaire';
import type { LoadedDeck } from '../services/deckLoader';
import type { PyramidCardRef, PyramidSolverMove } from '../engines/solvers/types';
import { applyPyramidMove, dealPyramid, resolvePyramidCard } from '../engines/pyramidEngine';
import {
  imperative,
  pastTense,
  TRAINER_TIERS,
  TRAINER_TIER_LABELS,
  type TierLine,
  type TrainerTier,
} from '../engines/trainer/lineBuilder';
import { buildTierLinesAsync, cancelTrainerWork, findWinnableDealAsync } from '../services/solverClient';
import { calculateEfficiency, formatParDelta } from '../utils/efficiencyRating';
import { PyramidBoard } from './PyramidBoard';

interface TrainerViewProps {
  deck: LoadedDeck;
  seed: string;
  difficulty: DifficultyLevel;
  initialTier?: TrainerTier;
  onClose: () => void;
}

type TrainerStatus = 'loading' | 'ready' | 'unwinnable' | 'searching';

const SPEEDS = [0.5, 1, 2, 4];
const BASE_STEP_MS = 1100;

const noop = () => {};

function cardIdsFor(state: PyramidState, move: PyramidSolverMove | undefined): string[] {
  if (!move) return [];
  const ids = (refs: PyramidCardRef[]) =>
    refs.map((ref) => resolvePyramidCard(state, ref)?.id).filter((id): id is string => Boolean(id));
  if (move.type === 'king') return ids([move.card]);
  if (move.type === 'pair') return ids([move.a, move.b]);
  return [];
}

/** A line that lands in its tier's move range; otherwise the deal has no line for that tier. */
const reachesTier = (line: TierLine) => line.steps.length >= line.min && line.steps.length <= line.max;

export const TrainerView: React.FC<TrainerViewProps> = ({ deck, seed, difficulty, initialTier = 'ace', onClose }) => {
  const [session, setSession] = useState(() => ({ seed, deal: dealPyramid(deck, seed, difficulty) }));
  const { deal, seed: dealSeed } = session;
  const [status, setStatus] = useState<TrainerStatus>('loading');
  const [lines, setLines] = useState<Partial<Record<TrainerTier, TierLine>>>({});
  const [ace, setAce] = useState(0);
  const [par, setPar] = useState(0);
  const [allBuilt, setAllBuilt] = useState(false);
  const [tier, setTier] = useState<TrainerTier>(initialTier);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const sessionRef = useRef(0);

  // Builds a deal's five lines in the worker; they arrive one by one, Ace first. Lines from
  // an older session (a previous deal) are ignored.
  const buildLines = useCallback((state: PyramidState, forSeed: string) => {
    const token = ++sessionRef.current;
    return buildTierLinesAsync(state, forSeed, (line, lineAce, linePar) => {
      if (sessionRef.current !== token) return;
      setAce(lineAce);
      setPar(linePar);
      setLines((prev) => ({ ...prev, [line.tier]: line }));
      setStatus('ready');
    }).then((summary) => {
      if (!summary || sessionRef.current !== token) return null;
      setAllBuilt(true);
      return summary;
    });
  }, []);

  // Switches to a new deal (from "Find a winnable deal").
  const startSession = (forSeed: string) => {
    const state = dealPyramid(deck, forSeed, difficulty);
    setSession({ seed: forSeed, deal: state });
    setLines({});
    setAllBuilt(false);
    setIndex(0);
    setPlaying(false);
    setAce(0);
    setPar(0);
    return buildLines(state, forSeed);
  };

  useEffect(() => {
    buildLines(dealPyramid(deck, seed, difficulty), seed).then((summary) => {
      if (summary && summary.status !== 'solved') setStatus('unwinnable');
    });
    return cancelTrainerWork;
  }, [buildLines, deck, seed, difficulty]);

  // "Find a winnable deal": the same search New Deal uses.
  const findWinnableDeal = async () => {
    setStatus('searching');
    const found = await findWinnableDealAsync(deck, difficulty === 'daily' ? 'medium' : difficulty);
    if (found) startSession(found.seed);
    else setStatus('unwinnable');
  };

  // If the chosen level turns out to have no line on this deal, show Ace instead.
  const chosenLine = lines[tier];
  const shownTier: TrainerTier = chosenLine && !reachesTier(chosenLine) ? 'ace' : tier;
  const line = lines[shownTier];
  const steps = useMemo(() => line?.steps ?? [], [line]);
  const states = useMemo(() => {
    const out: PyramidState[] = [deal];
    for (const step of steps) out.push(applyPyramidMove(out[out.length - 1], step.move)!);
    return out;
  }, [deal, steps]);
  const total = steps.length;
  const current = states[Math.min(index, total)] ?? deal;
  const lastStep = index > 0 ? steps[index - 1] : undefined;
  const nextStep = steps[index];
  const highlight = useMemo(() => cardIdsFor(current, nextStep?.move), [current, nextStep]);
  const slips = useMemo(() => steps.map((s, i) => (s.lesson ? i + 1 : -1)).filter((i) => i > 0), [steps]);

  // Autoplay: one move per tick. Reaching the end simply stops it.
  const isPlaying = playing && index < total && Boolean(line);
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setTimeout(() => setIndex((i) => Math.min(total, i + 1)), BASE_STEP_MS / speed);
    return () => clearTimeout(timer);
  }, [isPlaying, index, total, speed]);

  const selectTier = useCallback(
    (next: TrainerTier) => {
      const target = lines[next];
      if (!target || !reachesTier(target)) return;
      setTier(next);
      setIndex(0);
      setPlaying(false);
    },
    [lines]
  );

  // Trainer keys win over the game's while it's open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tierKey = Number(e.key);
      let handled = true;
      if (e.key === 'Escape') onClose();
      else if (e.key === ' ') setPlaying(index < total && !isPlaying);
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(total, i + 1));
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
      else if (e.key === 'Home') setIndex(0);
      else if (e.key === 'End') setIndex(total);
      else if (tierKey >= 1 && tierKey <= TRAINER_TIERS.length) selectTier(TRAINER_TIERS[tierKey - 1]);
      else handled = false;
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [index, total, isPlaying, onClose, selectTier]);

  const rating = line && par > 0 ? calculateEfficiency(total, par, ace, 'pyramid') : null;

  return (
    <div className="trainer-overlay" role="dialog" aria-modal="true" aria-label="Solitaire Trainer">
      <header className="trainer-header">
        <div className="trainer-title">
          <GraduationCap size={20} className="gold-icon" />
          <div>
            <h3>Trainer</h3>
            <span className="trainer-subtitle">
              Pyramid · {dealSeed}
              {par > 0 && ` · Par ${par}`}
            </span>
          </div>
        </div>

        <div className="trainer-tier-chips" role="tablist" aria-label="Bot skill level">
          {TRAINER_TIERS.map((t, i) => {
            const tierLine = lines[t];
            const reachable = tierLine ? reachesTier(tierLine) : false;
            const label = TRAINER_TIER_LABELS[t];
            const title = !tierLine
              ? `${label}: preparing…`
              : reachable
              ? `${label} bot: ${tierLine.steps.length} moves (key ${i + 1})`
              : `No ${label} line on this deal: its slips cost too few or too many moves to land exactly there`;
            return (
              <button
                key={t}
                role="tab"
                aria-selected={shownTier === t}
                className={`trainer-tier-chip tier-${t} ${shownTier === t ? 'active' : ''}`}
                disabled={!reachable}
                onClick={() => selectTier(t)}
                title={title}
              >
                <span className="chip-tier-name">{label}</span>
                <span className="chip-tier-moves">
                  {!tierLine ? <Loader2 size={12} className="spin" /> : reachable ? tierLine.steps.length : '—'}
                </span>
              </button>
            );
          })}
        </div>

        <button className="modal-close-btn" onClick={onClose} title="Close Trainer (Esc)">
          <X size={18} />
        </button>
      </header>

      <main className="trainer-table">
        {status === 'loading' || (status === 'ready' && !line) ? (
          <div className="trainer-message">
            <Loader2 size={28} className="spin gold-icon" />
            <p>{status === 'loading' ? 'Solving this deal…' : `Preparing the ${TRAINER_TIER_LABELS[shownTier]} line…`}</p>
          </div>
        ) : status === 'searching' ? (
          <div className="trainer-message">
            <Loader2 size={28} className="spin gold-icon" />
            <p>Looking for a winnable deal…</p>
          </div>
        ) : status === 'unwinnable' ? (
          <div className="trainer-message">
            <AlertTriangle size={28} className="gold-icon" />
            <p>This deal can't be won, so there's no line for the bot to show.</p>
            <button className="primary-action-btn" onClick={findWinnableDeal}>
              <Shuffle size={16} />
              <span>Find a winnable deal</span>
            </button>
          </div>
        ) : (
          <PyramidBoard
            state={current}
            deck={deck}
            hintCardId={null}
            highlightCardIds={highlight}
            interactive={false}
            keyboardEnabled={false}
            onStateChange={noop}
            onSelectionChange={noop}
          />
        )}
      </main>

      {status === 'ready' && line && (
        <footer className="trainer-dock">
          <div className="trainer-narration" aria-live="polite">
            <div className="trainer-progress-line">
              <span>
                Move <strong>{index}</strong> of {total}
              </span>
              {rating && (
                <span className="trainer-rating" style={{ color: rating.accentColor }}>
                  {rating.emblem} {rating.label} line · {formatParDelta(rating.delta)} vs Par {par}
                </span>
              )}
            </div>
            <p className="trainer-last-move">
              {lastStep ? `${pastTense(states[index - 1], lastStep.move)}.` : 'The deal. Press play to watch.'}
            </p>
            {lastStep?.lesson && (
              <div className="trainer-lesson">
                <AlertTriangle size={14} />
                <span>
                  <strong>Slip:</strong> {lastStep.lesson}
                </span>
              </div>
            )}
            {nextStep && <p className="trainer-next-move">Next: {imperative(current, nextStep.move)}</p>}
            {index >= total && <p className="trainer-next-move">Won in {total} moves.</p>}
          </div>

          <div className="slider-wrapper trainer-scrubber">
            <input
              type="range"
              min={0}
              max={total}
              value={index}
              onChange={(e) => {
                setPlaying(false);
                setIndex(Number(e.target.value));
              }}
              className="timeline-range-slider"
              aria-label="Move"
            />
            <div className="slider-tick-track">
              {slips.map((at) => (
                <div
                  key={at}
                  className="slider-tick slip"
                  style={{ left: `${total > 0 ? (at / total) * 100 : 0}%` }}
                  onClick={() => {
                    setPlaying(false);
                    setIndex(at);
                  }}
                  title={`Slip at move ${at}`}
                />
              ))}
            </div>
          </div>

          <div className="trainer-transport">
            <button className="timeline-nav-btn" onClick={() => setIndex(0)} disabled={index === 0} title="Back to the deal (Home)">
              <SkipBack size={15} />
            </button>
            <button
              className="timeline-nav-btn"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              title="Previous move (←)"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="primary-action-btn trainer-play-btn"
              onClick={() => (index >= total ? (setIndex(0), setPlaying(true)) : setPlaying((p) => !p))}
              title="Play or pause (Space)"
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              <span>{isPlaying ? 'Pause' : index >= total ? 'Replay' : 'Play'}</span>
            </button>
            <button
              className="timeline-nav-btn"
              onClick={() => setIndex((i) => Math.min(total, i + 1))}
              disabled={index >= total}
              title="Next move (→)"
            >
              <ChevronRight size={16} />
            </button>
            <button className="timeline-nav-btn" onClick={() => setIndex(total)} disabled={index >= total} title="Jump to the end (End)">
              <SkipForward size={15} />
            </button>
            <div className="trainer-speed" role="group" aria-label="Playback speed">
              {SPEEDS.map((s) => (
                <button key={s} className={`trainer-speed-btn ${speed === s ? 'active' : ''}`} onClick={() => setSpeed(s)}>
                  {s}×
                </button>
              ))}
            </div>
          </div>

          <p className="trainer-footnote">
            The bot knows where every card is.{!allBuilt && ' Other skill levels are still being prepared.'}
          </p>
        </footer>
      )}
    </div>
  );
};
