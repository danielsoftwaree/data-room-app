/**
 * Dev-only mock API gate. In production this is a no-op and the MSW/faker code
 * is never fetched (dynamic import lives behind the DEV guard).
 */
export async function enableMocking(): Promise<void> {
  if (!import.meta.env.DEV) return;
  if (import.meta.env.VITE_ENABLE_MOCKS === 'false') return;

  const { worker } = await import('./browser');
  const { initStore, resetStore } = await import('./db');

  // Hydrate the store from IndexedDB (or seed it) before any request can be
  // served, so files uploaded in previous sessions keep opening.
  await initStore();

  // Tester/e2e escape hatch: reset mock data from the console or a test,
  // then reload the page to re-render from the pristine seeds.
  window.__dataroomMocks = { reset: resetStore };

  await worker.start({ onUnhandledRequest: 'bypass' });
}

declare global {
  interface Window {
    /** Dev-mock helpers (defined only while mocking is enabled). */
    __dataroomMocks?: { reset: () => Promise<void> };
  }
}
