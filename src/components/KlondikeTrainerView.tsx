import React, { useEffect, useMemo, useState } from 'react';
import { GraduationCap, X, AlertTriangle, Loader2, Lightbulb, Eye, Undo2, Shuffle } from 'lucide-react';
import type { DifficultyLevel, KlondikeState } from '../types/solitaire';
import type { LoadedDeck } from '../services/deckLoader';
import type { KlondikeLineResult } from '../engines/solvers/klondikeSolver';
import { applyKlondikeSolverMove, dealKlondike } from '../engines/klondikeEngine';
import {
  klondikeImperative,
  klondikeMoveCardIds,
  klondikePastTense,
  klondikePrinciple,
  type KlondikeSlip,
} from '../engines/trainer/klondikeTrainer';
import { buildKlondikeTrainerAsync, cancelTrainerWork, findWinnableDealAsync } from '../services/solverClient';
import { getCachedParInfo, getKnownKlondikeLine } from '../services/parService';
import { formatParDelta } from '../utils/efficiencyRating';
import { KlondikeBoard } from './KlondikeBoard';
import { TrainerControls } from './TrainerControls';
import { useTrainerPlayback } from '../hooks/useTrainerPlayback';

interface KlondikeTrainerViewProps {
  deck: LoadedDeck;
  seed: string;
  difficulty: DifficultyLevel;
  gameMode: 'klondike-1' | 'klondike-3';
  onClose: () => void;
}

const noop = () => {};

/**
 * The Klondike Trainer: the bot plays its best line, each move tagged with the rule of thumb
 * it follows, with tempting slips marked along the way. Any slip can be watched to its end.
 * If the bot finds no win, it plays its best attempt instead.
 */
