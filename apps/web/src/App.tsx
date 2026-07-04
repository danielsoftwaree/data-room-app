import { useEffect, useState } from 'react';
import type { HealthResponse } from '@repo/contracts';
import { EmptyState } from '@repo/ui';

export default function App() {
  const [apiStatus, setApiStatus] = useState<string>('checking...');

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d: HealthResponse) => setApiStatus(d.status))
      .catch(() => setApiStatus('api unreachable'));
  }, []);

  return (
    <main style={{ fontFamily: 'sans-serif', padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <h1>Data Room</h1>
      <p style={{ color: '#6b7280', fontSize: 13 }}>API health: {apiStatus}</p>
      <EmptyState
        title="No datarooms yet"
        description="Dataroom creation is the next feature to land here."
      />
    </main>
  );
}
