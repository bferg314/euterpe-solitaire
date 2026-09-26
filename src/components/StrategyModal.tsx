import React, { useState } from 'react';
import { BookOpen, X, CheckCircle2, ListChecks } from 'lucide-react';

export type StrategyTab = 'turn1' | 'turn3' | 'pyramid';

interface StrategyModalProps {
  initialTab?: StrategyTab;
  onClose: () => void;
}

const TABS: { id: StrategyTab; label: string }[] = [
  { id: 'turn1', label: 'Klondike (Turn 1)' },
  { id: 'turn3', label: 'Klondike (Turn 3)' },
  { id: 'pyramid', label: 'Pyramid' },
];

/** The scan to run before every move, so nothing playable gets missed. */
const Checklist: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
  <div className="strategy-checklist">
    <div className="strategy-checklist-title">
      <ListChecks size={16} /> Before every move, check:
    </div>
    <ol>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ol>
  </div>
);

const KlondikeCore: React.FC = () => (
  <>
    <h4>Uncover hidden cards first</h4>
    <ul>
      <li>
        Face-down cards are the whole game. A move that <strong>flips a card</strong> is almost always better than one
        that doesn't.
      </li>
      <li>
        Work on the <strong>tallest columns</strong> (the most face-down cards) early. They take the longest to dig out.
      </li>
      <li>
        With two cards that could take the same spot (say, two red 8s for a black 7), move the one that
        <strong> frees a face-down card</strong>, or sits on the column with more of them.
      </li>
    </ul>

    <h4>Play the tableau before the stock</h4>
    <ul>
      <li>
        Make every useful tableau move before drawing. The stock will still be there (recycles are unlimited here), but
        tableau moves are what free cards.
      </li>
      <li>
        You can move <strong>part of a run</strong>: pick up from the middle card to put it on another column and free
        the card underneath.
      </li>
    </ul>

    <h4>Empty columns are precious</h4>
    <ul>
      <li>
        Only a King (or a run headed by one) can go into an empty column, so <strong>don't empty a column</strong>{' '}
        unless a King is ready to move in.
      </li>
      <li>
        With a choice of Kings, pick the one whose move <strong>uncovers a face-down card</strong>, or whose color matches
        the Queen you have waiting.
      </li>
    </ul>

    <h4>Don't rush the foundations</h4>
    <ul>
      <li>
        Aces and 2s can always go up. A higher card is safe to send up only when <strong>both opposite-color
        foundations</strong> already hold the rank below it. That's the rule Euterpe's Safe-Play Vacuum follows.
      </li>
      <li>
        Sending a card up early can strand a card that needed it to land on: a black 6 sent up leaves no home for a red 5.
      </li>
      <li>
        Stuck? A foundation card can come <strong>back down</strong> to the tableau to hold a card for you.
      </li>
    </ul>
  </>
);

const KlondikeChecklist = [
  <>Any <strong>Ace or 2</strong> that can go to a foundation.</>,
  <>Every face-up card that would <strong>flip a face-down card</strong> if moved (including the middle of a run).</>,
  <>The <strong>waste card</strong> against every column and every foundation.</>,
  <>A <strong>King</strong> ready for any empty column.</>,
  <>Only then: <strong>draw</strong>.</>,
];

const EuterpeTools: React.FC<{ pyramid?: boolean }> = ({ pyramid }) => (
  <>
    <h4>Let Euterpe help</h4>
    <ul>
      <li>
        <strong>Hint (H)</strong> points at a playable card when you've stopped seeing one.
      </li>
      <li>
        <strong>Undo (Ctrl + Z or U)</strong> is free. Use it to test a line, then take it back.
      </li>
      <li>
        <strong>The Fork</strong> lets you scrub back through your game and branch off from the move where it went wrong.
      </li>
      {pyramid ? (
        <li>
          <strong>The Trainer</strong> (graduation cap) plays this deal at every level, and explains each slip and what it
          cost. It's the fastest way to learn what you're missing.
        </li>
      ) : (
        <li>
          <strong>Winnable deals only</strong> (seed picker) and the <strong>Trainer</strong> come to Klondike once its
          solver lands.
        </li>
      )}
    </ul>
  </>
);

const Turn1Tab: React.FC = () => (
  <div className="rules-section">
    <Checklist items={KlondikeChecklist} />
    <KlondikeCore />
    <h4>Draws count toward Par</h4>
    <ul>
      <li>
        Every draw is a move. In Turn 1 you see every card each pass, so <strong>use a waste card the first time it's
        playable</strong> rather than cycling past it and back.
      </li>
      <li>Avoid shuffling the same run back and forth between two columns. Each trip costs moves and changes nothing.</li>
    </ul>
    <EuterpeTools />
  </div>
);

