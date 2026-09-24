import React, { useState } from 'react';
import type { LoadedDeck } from '../services/deckLoader';
import { loadDeckFromFile, loadStarterDeck } from '../services/deckLoader';
import { saveCustomDeckToStorage, clearCustomDeckFromStorage } from '../services/deckStorageService';
import { FolderOpen, Upload, RefreshCw, X, CheckCircle2, AlertCircle, Layers } from 'lucide-react';

interface DeckManagerModalProps {
  currentDeck: LoadedDeck | null;
  onDeckChanged: (newDeck: LoadedDeck) => void;
  onClose: () => void;
}

export const DeckManagerModal: React.FC<DeckManagerModalProps> = ({
  currentDeck,
  onDeckChanged,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    try {
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      const loaded = await loadDeckFromFile(file);
      await saveCustomDeckToStorage(file, file.name);
      onDeckChanged(loaded);
      setSuccessMsg(`Imported and saved deck "${loaded.deck.name}" as active deck!`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to parse deck file');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleResetToStarter = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      await clearCustomDeckFromStorage();
      const starter = await loadStarterDeck();
      onDeckChanged(starter);
      setSuccessMsg('Reset to default Starter Deck.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to reset starter deck');
    } finally {
      setLoading(false);
    }
  };

  const deckData = currentDeck?.deck;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card deck-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-title">
            <FolderOpen size={20} className="gold-icon" />
            <h3>Open Playing Cards Engine</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Status Alerts */}
        {errorMsg && (
          <div className="modal-alert error">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="modal-alert success">
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Current Deck Card Info */}
        <div className="active-deck-card">
          <div className="deck-meta-header">
            <div>
              <span className="deck-spec-tag">
                OPEN PLAYING CARDS V1 • {currentDeck?.isCustom ? 'SAVED CUSTOM DECK' : 'DEFAULT STARTER DECK'}
              </span>
              <h4>{deckData?.name || 'Classic Deck Large'}</h4>
              <p className="deck-author">
                By {deckData?.author || 'Bryan Ferguson'} · License: {deckData?.license || 'CC0-1.0'}
              </p>
            </div>
            {currentDeck?.isCustom && (
              <button
                className="subtle-btn"
                onClick={handleResetToStarter}
                disabled={loading}
                title="Reset to default Classic Deck"
              >
                <RefreshCw size={14} /> Reset Default
              </button>
            )}
          </div>

          <div className="deck-spec-grid">
            <div className="spec-item">
              <span className="spec-label">DIMENSIONS</span>
              <span className="spec-val">
                {deckData?.card.widthMm} × {deckData?.card.heightMm} mm
              </span>
            </div>
            <div className="spec-item">
              <span className="spec-label">CORNER RADIUS</span>
              <span className="spec-val">{deckData?.card.cornerRadiusMm} mm</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">RESOLUTION</span>
              <span className="spec-val">
                {deckData?.card.imageWidth} × {deckData?.card.imageHeight} px
              </span>
            </div>
            <div className="spec-item">
              <span className="spec-label">FORMAT</span>
              <span className="spec-val">Vector SVG + High-Res PNG</span>
            </div>
          </div>
        </div>

        {/* Drag & Drop Import Zone */}
        <div
          className={`deck-upload-dropzone ${loading ? 'loading' : ''}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <Layers size={36} className="upload-icon" />
          <div className="dropzone-text">
            <strong>Drop any .cards.zip or .cards.json file here</strong>
            <span>Directly load custom playing card decks exported from Card Atelier</span>
          </div>

          <label className="primary-action-btn file-input-label">
            <Upload size={16} />
            <span>Browse Deck File</span>
            <input
              type="file"
              accept=".zip,.json,.cards.zip,.cards.json"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              disabled={loading}
            />
          </label>
        </div>

        {/* Open Playing Cards Info Footer */}
        <div className="deck-standard-callout">
          <p>
            This solitaire client implements the open specification documented at{' '}
            <a
              href="https://github.com/bferg314/card-atelier/blob/main/docs/open-playing-cards.md"
              target="_blank"
              rel="noreferrer"
            >
              Open Playing Cards v1
            </a>
            . Cards are rendered with vector precision and physical aspect-ratio correctness.
          </p>
        </div>
      </div>
    </div>
  );
};
