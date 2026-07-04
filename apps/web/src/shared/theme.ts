/**
 * @deprecated Theme now lives in the unified UI store (`./ui-store`).
 * This thin adapter keeps the old functional API working for any remaining
 * imports; prefer `useUiStore` directly in new code.
 */
import { useUiStore } from './ui-store';

export function isDarkTheme(): boolean {
  return useUiStore.getState().theme === 'dark';
}

export function setDarkTheme(dark: boolean): void {
  useUiStore.getState().setTheme(dark ? 'dark' : 'light');
}

export function useDarkTheme(): boolean {
  return useUiStore((state) => state.theme === 'dark');
}
