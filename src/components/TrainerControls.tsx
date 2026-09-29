import React from 'react';
import { Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight } from 'lucide-react';
import type { TrainerPlayback } from '../hooks/useTrainerPlayback';

const SPEEDS = [0.5, 1, 2, 4];

interface TrainerControlsProps {
  playback: TrainerPlayback;
  /** Move numbers to mark on the scrubber (slips), with a tooltip for each. */
  marks: { at: number; title: string }[];
}

/** The Trainer's scrubber and transport: back, step, play/pause, step, end, speed. */
export const TrainerControls: React.FC<TrainerControlsProps> = ({ playback, marks }) => {
  const { index, setIndex, isPlaying, setPlaying, speed, setSpeed, total } = playback;
  const jump = (at: number) => {
    setPlaying(false);
    setIndex(at);
  };
  return (
    <>
      <div className="slider-wrapper trainer-scrubber">
        <input
          type="range"
          min={0}
          max={total}
          value={index}
          onChange={(e) => jump(Number(e.target.value))}
          className="timeline-range-slider"
          aria-label="Move"
        />
        <div className="slider-tick-track">
          {marks.map(({ at, title }) => (
            <div
              key={at}
              className="slider-tick slip"
              style={{ left: `${total > 0 ? (at / total) * 100 : 0}%` }}
              onClick={() => jump(at)}
              title={title}
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
    </>
  );
};
