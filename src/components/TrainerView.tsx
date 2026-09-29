import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GraduationCap, X, AlertTriangle, Loader2, Shuffle } from 'lucide-react';
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
  type TrainerStep,
  type TrainerTier,
} from '../engines/trainer/lineBuilder';
import { buildTierLinesAsync, cancelTrainerWork, findWinnableDealAsync } from '../services/solverClient';
import { calculateEfficiency, formatParDelta } from '../utils/efficiencyRating';
import { PyramidBoard } from './PyramidBoard';
import { TrainerControls } from './TrainerControls';
import { useTrainerPlayback } from '../hooks/useTrainerPlayback';

interface TrainerViewProps {
  deck: LoadedDeck;
  seed: string;
  difficulty: DifficultyLevel;
  initialTier?: TrainerTier;
  onClose: () => void;
}

type TrainerStatus = 'loading' | 'ready' | 'unwinnable' | 'searching';

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
  // When the deal can't be won: the bot's best attempt, played instead of the levels.
  const [best, setBest] = useState<PyramidSolverMove[]>([]);
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
    setBest([]);
    setAllBuilt(false);
    setIndex(0);
    setPlaying(false);
    setAce(0);
    setPar(0);
    return buildLines(state, forSeed);
  };

  useEffect(() => {
    buildLines(dealPyramid(deck, seed, difficulty), seed).then((summary) => {
      if (summary && summary.status !== 'solved') {
        setBest(summary.best);
        setStatus('unwinnable');
      }
    });
    return cancelTrainerWork;
  }, [buildLines, deck, seed, difficulty]);

  // "Find a winnable deal": the same search New Deal uses.
  const findWinnableDeal = async () => {
    setStatus('searching');
    const found = await findWinnableDealAsync(deck, 'pyramid', difficulty === 'daily' ? 'medium' : difficulty);
    if (found) startSession(found.seed);
    else setStatus('unwinnable');
  };

  // If the chosen level turns out to have no line on this deal, show Ace instead.
  const chosenLine = lines[tier];
  const shownTier: TrainerTier = chosenLine && !reachesTier(chosenLine) ? 'ace' : tier;
  const line = lines[shownTier];
  const unwinnable = status === 'unwinnable';
  const steps = useMemo(() => (unwinnable ? best.map((move): TrainerStep => ({ move })) : line?.steps ?? []), [unwinnable, best, line]);
  const states = useMemo(() => {
    const out: PyramidState[] = [deal];
    for (const step of steps) out.push(applyPyramidMove(out[out.length - 1], step.move)!);
    return out;
  }, [deal, steps]);
  const total = steps.length;
  const playback = useTrainerPlayback(total, Boolean(line) || unwinnable, onClose);
  const { index, setIndex, setPlaying } = playback;
  const current = states[Math.min(index, total)] ?? deal;
  const lastStep = index > 0 ? steps[index - 1] : undefined;
  const nextStep = steps[index];
  const highlight = useMemo(() => cardIdsFor(current, nextStep?.move), [current, nextStep]);
  const slips = useMemo(() => steps.map((s, i) => (s.lesson ? i + 1 : -1)).filter((i) => i > 0), [steps]);

  const selectTier = useCallback(
    (next: TrainerTier) => {
      const target = lines[next];
      if (!target || !reachesTier(target)) return;
      setTier(next);
      setIndex(0);
      setPlaying(false);
    },
    [lines, setIndex, setPlaying]
  );

  // Keys 1–5 pick a bot level (the other Trainer keys are shared).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const n = Number(e.key);
      if (!(n >= 1 && n <= TRAINER_TIERS.length)) return;
      selectTier(TRAINER_TIERS[n - 1]);
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [selectTier]);

  const rating = line && !unwinnable && par > 0 ? calculateEfficiency(total, par, ace, 'pyramid') : null;
  const cleared = current.pyramid.flat().filter((c) => !c).length;
  const showsBest = unwinnable && best.length > 0;

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

        {unwinnable ? (
          <div className="trainer-line-label">Best attempt · {28 - states[states.length - 1].pyramid.flat().filter(Boolean).length} of 28 cleared</div>
        ) : (
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
        )}

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
        ) : unwinnable && !showsBest ? (
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

      {((status === 'ready' && line) || showsBest) && (
        <footer className="trainer-dock">
          <div className="trainer-narration" aria-live="polite">
            {showsBest && (
              <div className="trainer-lesson">
                <AlertTriangle size={14} />
                <span>This deal can't be won: no winning line exists. Here's how far the bot got.</span>
                <button className="subtle-btn trainer-watch-btn" onClick={findWinnableDeal}>
                  <Shuffle size={14} /> Find a winnable deal
                </button>
              </div>
            )}
            <div className="trainer-progress-line">
              <span>
                Move <strong>{index}</strong> of {total}
                {showsBest && ` · ${cleared} of 28 cleared`}
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
            {index >= total && !unwinnable && <p className="trainer-next-move">Won in {total} moves.</p>}
          </div>

          <TrainerControls playback={playback} marks={slips.map((at) => ({ at, title: `Slip at move ${at}` }))} />

          <p className="trainer-footnote">
            The bot knows where every card is.{!allBuilt && !unwinnable && ' Other skill levels are still being prepared.'}
          </p>
        </footer>
      )}
    </div>
  );
};
