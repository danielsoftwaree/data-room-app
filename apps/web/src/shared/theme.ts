import { useSyncExternalStore } from 'react';

/**
 * Minimal theme store. index.html applies the initial `.dark` class before
 * first paint; this module toggles it afterwards and lets React subscribe.
 */
const listeners = new Set<() => void>();

export function isDarkTheme(): boolean {
  return document.documentElement.classList.contains('dark');
}

export function setDarkTheme(dark: boolean): void {
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  for (const listener of listeners) listener();
}

export function useDarkTheme(): boolean {
  return useSyncExternalStore(subscribe, isDarkTheme);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
