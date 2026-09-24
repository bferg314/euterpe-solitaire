const DB_NAME = 'euterpe_solitaire_db';
const DB_VERSION = 1;
const STORE_NAME = 'custom_decks';
const ACTIVE_DECK_KEY = 'active_custom_deck';
const DECK_SELECTION_KEY = 'euterpe_solitaire_deck_choice_v1';

export type DeckChoice = 'starter' | 'custom';

interface StoredDeckRecord {
  id: string;
  name: string;
  blob: Blob;
  timestamp: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves an uploaded custom deck archive or JSON blob to IndexedDB
 */
export async function saveCustomDeckToStorage(file: File | Blob, name: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const record: StoredDeckRecord = {
        id: ACTIVE_DECK_KEY,
        name,
        blob: file,
        timestamp: Date.now(),
      };

      const putRequest = store.put(record);
      putRequest.onsuccess = () => {
        setSelectedDeckChoice('custom');
        resolve();
      };
      putRequest.onerror = () => reject(putRequest.error);
    });
  } catch (err) {
    console.warn('Failed to persist custom deck to IndexedDB:', err);
  }
}

/**
 * Loads the active custom deck from IndexedDB, if stored
 */
export async function loadCustomDeckFromStorage(): Promise<{ blob: Blob; name: string } | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getRequest = store.get(ACTIVE_DECK_KEY);

      getRequest.onsuccess = () => {
        const result = getRequest.result as StoredDeckRecord | undefined;
        if (result && result.blob) {
          resolve({ blob: result.blob, name: result.name });
        } else {
          resolve(null);
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  } catch (err) {
    console.warn('Failed to load custom deck from IndexedDB:', err);
    return null;
  }
}

/**
 * Clears any saved custom deck from IndexedDB
 */
export async function clearCustomDeckFromStorage(): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const delRequest = store.delete(ACTIVE_DECK_KEY);
      delRequest.onsuccess = () => {
        setSelectedDeckChoice('starter');
        resolve();
      };
      delRequest.onerror = () => reject(delRequest.error);
    });
  } catch (err) {
    console.warn('Failed to clear custom deck from IndexedDB:', err);
    setSelectedDeckChoice('starter');
  }
}

/**
 * Reads user's selected deck preference ('starter' or 'custom')
 */
export function getSelectedDeckChoice(): DeckChoice {
  try {
    const saved = localStorage.getItem(DECK_SELECTION_KEY);
    return saved === 'custom' ? 'custom' : 'starter';
  } catch {
    return 'starter';
  }
}

/**
 * Sets user's selected deck preference ('starter' or 'custom')
 */
export function setSelectedDeckChoice(choice: DeckChoice): void {
  try {
    localStorage.setItem(DECK_SELECTION_KEY, choice);
  } catch (err) {
    console.warn('Failed to save deck choice to localStorage:', err);
  }
}
