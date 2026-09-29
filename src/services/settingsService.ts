export interface ParlorComfortSettings {
  ambientVacuumEnabled: boolean;
  smartTapEnabled: boolean;
  keyboardHintSeen: boolean;
  /** Only deal games that can be won (Pyramid today; Klondike once its solver lands). Off: random deals, like a real deck. */
  winnableOnly: boolean;
}

// Bumped when a default changes and saved settings should pick it up once.
// 2: "Winnable deals only" went from on to off by default.
const SETTINGS_VERSION = 2;

const SETTINGS_STORAGE_KEY = 'euterpe_solitaire_comfort_settings_v1';

const DEFAULT_SETTINGS: ParlorComfortSettings = {
  ambientVacuumEnabled: true,
  smartTapEnabled: true,
  keyboardHintSeen: false,
  winnableOnly: false,
};

export function getSavedSettings(): ParlorComfortSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    const outdated = typeof parsed.version !== 'number' || parsed.version < SETTINGS_VERSION;
    return {
      ambientVacuumEnabled:
        typeof parsed.ambientVacuumEnabled === 'boolean'
          ? parsed.ambientVacuumEnabled
          : DEFAULT_SETTINGS.ambientVacuumEnabled,
      smartTapEnabled:
        typeof parsed.smartTapEnabled === 'boolean'
          ? parsed.smartTapEnabled
          : DEFAULT_SETTINGS.smartTapEnabled,
      keyboardHintSeen:
        typeof parsed.keyboardHintSeen === 'boolean'
          ? parsed.keyboardHintSeen
          : DEFAULT_SETTINGS.keyboardHintSeen,
      winnableOnly:
        !outdated && typeof parsed.winnableOnly === 'boolean'
          ? parsed.winnableOnly
          : DEFAULT_SETTINGS.winnableOnly,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: ParlorComfortSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...settings, version: SETTINGS_VERSION }));
  } catch (e) {
    console.warn('Failed to save comfort settings to localStorage:', e);
  }
}
