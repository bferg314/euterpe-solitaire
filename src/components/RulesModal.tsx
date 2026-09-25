import React, { useState } from 'react';
import { HelpCircle, X, CheckCircle2 } from 'lucide-react';

export type RulesTab = 'klondike' | 'pyramid' | 'keyboard';

interface RulesModalProps {
  initialTab?: RulesTab;
  onClose: () => void;
}

// Each entry is a key, a chord like 'Ctrl+Z' (drawn as Ctrl + Z), or a plain-text joiner ('or', '–').
const JOINERS = new Set(['or', '–']);

const Keys: React.FC<{ keys: string[] }> = ({ keys }) => (
  <span className="kbd-combo">
    {keys.map((k, i) =>
      JOINERS.has(k) ? (
        <span key={i} className="kbd-joiner">{k}</span>
      ) : k.length > 1 && k.includes('+') ? (
        <span key={i} className="kbd-chord">
          {k.split('+').map((part, j) => (
            <React.Fragment key={j}>
              {j > 0 && <span className="kbd-joiner">+</span>}
              <kbd>{part}</kbd>
            </React.Fragment>
          ))}
        </span>
      ) : (
        <kbd key={i}>{k}</kbd>
      )
    )}
  </span>
);

const KLONDIKE_KEYS: [string[], string][] = [
  [['←', '→'], 'Move between piles in the row'],
  [['↓'], 'From the top row, drop into the column below'],
  [['↑', '↓'], 'In a column, choose how many face-up cards to pick up'],
  [['Space'], 'Pick up the cards under the cursor, then drop them on another pile'],
  [['Enter'], 'Play the card, same as clicking it'],
  [['1', '–', '7'], 'Jump to a column (drops held cards there)'],
  [['F'], 'Send the card to its foundation'],
  [['D'], 'Draw from the stock, or recycle the waste'],
  [['W'], 'Jump to the waste'],
  [['Esc'], 'Put held cards back'],
];

const PYRAMID_KEYS: [string[], string][] = [
  [['←', '→'], 'Previous or next card in the row'],
  [['↑', '↓'], 'Nearest card in the row above or below; down from the bottom row reaches stock and waste'],
  [['Space', 'or', 'Enter'], 'Select a card, pair it to 13, or clear a King'],
  [['D'], 'Draw from the stock'],
  [['W'], 'Select the waste card'],
  [['Esc'], 'Clear the selection'],
];

const GLOBAL_KEYS: [string[], string][] = [
  [['Ctrl+Z', 'or', 'U'], 'Undo'],
  [['Ctrl+Y'], 'Redo'],
  [['H'], 'Show a hint'],
  [['?'], 'Open this sheet'],
];

const KeyTable: React.FC<{ rows: [string[], string][] }> = ({ rows }) => (
  <dl className="kbd-table">
    {rows.map(([keys, action]) => (
      <div key={action} className="kbd-row">
        <dt>
          <Keys keys={keys} />
        </dt>
        <dd>{action}</dd>
      </div>
    ))}
  </dl>
);

export const RulesModal: React.FC<RulesModalProps> = ({ initialTab = 'klondike', onClose }) => {
  const [activeTab, setActiveTab] = useState<RulesTab>(initialTab);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card rules-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-title">
            <HelpCircle size={20} className="gold-icon" />
            <h3>Rules & Guide</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="rules-tabs">
          <button
            className={`rules-tab-btn ${activeTab === 'klondike' ? 'active' : ''}`}
            onClick={() => setActiveTab('klondike')}
          >
            Klondike Solitaire
          </button>
          <button
            className={`rules-tab-btn ${activeTab === 'pyramid' ? 'active' : ''}`}
            onClick={() => setActiveTab('pyramid')}
          >
            Pyramid Solitaire
          </button>
          <button
            className={`rules-tab-btn ${activeTab === 'keyboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('keyboard')}
          >
            Keyboard
          </button>
        </div>

        <div className="rules-content-body">
          {activeTab === 'klondike' ? (
            <div className="rules-section">
              <h4>Objective</h4>
              <p>
                Transfer all 52 playing cards onto the 4 Foundation piles at the top right, sorted by suit in ascending order from <strong>Ace</strong> up to <strong>King</strong>.
              </p>

              <h4>Tableau Rules</h4>
              <ul>
                <li>Cards on the 7 columns must be built in <strong>descending sequence with alternating colors</strong> (e.g., Red Queen on Black King, Black 7 on Red 8).</li>
                <li>You can move stacks of face-up cards together to another column if the top moving card legally connects to the target.</li>
                <li>Only a <strong>King</strong> (or a sequence headed by a King) may be placed into an empty tableau space.</li>
              </ul>

              <h4>Stock & Waste</h4>
              <ul>
                <li>Click the Stock pile to draw cards into the Waste pile (1 card in Turn 1 mode, 3 cards in Turn 3 mode).</li>
                <li>When the Stock is exhausted, click the empty slot to recycle the Waste back into the Stock.</li>
              </ul>

              <h4>Shortcuts & Controls</h4>
              <p>
                <strong>Single Click / Tap:</strong> Automatically glides the card to the Foundation or best Tableau slot.
                <br />
                <strong>Drag & Drop:</strong> Drag single cards or cascaded stacks anywhere on the board.
                <br />
                <strong>Keyboard:</strong> Every move works from the keyboard too. See the Keyboard tab or press <kbd>?</kbd>.
              </p>
            </div>
          ) : activeTab === 'pyramid' ? (
            <div className="rules-section">
              <h4>Objective</h4>
              <p>
                Dismantle the 28-card pyramid completely by matching exposed cards in pairs that add up to <strong>13</strong>.
              </p>

              <h4>Card Values & Pairs</h4>
              <div className="pyramid-values-table">
                <div className="pair-pill"><strong>King (13)</strong> = Cleared alone with 1 click!</div>
                <div className="pair-pill"><strong>Queen (12) + Ace (1)</strong> = 13</div>
                <div className="pair-pill"><strong>Jack (11) + 2</strong> = 13</div>
                <div className="pair-pill"><strong>10 + 3</strong> = 13</div>
                <div className="pair-pill"><strong>9 + 4</strong> = 13</div>
                <div className="pair-pill"><strong>8 + 5</strong> = 13</div>
                <div className="pair-pill"><strong>7 + 6</strong> = 13</div>
              </div>

              <h4>Exposure Rules</h4>
              <p>
                A card in the pyramid is exposed and available for matching only when both cards directly below it have been removed. Bottom-row cards are exposed immediately at the start of the game.
              </p>

              <h4>Stock & Waste</h4>
              <p>
                Click the Stock pile to flip a reserve card to the Waste pile. The exposed Waste card can be paired with any available pyramid card!
              </p>
            </div>
          ) : (
            <div className="rules-section">
              <p>
                Press <kbd>Tab</kbd> to reach the board, or just start with an arrow key. A gold cursor shows where you are,
                and it hides again as soon as you use the mouse.
              </p>
              <h4>Everywhere</h4>
              <KeyTable rows={GLOBAL_KEYS} />
              <h4>Klondike</h4>
              <KeyTable rows={KLONDIKE_KEYS} />
              <h4>Pyramid</h4>
              <KeyTable rows={PYRAMID_KEYS} />
            </div>
          )}
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
