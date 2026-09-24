import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { GameMode, DifficultyLevel, KlondikeState, PyramidState, ThemeId, SolitaireCard } from './types/solitaire';
import type { LoadedDeck } from './services/deckLoader';
import { loadInitialDeck } from './services/deckLoader';
import { dealKlondike, isKlondikeWon, canAutoFinish, getNextAutoFinishMove, cloneKlondikeState, findAutoMove } from './engines/klondikeEngine';
import { dealPyramid, isPyramidWon, findPyramidHint, clonePyramidState } from './engines/pyramidEngine';
import { createSeedForDifficulty } from './services/rngService';
import { recordGameResult } from './services/statsService';
import { applyTheme, getSavedTheme, saveTheme } from './services/themeService';
import { saveActiveGame, loadActiveGame, clearActiveGame } from './services/gamePersistenceService';
import { sound } from './services/audioService';

import { HeaderBar } from './components/HeaderBar';
import { KlondikeBoard } from './components/KlondikeBoard';
import { PyramidBoard } from './components/PyramidBoard';
import { ShuffleAnimation } from './components/ShuffleAnimation';
import { VictoryModal } from './components/VictoryModal';
import { StatsModal } from './components/StatsModal';
import { SeedModal } from './components/SeedModal';
import { DeckManagerModal } from './components/DeckManagerModal';
import { ThemeModal } from './components/ThemeModal';
import { RulesModal } from './components/RulesModal';
import { ConfirmModal } from './components/ConfirmModal';

interface ConfirmDialogConfig {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
}