export const KlondikeTrainerView: React.FC<KlondikeTrainerViewProps> = ({ deck, seed, difficulty, gameMode, onClose }) => {
  // The deal on show: the game's, or one found with "Find a winnable deal".
  const [dealSeed, setDealSeed] = useState(seed);
  const [searching, setSearching] = useState(false);
  const deal = useMemo(
    () => dealKlondike(deck, dealSeed, gameMode === 'klondike-3' ? 3 : 1, difficulty),
    [deck, dealSeed, gameMode, difficulty]
  );
  const [result, setResult] = useState<KlondikeLineResult | null>(null);
  const [slips, setSlips] = useState<KlondikeSlip[]>([]);
  const [slipsDone, setSlipsDone] = useState(false);
  // The slip being watched, or null for the bot's own line.
  const [watching, setWatching] = useState<KlondikeSlip | null>(null);
  const par = getCachedParInfo(gameMode, difficulty, dealSeed)?.par ?? 0;

  useEffect(() => {
    buildKlondikeTrainerAsync(deal, getKnownKlondikeLine(gameMode, difficulty, dealSeed), setResult, (slip) =>
      setSlips((prev) => [...prev, slip])
    ).then((done) => {
      if (done) setSlipsDone(true);
    });
    return cancelTrainerWork;
  }, [deal, gameMode, difficulty, dealSeed]);

  const won = result?.status === 'solved';
  const botLine = useMemo(() => (result ? (won ? result.moves : result.bestMoves) : []), [result, won]);
  const moves = useMemo(
    () => (watching ? [...botLine.slice(0, watching.at), watching.move, ...watching.finish] : botLine),
    [botLine, watching]
  );
  const states = useMemo(() => {
    const out: KlondikeState[] = [deal];
    for (const move of moves) out.push(applyKlondikeSolverMove(out[out.length - 1], move)!);
    return out;
  }, [deal, moves]);
  const total = moves.length;

  const playback = useTrainerPlayback(total, total > 0, onClose);
  const { index, setIndex, setPlaying } = playback;
  const at = Math.min(index, total);
  const current = states[at];
  const lastMove = at > 0 ? moves[at - 1] : undefined;
  const nextMove = moves[at];
  const principle = lastMove ? klondikePrinciple(states[at - 1], lastMove, moves.slice(at)) : null;
  const highlight = useMemo(() => klondikeMoveCardIds(current, nextMove), [current, nextMove]);
  // On the bot's line: a slip tempting at this point. While watching one: its lesson, once played.
  const slipHere = !watching ? slips.find((s) => s.at === at) : undefined;
  const lessonHere = watching && at === watching.at + 1 ? watching.lesson : null;
  const home = current.foundations.reduce((n, pile) => n + pile.length, 0);

  // "Find a winnable deal": the same search New Deal uses when winnable-only is on.
  const findWinnable = async () => {
    setSearching(true);
    const found = await findWinnableDealAsync(deck, gameMode, difficulty === 'daily' ? 'medium' : difficulty);
    setSearching(false);
    if (!found) return;
    setResult(null);
    setSlips([]);
    setSlipsDone(false);
    setWatching(null);
    setPlaying(false);
    setIndex(0);
    setDealSeed(found.seed);
  };

  const watch = (slip: KlondikeSlip | null) => {
    setWatching(slip);
    setPlaying(false);
    setIndex(slip ? slip.at : 0);
  };

  const modeName = gameMode === 'klondike-3' ? 'Klondike Turn 3' : 'Klondike Turn 1';
  const lineLabel = !result
    ? 'Solving…'
    : watching
    ? `Slip at move ${watching.at + 1} · +${watching.cost}`
    : won
    ? `Bot's line · ${total} moves`
    : `Best attempt · ${result.bestHome} of 52 home`;

  return (
    <div className="trainer-overlay trainer-klondike" role="dialog" aria-modal="true" aria-label="Solitaire Trainer">
      <header className="trainer-header">
        <div className="trainer-title">
          <GraduationCap size={20} className="gold-icon" />
          <div>
            <h3>Trainer</h3>
            <span className="trainer-subtitle">
              {modeName} · {dealSeed}
              {par > 0 && ` · ~Par ${par}`}
            </span>
          </div>
        </div>

        <div className="trainer-line-label">{lineLabel}</div>

        <button className="modal-close-btn" onClick={onClose} title="Close Trainer (Esc)">
          <X size={18} />
        </button>
      </header>

      <main className="trainer-table">
        {!result ? (
          <div className="trainer-message">
            <Loader2 size={28} className="spin gold-icon" />
            <p>Finding the bot's line…</p>
          </div>
        ) : (
          <KlondikeBoard
            state={current}
            deck={deck}
            hintCardId={null}
            highlightCardIds={highlight}
            interactive={false}
            keyboardEnabled={false}
            ambientVacuumEnabled={false}
            onStateChange={noop}
          />
        )}
      </main>

      {result && (
        <footer className="trainer-dock">
          <div className="trainer-narration" aria-live="polite">
            {!won && (
              <div className="trainer-lesson">
                <AlertTriangle size={14} />
                <span>
                  {result.status === 'unsolvable'
                    ? 'The bot found no way to win this deal with the moves it considers.'
                    : "The bot didn't find a win in its search, so this deal may still be winnable."}
                  {result.bestHome > 0 ? " Here's how far it got." : " It couldn't get a single card home."}
                </span>
                <button className="subtle-btn trainer-watch-btn" onClick={findWinnable} disabled={searching}>
                  <Shuffle size={14} /> {searching ? 'Looking…' : 'Find a winnable deal'}
                </button>
              </div>
            )}
            <div className="trainer-progress-line">
              <span>
                Move <strong>{at}</strong> of {total}
                {!won && ` · ${home} of 52 home`}
              </span>
              {won && par > 0 && (
                <span className="trainer-rating">
                  {formatParDelta(total - par)} vs ~Par {par}
                </span>
              )}
            </div>
            <p className="trainer-last-move">
              {lastMove ? `${klondikePastTense(states[at - 1], lastMove)}.` : 'The deal. Press play to watch.'}
            </p>
            {principle && !lessonHere && <p className="trainer-principle">{principle}</p>}
            {lessonHere && (
              <div className="trainer-lesson">
                <AlertTriangle size={14} />
                <span>
                  <strong>Slip:</strong> {lessonHere}
                </span>
              </div>
            )}
            {slipHere && (
              <div className="trainer-tempting">
                <Lightbulb size={14} />
                <span>
                  <strong>Tempting here:</strong> {klondikeImperative(current, slipHere.move)}. The bot's best finish after that
                  takes {slipHere.cost} more moves.{slipHere.rule && ` ${slipHere.rule}`}
                </span>
                <button className="subtle-btn trainer-watch-btn" onClick={() => watch(slipHere)}>
                  <Eye size={14} /> Watch it
                </button>
              </div>
            )}
            {watching && (
              <button className="subtle-btn trainer-watch-btn" onClick={() => watch(null)}>
                <Undo2 size={14} /> Back to the bot's line
              </button>
            )}
            {nextMove && <p className="trainer-next-move">Next: {klondikeImperative(current, nextMove)}</p>}
            {at >= total && won && <p className="trainer-next-move">Won in {total} moves.</p>}
          </div>

          <TrainerControls
            playback={playback}
            marks={
              watching
                ? [{ at: watching.at + 1, title: `The slip, at move ${watching.at + 1}` }]
                : slips.map((s) => ({ at: s.at, title: `Tempting slip before move ${s.at + 1} (+${s.cost})` }))
            }
          />

          <p className="trainer-footnote">
            The bot knows where every card is, so it plays better than anyone could by sight; its line isn't proven shortest.
            {won && !slipsDone && ' Still looking for slips to learn from.'}
          </p>
        </footer>
      )}
    </div>
  );
};
