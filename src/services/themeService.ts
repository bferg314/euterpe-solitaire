import type { ThemeId } from '../types/solitaire';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  description: string;
  bgGradient: string;
  feltOverlay: string;
  accentColor: string;
  railColor: string;
  slotColor: string;
  cardShadow: string;
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  'midnight-velvet': {
    id: 'midnight-velvet',
    name: 'Midnight Velvet',
    description: 'Artisanal emerald baize with warm ambient spotlight and polished brass accents',
    bgGradient: 'radial-gradient(ellipse at 50% 30%, #155e43 0%, #0a3a29 55%, #051d14 100%)',
    feltOverlay: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.04) 0%, transparent 80%)',
    accentColor: '#d4af37',
    railColor: 'rgba(212, 175, 55, 0.25)',
    slotColor: 'rgba(5, 29, 20, 0.45)',
    cardShadow: '0 8px 24px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.3)',
  },
  'obsidian-royale': {
    id: 'obsidian-royale',
    name: 'Obsidian Royale',
    description: 'Luxury deep sapphire-slate with stellar cosmic vignette and radiant gold trim',
    bgGradient: 'radial-gradient(ellipse at 50% 30%, #1e2947 0%, #0f172a 60%, #060913 100%)',
    feltOverlay: 'radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.05) 0%, transparent 75%)',
    accentColor: '#f59e0b',
    railColor: 'rgba(245, 158, 11, 0.25)',
    slotColor: 'rgba(15, 23, 42, 0.55)',
    cardShadow: '0 8px 26px rgba(0, 0, 0, 0.55), 0 3px 8px rgba(0, 0, 0, 0.35)',
  },
  'casino-crimson': {
    id: 'casino-crimson',
    name: 'Casino Crimson',
    description: 'Monte Carlo burgundy cloth with deep mahogany rail trim and champagne accents',
    bgGradient: 'radial-gradient(ellipse at 50% 30%, #63121d 0%, #3e0b12 60%, #1c0508 100%)',
    feltOverlay: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.04) 0%, transparent 80%)',
    accentColor: '#facc15',
    railColor: 'rgba(250, 204, 21, 0.25)',
    slotColor: 'rgba(28, 5, 8, 0.55)',
    cardShadow: '0 8px 24px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.4)',
  },
  'nordic-frost': {
    id: 'nordic-frost',
    name: 'Nordic Frost',
    description: 'Frosted glassmorphism over cool arctic dawn gradient and silver-white accents',
    bgGradient: 'radial-gradient(ellipse at 50% 30%, #334155 0%, #1e293b 60%, #0f172a 100%)',
    feltOverlay: 'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.08) 0%, transparent 80%)',
    accentColor: '#38bdf8',
    railColor: 'rgba(56, 189, 248, 0.25)',
    slotColor: 'rgba(15, 23, 42, 0.4)',
    cardShadow: '0 10px 25px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.25)',
  },
  'cyber-silk': {
    id: 'cyber-silk',
    name: 'Cyber Silk',
    description: 'Neo-noir matte dark cloth with luminous cyber-grid reflections',
    bgGradient: 'radial-gradient(ellipse at 50% 30%, #18182b 0%, #0d0d17 65%, #050508 100%)',
    feltOverlay: 'radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.06) 0%, transparent 75%)',
    accentColor: '#06b6d4',
    railColor: 'rgba(6, 182, 212, 0.3)',
    slotColor: 'rgba(5, 5, 8, 0.6)',
    cardShadow: '0 8px 26px rgba(0, 0, 0, 0.6), 0 0 15px rgba(6, 182, 212, 0.15)',
  },
};

export const THEME_STORAGE_KEY = 'euterpe_solitaire_theme_v1';

export function getSavedTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
    if (saved && saved in THEMES) {
      return saved;
    }
  } catch {
    // fallback
  }
  return 'midnight-velvet';
}

export function saveTheme(themeId: ThemeId): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
  } catch (err) {
    console.warn('Failed to save theme to localStorage:', err);
  }
}

export function applyTheme(themeId: ThemeId): void {
  const config = THEMES[themeId] || THEMES['midnight-velvet'];
  const root = document.documentElement;

  root.style.setProperty('--table-bg', config.bgGradient);
  root.style.setProperty('--felt-overlay', config.feltOverlay);
  root.style.setProperty('--accent-color', config.accentColor);
  root.style.setProperty('--rail-color', config.railColor);
  root.style.setProperty('--slot-bg', config.slotColor);
  root.style.setProperty('--card-shadow', config.cardShadow);
}
