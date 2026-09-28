import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSavedSettings, saveSettings } from './settingsService';

const KEY = 'euterpe_solitaire_comfort_settings_v1';
const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
  });
});

describe('settings', () => {
  it('deals at random by default', () => {
    expect(getSavedSettings().winnableOnly).toBe(false);
  });

  it('turns winnable-only off once for settings saved before it became opt-in, keeping the rest', () => {
    store.set(
      KEY,
      JSON.stringify({ ambientVacuumEnabled: false, smartTapEnabled: true, keyboardHintSeen: true, winnableOnly: true })
    );
    expect(getSavedSettings()).toEqual({
      ambientVacuumEnabled: false,
      smartTapEnabled: true,
      keyboardHintSeen: true,
      winnableOnly: false,
    });
  });

  it('keeps winnable-only on when the player turns it on again', () => {
    saveSettings({ ...getSavedSettings(), winnableOnly: true });
    expect(getSavedSettings().winnableOnly).toBe(true);
  });
});