const Turn3Tab: React.FC = () => (
  <div className="rules-section">
    <Checklist items={KlondikeChecklist} />
    <h4>How the three-card draw works</h4>
    <ul>
      <li>
        You draw three cards but can only play the <strong>top one</strong>. Only about every third card is reachable on
        a pass.
      </li>
      <li>
        If you go through the whole stock <strong>without playing a waste card</strong>, the next pass shows exactly the
        same cards. Nothing changes until you do something.
      </li>
      <li>
        Playing <strong>even one waste card</strong> shifts every later group of three, so new cards become reachable.
        That's the main way out of a stuck stock.
      </li>
    </ul>
    <h4>Turn 3 habits</h4>
    <ul>
      <li>
        Early on, <strong>play from the waste whenever it's useful</strong>: it keeps the cycle changing and gets buried
        cards within reach.
      </li>
      <li>
        On a pass where nothing plays, look at the tableau and foundations for any move (even moving a card back down)
        before cycling again.
      </li>
      <li>
        Late in the game, when the stock is small, count it: you can often work out which card each draw will show.
      </li>
    </ul>
    <KlondikeCore />
    <EuterpeTools />
  </div>
);

const PyramidTab: React.FC = () => (
  <div className="rules-section">
    <Checklist
      items={[
        <>
          Any exposed <strong>King</strong> in the pyramid: it clears alone, and taking it early only helps. (A King on the
          waste is only worth a move if you need the card under it.)
        </>,
        <>Every pair of <strong>exposed pyramid cards</strong> that adds to 13.</>,
        <>The <strong>waste card</strong> against every exposed pyramid card.</>,
        <>Only then: <strong>draw</strong>.</>,
      ]}
    />

    <h4>Never draw past a pair you can use</h4>
    <ul>
      <li>
        Only the <strong>top waste card</strong> is playable. Draw over a waste card you needed and it's buried until the
        next pass.
      </li>
      <li>
        That's why a missed pair is so expensive: it usually costs a <strong>whole extra pass</strong> through the stock,
        10 to 20 moves. The Trainer's slip lessons show exactly this.
      </li>
      <li>
        After you pair the waste card, the one <strong>underneath</strong> becomes playable again. Check it before
        drawing.
      </li>
    </ul>

    <h4>Choose which card to pair</h4>
    <ul>
      <li>
        With two cards of the same value to choose from, pair the one that <strong>uncovers more</strong>: usually the
        one lower in the pyramid, covering the most cards above it.
      </li>
      <li>
        Pairing isn't always right just because you can. Sometimes a card is worth keeping for a partner that has{' '}
        <strong>no other match</strong>. The Trainer shows this: its slips include pairing too early.
      </li>
      <li>
        Work the pyramid from the <strong>bottom up</strong>, favoring cards that block the most cards above them.
      </li>
    </ul>

    <h4>Count partners</h4>
    <ul>
      <li>
        Every card needs a partner that adds to 13: A + Q, 2 + J, 3 + 10, 4 + 9, 5 + 8, 6 + 7. There are only{' '}
        <strong>four of each</strong>.
      </li>
      <li>
        A card can never pair with a card that <strong>covers it</strong>, or one it covers, since they're never both
        exposed. Before using up a value, check that another card isn't relying on it.
      </li>
      <li>
        You win when the <strong>pyramid</strong> is empty. Leftover stock cards don't matter, so don't spend moves
        clearing the waste for its own sake.
      </li>
    </ul>

    <h4>Winnable deals</h4>
    <ul>
      <li>
        With <strong>Winnable deals only</strong> on (the default), every random deal has a winning line. If you're stuck,
        it's a missed pair or a pairing choice, not bad luck, so try The Fork.
      </li>
    </ul>

    <EuterpeTools pyramid />
  </div>
);

export const StrategyModal: React.FC<StrategyModalProps> = ({ initialTab = 'turn1', onClose }) => {
  const [activeTab, setActiveTab] = useState<StrategyTab>(initialTab);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card rules-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-title">
            <BookOpen size={20} className="gold-icon" />
            <h3>Strategy Guide</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="rules-tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`rules-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="rules-content-body">
          {activeTab === 'turn1' ? <Turn1Tab /> : activeTab === 'turn3' ? <Turn3Tab /> : <PyramidTab />}
        </div>

        <div className="modal-actions-row">
          <button className="primary-action-btn" onClick={onClose}>
            <CheckCircle2 size={16} /> Got It
          </button>
        </div>
      </div>
    </div>
  );
};
