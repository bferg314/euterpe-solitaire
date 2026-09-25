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
import { getOrComputePar } from './services/parService';
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
import { RulesModal, type RulesTab } from './components/RulesModal';
import { ConfirmModal } from './components/ConfirmModal';
import { ForkModal } from './components/ForkModal';
import { DeadlockBanner } from './components/DeadlockBanner';
import type { TimelineStep } from './types/fork';
import { checkKlondikeDeadlock, checkPyramidDeadlock, tagMoveTransition } from './engines/deadlockDetector';
import { getSavedSettings, saveSettings, type ParlorComfortSettings } from './services/settingsService';
import { GitFork } from 'lucide-react';

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

  // The Fork: Move Descriptions & Timeline Branching
  const [moveDescriptions, setMoveDescriptions] = useState<string[]>(['Initial Deal']);
  const [futureMoveDescriptions, setFutureMoveDescriptions] = useState<string[]>([]);
  const [branchCount, setBranchCount] = useState(0);
  const [isDeadlocked, setIsDeadlocked] = useState(false);
  const [deadlockReason, setDeadlockReason] = useState<string | undefined>(undefined);
  const [showDeadlockBanner, setShowDeadlockBanner] = useState(false);
  const [showForkModal, setShowForkModal] = useState(false);
  const [forkPreviewIndex, setForkPreviewIndex] = useState<number | null>(null);

  // Parlor Comfort Settings (Ambient Vacuum & Smart Tap)
  const [comfortSettings, setComfortSettings] = useState<ParlorComfortSettings>(() => getSavedSettings());

  const handleToggleAmbientVacuum = () => {
    setComfortSettings((prev) => {
      const next = { ...prev, ambientVacuumEnabled: !prev.ambientVacuumEnabled };
      saveSettings(next);
      setResumeMessage(
        next.ambientVacuumEnabled
          ? 'Safe-Play Foundation Vacuum: Enabled (Auto-sweeping safe cards)'
          : 'Safe-Play Foundation Vacuum: Disabled'
      );
      setTimeout(() => setResumeMessage(null), 3000);
      return next;
    });
  };

  // First time a board is played by keyboard, point at the shortcut sheet once.
  const handleKeyboardActivate = () => {
    if (comfortSettings.keyboardHintSeen) return;
    const next = { ...comfortSettings, keyboardHintSeen: true };
    setComfortSettings(next);
    saveSettings(next);
    const hint = 'Keyboard mode: arrow keys to move, Space to pick up or drop, ? for all shortcuts';
    setResumeMessage(hint);
    setTimeout(() => setResumeMessage((current) => (current === hint ? null : current)), 6000);
  };

  // Gameplay Metrics
  const [moves, setMoves] = useState(0);
  const [score, setScore] = useState(0);
  const [timeSeconds, setTimeSeconds] = useState(0);
  const [par, setPar] = useState<number>(0);
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
  const [rulesTab, setRulesTab] = useState<RulesTab>('klondike');
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
      setMoveDescriptions(['Initial Deal']);
      setFutureMoveDescriptions([]);
      setBranchCount(0);
      setIsDeadlocked(false);
      setShowDeadlockBanner(false);
      setShowForkModal(false);
      setForkPreviewIndex(null);
      clearActiveGame();

      let computedPar = 0;
      if (mode === 'klondike-1' || mode === 'klondike-3') {
        const drawCount = mode === 'klondike-3' ? 3 : 1;
        const initial = dealKlondike(activeDeck, seedToUse, drawCount, diff);
        setKlondikeState(initial);
        setKlondikeHistory([]);
        setKlondikeFuture([]);
        computedPar = getOrComputePar(mode, diff, seedToUse, initial, null);
      } else {
        const initial = dealPyramid(activeDeck, seedToUse, diff);
        setPyramidState(initial);
        setPyramidHistory([]);
        setPyramidFuture([]);
        computedPar = getOrComputePar(mode, diff, seedToUse, null, initial);
      }
      setPar(computedPar);
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
          setBranchCount(saved.branchCount || 0);
          setMoveDescriptions(
            saved.moveDescriptions && saved.moveDescriptions.length > 0
              ? saved.moveDescriptions
              : ['Initial Deal']
          );
          setFutureMoveDescriptions([]);
          setIsDeadlocked(false);
          setShowDeadlockBanner(false);
          setShowForkModal(false);
          setForkPreviewIndex(null);
          const restoredPar = saved.par || getOrComputePar(saved.gameMode, saved.difficulty, saved.seed, saved.klondikeState, saved.pyramidState);
          setPar(restoredPar);
          setIsWon(false);
          setShowVictoryModal(false);
          setResumeMessage(`Resumed game in progress (${saved.moves} moves • Par ${restoredPar}${saved.branchCount ? ` • Branch #${saved.branchCount}` : ''})`);
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
        recordGameResult(gameMode, difficulty, true, timeSeconds, moves, score + 500, seed, par);
      }
    }
  }, [klondikeState, isWon, gameMode, difficulty, timeSeconds, moves, score, seed, par]);

  // Victory check for Pyramid
  useEffect(() => {
    if (pyramidState && !isWon) {
      if (isPyramidWon(pyramidState)) {
        setIsWon(true);
        setShowVictoryModal(true);
        clearActiveGame();
        recordGameResult(gameMode, difficulty, true, timeSeconds, moves, score + 500, seed, par);
      }
    }
  }, [pyramidState, isWon, gameMode, difficulty, timeSeconds, moves, score, seed, par]);

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
        par: par || undefined,
        branchCount,
        moveDescriptions,
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
    par,
    branchCount,
    moveDescriptions,
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
          par: par || undefined,
          branchCount,
          moveDescriptions,
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
    par,
    branchCount,
    moveDescriptions,
    klondikeState,
    pyramidState,
    klondikeHistory,
    klondikeFuture,
    pyramidHistory,
    pyramidFuture,
  ]);

  // Handle Klondike state changes
  const handleKlondikeChange = (nextState: KlondikeState, desc: string) => {
    if (!klondikeState) return;
    setKlondikeHistory((prev) => [...prev, cloneKlondikeState(klondikeState)]);
    setKlondikeFuture([]);
    setMoveDescriptions((prev) => [...prev, desc || 'Moved cards']);
    setFutureMoveDescriptions([]);
    setKlondikeState(nextState);
    setMoves((m) => m + 1);
    setScore((s) => s + 10);
    setHintCardId(null);
  };

  // Handle Pyramid state changes
  const handlePyramidChange = (nextState: PyramidState, desc: string) => {
    if (!pyramidState) return;
    // Snapshots drop the half-made selection so undo lands on a clean board.
    const snapshot = { ...clonePyramidState(pyramidState), selectedCard: null };
    setPyramidHistory((prev) => [...prev, snapshot]);
    setPyramidFuture([]);
    setMoveDescriptions((prev) => [...prev, desc || 'Matched cards']);
    setFutureMoveDescriptions([]);
    setPyramidState(nextState);
    setMoves((m) => m + 1);
    setScore((s) => s + 15);
    setHintCardId(null);
  };

  // Selecting or deselecting a Pyramid card isn't a move: no history, moves or score.
  const handlePyramidSelectionChange = (nextState: PyramidState) => {
    if (forkPreviewIndex !== null) return;
    setPyramidState(nextState);
  };

  // Undo Handler
  const handleUndo = () => {
    if (gameMode === 'klondike-1' || gameMode === 'klondike-3') {
      if (klondikeHistory.length === 0 || !klondikeState) return;
      sound.playCardSlide();
      const previous = klondikeHistory[klondikeHistory.length - 1];
      setKlondikeFuture((f) => [cloneKlondikeState(klondikeState), ...f]);
      setKlondikeHistory((h) => h.slice(0, -1));
      if (moveDescriptions.length > 1) {
        const lastDesc = moveDescriptions[moveDescriptions.length - 1];
        setFutureMoveDescriptions((f) => [lastDesc, ...f]);
        setMoveDescriptions((m) => m.slice(0, -1));
      }
      setKlondikeState(previous);
      setMoves((m) => Math.max(0, m - 1));
    } else {
      if (pyramidHistory.length === 0 || !pyramidState) return;
      sound.playCardSlide();
      const previous = pyramidHistory[pyramidHistory.length - 1];
      setPyramidFuture((f) => [clonePyramidState(pyramidState), ...f]);
      setPyramidHistory((h) => h.slice(0, -1));
      if (moveDescriptions.length > 1) {
        const lastDesc = moveDescriptions[moveDescriptions.length - 1];
        setFutureMoveDescriptions((f) => [lastDesc, ...f]);
        setMoveDescriptions((m) => m.slice(0, -1));
      }
      setPyramidState(previous);
      setMoves((m) => Math.max(0, m - 1));
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
      if (futureMoveDescriptions.length > 0) {
        const nextDesc = futureMoveDescriptions[0];
        setMoveDescriptions((m) => [...m, nextDesc]);
        setFutureMoveDescriptions((f) => f.slice(1));
      }
      setKlondikeState(next);
      setMoves((m) => m + 1);
    } else {
      if (pyramidFuture.length === 0 || !pyramidState) return;
      sound.playCardSlide();
      const next = pyramidFuture[0];
      setPyramidHistory((h) => [...h, clonePyramidState(pyramidState)]);
      setPyramidFuture((f) => f.slice(1));
      if (futureMoveDescriptions.length > 0) {
        const nextDesc = futureMoveDescriptions[0];
        setMoveDescriptions((m) => [...m, nextDesc]);
        setFutureMoveDescriptions((f) => f.slice(1));
      }
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
      setIsDeadlocked(true);
      setDeadlockReason('No playable moves found for the current layout.');
      setShowDeadlockBanner(true);
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
        setIsDeadlocked(true);
        setDeadlockReason('No matching pairs found for exposed pyramid cards.');
        setShowDeadlockBanner(true);
      }
    }
  };

  // Memoized timeline steps for The Fork
  const timelineSteps: TimelineStep[] = React.useMemo(() => {
    if (gameMode === 'pyramid') {
      if (!pyramidState) return [];
      const allStates = [...pyramidHistory, pyramidState];
      return allStates.map((st, i) => {
        if (i === 0) {
          return {
            stepIndex: 0,
            state: st,
            description: 'Initial Deal',
            tag: 'deal',
            timestamp: Date.now() - (allStates.length - 1) * 3000,
          };
        }
        const prev = allStates[i - 1];
        const desc = moveDescriptions[i] || 'Matched or moved cards';
        const { tag, insight } = tagMoveTransition(null, null, prev, st, desc);
        return {
          stepIndex: i,
          state: st,
          description: desc,
          tag,
          insight,
          timestamp: Date.now() - (allStates.length - 1 - i) * 3000,
        };
      });
    } else {
      if (!klondikeState) return [];
      const allStates = [...klondikeHistory, klondikeState];
      return allStates.map((st, i) => {
        if (i === 0) {
          return {
            stepIndex: 0,
            state: st,
            description: 'Initial Deal',
            tag: 'deal',
            timestamp: Date.now() - (allStates.length - 1) * 3000,
          };
        }
        const prev = allStates[i - 1];
        const desc = moveDescriptions[i] || 'Moved cards';
        const { tag, insight } = tagMoveTransition(prev, st, null, null, desc);
        return {
          stepIndex: i,
          state: st,
          description: desc,
          tag,
          insight,
          timestamp: Date.now() - (allStates.length - 1 - i) * 3000,
        };
      });
    }
  }, [gameMode, klondikeState, klondikeHistory, pyramidState, pyramidHistory, moveDescriptions]);

  // Deadlock detection runner
  useEffect(() => {
    if (moves === 0 || isWon || isShuffling || deckLoading) {
      setIsDeadlocked(false);
      setShowDeadlockBanner(false);
      return;
    }

    if (gameMode === 'pyramid' && pyramidState) {
      const result = checkPyramidDeadlock(pyramidState);
      setIsDeadlocked(result.isDeadlocked);
      setDeadlockReason(result.reason);
      if (result.isDeadlocked) {
        setShowDeadlockBanner(true);
      }
    } else if (klondikeState) {
      const result = checkKlondikeDeadlock(klondikeState);
      setIsDeadlocked(result.isDeadlocked);
      setDeadlockReason(result.reason);
      if (result.isDeadlocked) {
        setShowDeadlockBanner(true);
      }
    }
  }, [moves, isWon, isShuffling, deckLoading, gameMode, klondikeState, pyramidState]);

  // Branch execution from historical timeline step
  const handleBranch = (stepIndex: number) => {
    if (gameMode === 'pyramid') {
      if (!pyramidState) return;
      if (stepIndex >= pyramidHistory.length) {
        setShowForkModal(false);
        setForkPreviewIndex(null);
        return;
      }
      const targetState = pyramidHistory[stepIndex];
      const newHistory = pyramidHistory.slice(0, stepIndex);
      setPyramidState(targetState);
      setPyramidHistory(newHistory);
      setPyramidFuture([]);
    } else {
      if (!klondikeState) return;
      if (stepIndex >= klondikeHistory.length) {
        setShowForkModal(false);
        setForkPreviewIndex(null);
        return;
      }
      const targetState = klondikeHistory[stepIndex];
      const newHistory = klondikeHistory.slice(0, stepIndex);
      setKlondikeState(targetState);
      setKlondikeHistory(newHistory);
      setKlondikeFuture([]);
    }

    setMoveDescriptions((prev) => prev.slice(0, stepIndex + 1));
    setFutureMoveDescriptions([]);
    setMoves(stepIndex);
    const nextBranch = branchCount + 1;
    setBranchCount(nextBranch);
    sound.playCardSnap();
    setShowForkModal(false);
    setForkPreviewIndex(null);
    setShowDeadlockBanner(false);
    setResumeMessage(`Branched from Move ${stepIndex} • Path #${nextBranch} Active`);
    setTimeout(() => setResumeMessage(null), 4000);
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
      } else if (e.key === '?') {
        setRulesTab('keyboard');
        setShowRulesModal(true);
      } else if (e.key === 'Escape') {
        setShowVictoryModal(false);
        setShowStatsModal(false);
        setShowSeedModal(false);
        setShowDeckModal(false);
        setShowThemeModal(false);
        setShowRulesModal(false);
        setShowForkModal(false);
        setForkPreviewIndex(null);
        setConfirmDialog(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Board keys pause whenever something else owns the screen.
  const boardKeyboardEnabled =
    !isShuffling &&
    !isAutoFinishing &&
    !showVictoryModal &&
    !showStatsModal &&
    !showSeedModal &&
    !showDeckModal &&
    !showThemeModal &&
    !showRulesModal &&
    !showForkModal &&
    forkPreviewIndex === null &&
    !confirmDialog;

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

  // Active display states (considers Fork live preview)
  const displayKlondikeState =
    forkPreviewIndex !== null && forkPreviewIndex < klondikeHistory.length
      ? klondikeHistory[forkPreviewIndex]
      : klondikeState;

  const displayPyramidState =
    forkPreviewIndex !== null && forkPreviewIndex < pyramidHistory.length
      ? pyramidHistory[forkPreviewIndex]
      : pyramidState;

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
        par={par}
        timeSeconds={timeSeconds}
        score={score}
        canUndo={canUndo}
        canRedo={canRedo}
        canAutoFinish={eligibleForAutoFinish}
        canFork={moves > 0}
        branchCount={branchCount}
        isDeadlocked={isDeadlocked}
        ambientVacuumEnabled={comfortSettings.ambientVacuumEnabled}
        soundEnabled={soundEnabled}
        onSelectMode={handleRequestSelectMode}
        onNewGame={handleRequestNewGame}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onHint={handleHint}
        onAutoFinish={handleAutoFinish}
        onOpenFork={() => {
          setShowForkModal(true);
          setForkPreviewIndex(timelineSteps.length > 0 ? timelineSteps.length - 1 : 0);
        }}
        onToggleAmbientVacuum={handleToggleAmbientVacuum}
        onToggleSound={handleToggleSound}
        onOpenSeedModal={() => setShowSeedModal(true)}
        onOpenStatsModal={() => setShowStatsModal(true)}
        onOpenThemeModal={() => setShowThemeModal(true)}
        onOpenDeckModal={() => setShowDeckModal(true)}
        onOpenRulesModal={() => {
          setRulesTab(gameMode === 'pyramid' ? 'pyramid' : 'klondike');
          setShowRulesModal(true);
        }}
      />

      {/* Game Playing Surface */}
      <main className="game-table-felt">
        {/* Deadlock Banner */}
        {showDeadlockBanner && !showForkModal && (
          <DeadlockBanner
            reason={deadlockReason}
            onOpenFork={() => {
              setShowForkModal(true);
              setForkPreviewIndex(timelineSteps.length > 0 ? timelineSteps.length - 1 : 0);
            }}
            onDismiss={() => setShowDeadlockBanner(false)}
          />
        )}

        {/* Fork Timeline Floating Preview Pill */}
        {forkPreviewIndex !== null && showForkModal && (
          <div className="fork-preview-floating-indicator">
            <GitFork size={14} className="gold-icon" />
            <span>
              Previewing Move <strong>{forkPreviewIndex}</strong> of {Math.max(0, timelineSteps.length - 1)}
            </span>
          </div>
        )}

        {gameMode === 'pyramid' && displayPyramidState ? (
          <PyramidBoard
            state={displayPyramidState}
            deck={deck}
            hintCardId={forkPreviewIndex !== null ? null : hintCardId}
            keyboardEnabled={boardKeyboardEnabled}
            onKeyboardActivate={handleKeyboardActivate}
            onStateChange={handlePyramidChange}
            onSelectionChange={handlePyramidSelectionChange}
          />
        ) : displayKlondikeState ? (
          <KlondikeBoard
            state={displayKlondikeState}
            deck={deck}
            hintCardId={forkPreviewIndex !== null ? null : hintCardId}
            ambientVacuumEnabled={comfortSettings.ambientVacuumEnabled}
            smartTapEnabled={comfortSettings.smartTapEnabled}
            keyboardEnabled={boardKeyboardEnabled}
            onKeyboardActivate={handleKeyboardActivate}
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
          par={par}
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
        <RulesModal initialTab={rulesTab} onClose={() => setShowRulesModal(false)} />
      )}

      {/* The Fork Timeline Modal */}
      <ForkModal
        isOpen={showForkModal}
        timeline={timelineSteps}
        previewIndex={forkPreviewIndex ?? (timelineSteps.length > 0 ? timelineSteps.length - 1 : 0)}
        branchCount={branchCount}
        onSelectPreviewIndex={(idx) => setForkPreviewIndex(idx)}
        onBranch={handleBranch}
        onClose={() => {
          setShowForkModal(false);
          setForkPreviewIndex(null);
        }}
      />

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
