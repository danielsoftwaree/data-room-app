import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Single source of truth for client-side UI preferences (theme, list/grid view).
 * Server state stays in TanStack Query; this store only holds view-layer prefs.
 *
 * Persisted to localStorage under `dataroom-ui` (one JSON blob). The pre-paint
 * script in index.html reads the same blob so the theme applies before first
 * paint (no flash of the wrong theme).
 */
export type Theme = 'light' | 'dark';
export type ViewMode = 'list' | 'grid';

export const UI_STORAGE_KEY = 'dataroom-ui';

interface UiState {
  theme: Theme;
  view: ViewMode;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setView: (view: ViewMode) => void;
}

/** Toggle the `.dark` class on <html>; the only DOM side effect of the theme. */
function applyThemeClass(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

/**
 * One-time bridge from the old standalone keys (`theme`, `dataroom-view`) so a
 * returning user keeps their preferences on the first load after this change.
 * Only consulted when no `dataroom-ui` blob exists yet.
 */
function legacyDefaults(): Pick<UiState, 'theme' | 'view'> {
  if (typeof localStorage === 'undefined') return { theme: 'light', view: 'list' };
  return {
    theme: localStorage.getItem('theme') === 'dark' ? 'dark' : 'light',
    view: localStorage.getItem('dataroom-view') === 'grid' ? 'grid' : 'list',
  };
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      ...legacyDefaults(),
      setTheme: (theme) => {
        applyThemeClass(theme);
        set({ theme });
      },
      toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
      setView: (view) => set({ view }),
    }),
    {
      name: UI_STORAGE_KEY,
      // Re-apply the theme class after the persisted state is restored.
      onRehydrateStorage: () => (state) => {
        if (state) applyThemeClass(state.theme);
      },
    },
  ),
);
