import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getApiErrorMessage,
  getListDataroomsQueryKey,
  useCreateDataroom,
  useGetHealth,
  useListDatarooms,
} from '@repo/api-client';
import { Button } from '@repo/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card';
import { EmptyState } from '@repo/ui/components/empty-state';
import { Input } from '@repo/ui/components/input';
import { Skeleton } from '@repo/ui/components/skeleton';

/**
 * Temporary smoke screen proving the generated, typed API pipeline end to end:
 * api (Nest + swagger) -> openapi.json -> orval -> TanStack Query hooks.
 * Will be replaced by the real Data Room UX.
 */
export function DataroomsScreen() {
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
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Data Room</h1>
        <span className="text-sm text-muted-foreground">
          API:{' '}
          {health.isPending
            ? 'checking…'
            : health.isError
              ? 'unreachable'
              : health.data.data.status}
        </span>
      </header>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim().length === 0) return;
          createDataroom.mutate({ data: { name } });
        }}
      >
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New data room name"
          aria-label="New data room name"
        />
        <Button type="submit" disabled={createDataroom.isPending}>
          Create
        </Button>
      </form>
      {createDataroom.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {getApiErrorMessage(createDataroom.error)}
        </p>
      ) : null}

      {datarooms.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : datarooms.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Failed to load data rooms
        </p>
      ) : datarooms.data.data.length === 0 ? (
        <EmptyState
          title="No data rooms yet"
          description="Create your first data room to get started."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {datarooms.data.data.map((dataroom) => (
            <li key={dataroom.id}>
              <Card>
                <CardHeader>
                  <CardTitle>{dataroom.name}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{dataroom.id}</CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
