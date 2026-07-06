import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@repo/ui/globals.css';
import { App } from './app/app';
import { AppProviders } from './app/providers';
import { enableMocking } from './mocks/enable';

void enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProviders>
        <App />
      </AppProviders>
    </StrictMode>,
  );
});