export const App: React.FC = () => {
  // Deck & Theme
  const [deck, setDeck] = useState<LoadedDeck | null>(null);
  const [deckLoading, setDeckLoading] = useState(true);
  const [theme, setTheme] = useState<ThemeId>(() => getSavedTheme());
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Game Configuration
  const [gameMode, setGameMode] = useState<GameMode>('klondike-1');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [seed, setSeed] = useState<string>(() => createSeedForDifficulty('medium'));

  // Game States
  const [klondikeState, setKlondikeState] = useState<KlondikeState | null>(null);
  const [pyramidState, setPyramidState] = useState<PyramidState | null>(null);

  // History for Undo/Redo
  const [klondikeHistory, setKlondikeHistory] = useState<KlondikeState[]>([]);
  const [klondikeFuture, setKlondikeFuture] = useState<KlondikeState[]>([]);
  const [pyramidHistory, setPyramidHistory] = useState<PyramidState[]>([]);
  const [pyramidFuture, setPyramidFuture] = useState<PyramidState[]>([]);

  // Gameplay Metrics
  const [moves, setMoves] = useState(0);
  const [score, setScore] = useState(0);
  const [timeSeconds, setTimeSeconds] = useState(0);
  const [isWon, setIsWon] = useState(false);
  const [hintCardId, setHintCardId] = useState<string | null>(null);

  // Animations, Notifications & Modals
  const [isShuffling, setIsShuffling] = useState(false);
  const [isAutoFinishing, setIsAutoFinishing] = useState(false);
  const [showVictoryModal, setShowVictoryModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogConfig | null>(null);
  const [resumeMessage, setResumeMessage] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitializedRef = useRef(false);

  // Deal a new game
  const startNewGameWithDeck = useCallback(
    (
      activeDeck: LoadedDeck,
      mode: GameMode,
      diff: DifficultyLevel,
      seedToUse: string
    ) => {
      setIsShuffling(true);
      setIsWon(false);
      setShowVictoryModal(false);
      setIsAutoFinishing(false);
      setMoves(0);
      setScore(0);
      setTimeSeconds(0);
      setHintCardId(null);
      clearActiveGame();

      if (mode === 'klondike-1' || mode === 'klondike-3') {
        const drawCount = mode === 'klondike-3' ? 3 : 1;
        const initial = dealKlondike(activeDeck, seedToUse, drawCount, diff);
        setKlondikeState(initial);
        setKlondikeHistory([]);
        setKlondikeFuture([]);
      } else {
        const initial = dealPyramid(activeDeck, seedToUse, diff);
        setPyramidState(initial);
        setPyramidHistory([]);
        setPyramidFuture([]);
      }
    },
    []
  );

  // Initial deck loading & game session restoration on mount
  useEffect(() => {
    applyTheme(theme);

    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    async function init() {
      try {
        const loaded = await loadInitialDeck();
        setDeck(loaded);

        // Check if an in-progress game was saved
        const saved = loadActiveGame();
        if (saved && saved.moves > 0) {
          setGameMode(saved.gameMode);
          setDifficulty(saved.difficulty);
          setSeed(saved.seed);
          setMoves(saved.moves);
          setScore(saved.score);
          setTimeSeconds(saved.timeSeconds);
          setKlondikeState(saved.klondikeState);
          setPyramidState(saved.pyramidState);
          setKlondikeHistory(saved.klondikeHistory || []);
          setKlondikeFuture(saved.klondikeFuture || []);
          setPyramidHistory(saved.pyramidHistory || []);
          setPyramidFuture(saved.pyramidFuture || []);
          setIsWon(false);
          setShowVictoryModal(false);
          setResumeMessage(`Resumed game in progress (${saved.moves} moves)`);
          setTimeout(() => setResumeMessage(null), 4000);
        } else {
          startNewGameWithDeck(loaded, gameMode, difficulty, seed);
        }
      } catch (e) {
        console.error('Failed to load initial deck:', e);
      } finally {
        setDeckLoading(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer runner
  useEffect(() => {
    if (!isWon && !isShuffling && !deckLoading) {
      timerRef.current = setInterval(() => {
        setTimeSeconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isWon, isShuffling, deckLoading]);

  const startNewDeal = useCallback(
    (mode: GameMode = gameMode, diff: DifficultyLevel = difficulty, newSeed?: string) => {
      if (!deck) return;
      const finalSeed = newSeed || createSeedForDifficulty(diff);
      setGameMode(mode);
      setDifficulty(diff);
      setSeed(finalSeed);
      startNewGameWithDeck(deck, mode, diff, finalSeed);
    },
    [deck, gameMode, difficulty, startNewGameWithDeck]
  );

  // Victory check for Klondike
  useEffect(() => {
    if (klondikeState && !isWon) {
      if (isKlondikeWon(klondikeState)) {
        setIsWon(true);
        setShowVictoryModal(true);
        clearActiveGame();
        recordGameResult(gameMode, difficulty, true, timeSeconds, moves, score + 500, seed);
      }
    }
  }, [klondikeState, isWon, gameMode, difficulty, timeSeconds, moves, score, seed]);

  // Victory check for Pyramid
  useEffect(() => {
    if (pyramidState && !isWon) {
      if (isPyramidWon(pyramidState)) {
        setIsWon(true);
        setShowVictoryModal(true);
        clearActiveGame();
        recordGameResult(gameMode, difficulty, true, timeSeconds, moves, score + 500, seed);
      }
    }
  }, [pyramidState, isWon, gameMode, difficulty, timeSeconds, moves, score, seed]);

  // Auto-save active game session to localStorage
  useEffect(() => {
    if (moves > 0 && !isWon && !deckLoading && (klondikeState || pyramidState)) {
      saveActiveGame({
        gameMode,
        difficulty,
        seed,
        moves,
        score,
        timeSeconds,
        klondikeState,
        pyramidState,
        klondikeHistory,
        klondikeFuture,
        pyramidHistory,
        pyramidFuture,
      });
    }
  }, [
    moves,
    score,
    timeSeconds,
    isWon,
    deckLoading,
    gameMode,
    difficulty,
    seed,
    klondikeState,
    pyramidState,
    klondikeHistory,
    klondikeFuture,
    pyramidHistory,
    pyramidFuture,
  ]);

  // Save final state snapshot before refresh or tab close without interrupting with native dialog
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (moves > 0 && !isWon && (klondikeState || pyramidState)) {
        saveActiveGame({
          gameMode,
          difficulty,
          seed,
          moves,
          score,
          timeSeconds,
          klondikeState,
          pyramidState,
          klondikeHistory,
          klondikeFuture,
          pyramidHistory,
          pyramidFuture,
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [
    moves,
    isWon,
    gameMode,
    difficulty,
    seed,
    score,
    timeSeconds,
    klondikeState,
    pyramidState,
    klondikeHistory,
    klondikeFuture,
    pyramidHistory,
    pyramidFuture,
  ]);

  // Handle Klondike state changes
  const handleKlondikeChange = (nextState: KlondikeState, _desc: string) => {
    if (!klondikeState) return;
    setKlondikeHistory((prev) => [...prev, cloneKlondikeState(klondikeState)]);
    setKlondikeFuture([]);
    setKlondikeState(nextState);
    setMoves((m) => m + 1);
    setScore((s) => s + 10);
    setHintCardId(null);
  };

  // Handle Pyramid state changes
  const handlePyramidChange = (nextState: PyramidState, _desc: string) => {
    if (!pyramidState) return;
    setPyramidHistory((prev) => [...prev, clonePyramidState(pyramidState)]);
    setPyramidFuture([]);
    setPyramidState(nextState);
    setMoves((m) => m + 1);
    setScore((s) => s + 15);
    setHintCardId(null);
  };

  // Undo Handler
  const handleUndo = () => {
    if (gameMode === 'klondike-1' || gameMode === 'klondike-3') {
      if (klondikeHistory.length === 0 || !klondikeState) return;
      sound.playCardSlide();
      const previous = klondikeHistory[klondikeHistory.length - 1];
      setKlondikeFuture((f) => [cloneKlondikeState(klondikeState), ...f]);
      setKlondikeHistory((h) => h.slice(0, -1));
      setKlondikeState(previous);
      setMoves((m) => m + 1);
    } else {
      if (pyramidHistory.length === 0 || !pyramidState) return;
      sound.playCardSlide();
      const previous = pyramidHistory[pyramidHistory.length - 1];
      setPyramidFuture((f) => [clonePyramidState(pyramidState), ...f]);
      setPyramidHistory((h) => h.slice(0, -1));
      setPyramidState(previous);
      setMoves((m) => m + 1);
    }
  };

  // Redo Handler
  const handleRedo = () => {
    if (gameMode === 'klondike-1' || gameMode === 'klondike-3') {
      if (klondikeFuture.length === 0 || !klondikeState) return;
      sound.playCardSlide();
      const next = klondikeFuture[0];
      setKlondikeHistory((h) => [...h, cloneKlondikeState(klondikeState)]);
      setKlondikeFuture((f) => f.slice(1));
      setKlondikeState(next);
      setMoves((m) => m + 1);
    } else {
      if (pyramidFuture.length === 0 || !pyramidState) return;
      sound.playCardSlide();
      const next = pyramidFuture[0];
      setPyramidHistory((h) => [...h, clonePyramidState(pyramidState)]);
      setPyramidFuture((f) => f.slice(1));
      setPyramidState(next);
      setMoves((m) => m + 1);
    }
  };

  // Smart Hint Handler
  const handleHint = () => {
    if (gameMode === 'klondike-1' || gameMode === 'klondike-3') {
      if (!klondikeState) return;

      // 1. Look for moves from tableau or waste
      if (klondikeState.waste.length > 0) {
        const topWaste = klondikeState.waste[klondikeState.waste.length - 1];
        if (findAutoMove(topWaste, klondikeState)) {
          setHintCardId(topWaste.id);
          sound.playCardSlide();
          return;
        }
      }

      for (const col of klondikeState.tableau) {
        for (const c of col) {
          if (c.faceUp && findAutoMove(c, klondikeState)) {
            setHintCardId(c.id);
            sound.playCardSlide();
            return;
          }
        }
      }

      sound.playErrorBump();
    } else {
      if (!pyramidState) return;
      const hint = findPyramidHint(pyramidState);
      if (hint) {
        sound.playCardSlide();
        if (hint.card1.source === 'pyramid' && hint.card1.row !== undefined && hint.card1.col !== undefined) {
          const c = pyramidState.pyramid[hint.card1.row][hint.card1.col];
          if (c) setHintCardId(c.id);
        } else if (hint.card1.source === 'waste' && pyramidState.waste.length > 0) {
          setHintCardId(pyramidState.waste[pyramidState.waste.length - 1].id);
        }
      } else {
        sound.playErrorBump();
      }
    }
  };

  // Auto-Finish step execution
  const handleAutoFinish = () => {
    if (!klondikeState || isAutoFinishing) return;
    setIsAutoFinishing(true);

    const stepInterval = setInterval(() => {
      setKlondikeState((current) => {
        if (!current) {
          clearInterval(stepInterval);
          setIsAutoFinishing(false);
          return null;
        }

        const move = getNextAutoFinishMove(current);
        if (!move) {
          clearInterval(stepInterval);
          setIsAutoFinishing(false);
          return current;
        }

        sound.playCardSnap();
        const next = cloneKlondikeState(current);
        const card = next.tableau[move.fromCol].pop();
        if (card) {
          next.foundations[move.toFoundation].push(card);
        }
        return next;
      });
      setMoves((m) => m + 1);
      setScore((s) => s + 20);
    }, 120);
  };

  // Theme change
  const handleSelectTheme = (newTheme: ThemeId) => {
    setTheme(newTheme);
    applyTheme(newTheme);
    saveTheme(newTheme);
  };

  // Sound toggle
  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sound.setSoundEnabled(next);
  };

  // Re-skin cards in flight without resetting game progress
  const reskinCard = (card: SolitaireCard, newDeck: LoadedDeck): SolitaireCard => {
    const urls = newDeck.cardUrls.get(card.id);
    return {
      ...card,
      resolvedVector: urls?.svg,
      resolvedImage: urls?.png,
    };
  };

  const reskinKlondikeState = (state: KlondikeState, newDeck: LoadedDeck): KlondikeState => ({
    ...state,
    tableau: state.tableau.map((col) => col.map((c) => reskinCard(c, newDeck))),
    foundations: state.foundations.map((pile) => pile.map((c) => reskinCard(c, newDeck))),
    stock: state.stock.map((c) => reskinCard(c, newDeck)),
    waste: state.waste.map((c) => reskinCard(c, newDeck)),
  });

  const reskinPyramidState = (state: PyramidState, newDeck: LoadedDeck): PyramidState => ({
    ...state,
    pyramid: state.pyramid.map((row) => row.map((c) => (c ? reskinCard(c, newDeck) : null))),
    stock: state.stock.map((c) => reskinCard(c, newDeck)),
    waste: state.waste.map((c) => reskinCard(c, newDeck)),
    selectedCard: state.selectedCard
      ? {
          ...state.selectedCard,
          card: reskinCard(state.selectedCard.card, newDeck),
        }
      : null,
  });

  // Deck replacement: re-skin in-flight game without restarting
  const handleDeckChanged = (newDeck: LoadedDeck) => {
    setDeck(newDeck);

    // If an in-flight game is active, seamlessly re-skin cards in place
    if (klondikeState || pyramidState) {
      setKlondikeState((curr) => (curr ? reskinKlondikeState(curr, newDeck) : null));
      setKlondikeHistory((hist) => hist.map((s) => reskinKlondikeState(s, newDeck)));
      setKlondikeFuture((fut) => fut.map((s) => reskinKlondikeState(s, newDeck)));

      setPyramidState((curr) => (curr ? reskinPyramidState(curr, newDeck) : null));
      setPyramidHistory((hist) => hist.map((s) => reskinPyramidState(s, newDeck)));
      setPyramidFuture((fut) => fut.map((s) => reskinPyramidState(s, newDeck)));
    } else {
      startNewGameWithDeck(newDeck, gameMode, difficulty, seed);
    }
  };

  // Confirmation interceptors for New Deal, Mode Switching & Challenge Seeds
  const handleRequestSelectMode = (newMode: GameMode) => {
    if (newMode === gameMode) return;
    if (moves > 0 && !isWon) {
      const targetName =
        newMode === 'pyramid'
          ? 'Pyramid Solitaire'
          : newMode === 'klondike-3'
          ? 'Klondike (Turn 3)'
          : 'Klondike (Turn 1)';
      setConfirmDialog({
        isOpen: true,
        title: `Switch to ${targetName}?`,
        description: `You have an active game with ${moves} moves underway. Switching games will forfeit your current board.`,
        confirmLabel: 'Switch Game',
        cancelLabel: 'Keep Playing',
        onConfirm: () => {
          setConfirmDialog(null);
          startNewDeal(newMode, difficulty);
        },
      });
    } else {
      startNewDeal(newMode, difficulty);
    }
  };

  const handleRequestNewGame = () => {
    if (moves > 0 && !isWon) {
      setConfirmDialog({
        isOpen: true,
        title: 'Start New Deal?',
        description: `You have a game in progress with ${moves} moves. Starting a new deal will forfeit your current board.`,
        confirmLabel: 'Start New Deal',
        cancelLabel: 'Keep Playing',
        onConfirm: () => {
          setConfirmDialog(null);
          startNewDeal(gameMode, difficulty);
        },
      });
    } else {
      startNewDeal(gameMode, difficulty);
    }
  };

  const handleRequestApplySeed = (newSeed: string, newDiff: DifficultyLevel) => {
    if (moves > 0 && !isWon) {
      setConfirmDialog({
        isOpen: true,
        title: 'Load Challenge Seed?',
        description: `You have a game in progress with ${moves} moves. Loading this challenge will forfeit your current board.`,
        confirmLabel: 'Load Challenge',
        cancelLabel: 'Keep Playing',
        onConfirm: () => {
          setConfirmDialog(null);
          setShowSeedModal(false);
          startNewDeal(gameMode, newDiff, newSeed);
        },
      });
    } else {
      setShowSeedModal(false);
      startNewDeal(gameMode, newDiff, newSeed);
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key.toLowerCase() === 'h') {
        handleHint();
      } else if (e.key === 'Escape') {
        setShowVictoryModal(false);
        setShowStatsModal(false);
        setShowSeedModal(false);
        setShowDeckModal(false);
        setShowThemeModal(false);
        setShowRulesModal(false);
        setConfirmDialog(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const eligibleForAutoFinish =
    (gameMode === 'klondike-1' || gameMode === 'klondike-3') &&
    klondikeState !== null &&
    canAutoFinish(klondikeState);

  const canUndo =
    (gameMode === 'klondike-1' || gameMode === 'klondike-3')
      ? klondikeHistory.length > 0
      : pyramidHistory.length > 0;

  const canRedo =
    (gameMode === 'klondike-1' || gameMode === 'klondike-3')
      ? klondikeFuture.length > 0
      : pyramidFuture.length > 0;

  if (deckLoading) {
    return (
      <div className="solitaire-loading-screen">
        <div className="loading-card-silhouette">♠</div>
        <h2>Loading Euterpe Solitaire...</h2>
        <p>Ingesting Open Playing Cards v1 Classic Deck</p>
      </div>
    );
  }

  return (
    <div className={`solitaire-app-container theme-${theme}`}>
      {/* Background Felt Baize & Atmospheric Lighting */}
      <div className="felt-background-layer" />
      <div className="felt-spotlight-vignette" />

      {/* Resumed Game Banner Toast */}
      {resumeMessage && (
        <div className="resume-toast-banner" role="status">
          <span className="toast-sparkle">✦</span>
          <span>{resumeMessage}</span>
          <button
            className="toast-dismiss-btn"
            onClick={() => setResumeMessage(null)}
            title="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Header & Controls */}
      <HeaderBar
        gameMode={gameMode}
        difficulty={difficulty}
        seed={seed}
        moves={moves}
        timeSeconds={timeSeconds}
        score={score}
        canUndo={canUndo}
        canRedo={canRedo}
        canAutoFinish={eligibleForAutoFinish}
        soundEnabled={soundEnabled}
        onSelectMode={handleRequestSelectMode}
        onNewGame={handleRequestNewGame}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onHint={handleHint}
        onAutoFinish={handleAutoFinish}
        onToggleSound={handleToggleSound}
        onOpenSeedModal={() => setShowSeedModal(true)}
        onOpenStatsModal={() => setShowStatsModal(true)}
        onOpenThemeModal={() => setShowThemeModal(true)}
        onOpenDeckModal={() => setShowDeckModal(true)}
        onOpenRulesModal={() => setShowRulesModal(true)}
      />

      {/* Game Playing Surface */}
      <main className="game-table-felt">
        {gameMode === 'pyramid' && pyramidState ? (
          <PyramidBoard
            state={pyramidState}
            deck={deck}
            hintCardId={hintCardId}
            onStateChange={handlePyramidChange}
          />
        ) : klondikeState ? (
          <KlondikeBoard
            state={klondikeState}
            deck={deck}
            hintCardId={hintCardId}
            onStateChange={handleKlondikeChange}
          />
        ) : null}
      </main>

      {/* 3D Riffle Shuffle & Deal Animation */}
      {isShuffling && (
        <ShuffleAnimation
          deck={deck}
          onComplete={() => setIsShuffling(false)}
        />
      )}

      {/* Modals */}
      {showVictoryModal && (
        <VictoryModal
          gameMode={gameMode}
          difficulty={difficulty}
          seed={seed}
          moves={moves}
          timeSeconds={timeSeconds}
          score={score}
          onPlayAgain={() => startNewDeal(gameMode, difficulty)}
          onReplaySeed={() => startNewDeal(gameMode, difficulty, seed)}
          onClose={() => setShowVictoryModal(false)}
        />
      )}

      {showStatsModal && (
        <StatsModal
          currentMode={gameMode}
          onReplaySeed={(m, d, s) => startNewDeal(m, d, s)}
          onClose={() => setShowStatsModal(false)}
        />
      )}

      {showSeedModal && (
        <SeedModal
          currentSeed={seed}
          currentDifficulty={difficulty}
          onApplySeedAndDifficulty={handleRequestApplySeed}
          onClose={() => setShowSeedModal(false)}
        />
      )}

      {showDeckModal && (
        <DeckManagerModal
          currentDeck={deck}
          onDeckChanged={handleDeckChanged}
          onClose={() => setShowDeckModal(false)}
        />
      )}

      {showThemeModal && (
        <ThemeModal
          currentTheme={theme}
          onSelectTheme={handleSelectTheme}
          onClose={() => setShowThemeModal(false)}
        />
      )}

      {showRulesModal && (
        <RulesModal onClose={() => setShowRulesModal(false)} />
      )}

      {confirmDialog && (
        <ConfirmModal
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          description={confirmDialog.description}
          confirmLabel={confirmDialog.confirmLabel}
          cancelLabel={confirmDialog.cancelLabel}
          currentMode={gameMode}
          difficulty={difficulty}
          moves={moves}
          timeSeconds={timeSeconds}
          score={score}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
};

export default App;
