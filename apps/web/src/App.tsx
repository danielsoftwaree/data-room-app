import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getApiErrorMessage,
  getListDataroomsQueryKey,
  useCreateDataroom,
  useGetHealth,
  useListDatarooms,
} from '@repo/api-client';

/**
 * Temporary smoke screen proving the generated, typed API pipeline end to end:
 * api (Nest + swagger) -> openapi.json -> orval -> TanStack Query hooks.
 * Will be replaced by the real Data Room UX.
 */
export function App() {
  const [name, setName] = useState('');
  const queryClient = useQueryClient();
  const health = useGetHealth();
  const datarooms = useListDatarooms();
  const createDataroom = useCreateDataroom({
    mutation: {
      onSuccess: () => {
        setName('');
        void queryClient.invalidateQueries({ queryKey: getListDataroomsQueryKey() });
      },
    },
  });

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 640 }}>
      <h1>Data Room</h1>
      <p>
        API health:{' '}
        {health.isPending ? 'checking…' : health.isError ? 'unreachable' : health.data.data.status}
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim().length === 0) return;
          createDataroom.mutate({ data: { name } });
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New data room name"
          aria-label="New data room name"
        />
        <button type="submit" disabled={createDataroom.isPending}>
          Create
        </button>
      </form>
      {createDataroom.isError ? (
        <p role="alert" style={{ color: 'crimson' }}>
          {getApiErrorMessage(createDataroom.error)}
        </p>
      ) : null}

      {datarooms.isPending ? (
        <p>Loading data rooms…</p>
      ) : datarooms.isError ? (
        <p role="alert">Failed to load data rooms</p>
      ) : datarooms.data.data.length === 0 ? (
        <p>No data rooms yet.</p>
      ) : (
        <ul>
          {datarooms.data.data.map((dataroom) => (
            <li key={dataroom.id}>{dataroom.name}</li>
          ))}
        </ul>
      )}
    </main>
  );
}
