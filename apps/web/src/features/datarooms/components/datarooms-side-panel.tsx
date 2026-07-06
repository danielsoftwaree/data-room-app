import { Button } from '@repo/ui/components/button';
import { MousePointerClickIcon, PlusIcon, SparklesIcon } from 'lucide-react';
import { StorageUsageCard } from '@/shared/components/storage-usage-card';
import { useCreateSampleDataroom } from '../hooks/use-dataroom-mutations.mutation';

/** Dashboard side column: get-started actions, storage usage, usage tips. */
export function DataroomsSidePanel({ onCreate }: Readonly<{ onCreate: () => void }>) {
  const createSample = useCreateSampleDataroom();

  return (
    <aside className="flex flex-col gap-4">
      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Get started</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Spin up a new space or explore a realistic sample.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <Button onClick={onCreate}>
            <PlusIcon className="size-4" />
            New data room
          </Button>
          <Button
            variant="outline"
            disabled={createSample.isPending}
            onClick={() => createSample.mutate()}
          >
            <SparklesIcon className="size-4" />
            {createSample.isPending ? 'Creating sample…' : 'Create sample'}
          </Button>
        </div>
      </div>

      <StorageUsageCard className="rounded-xl border bg-card p-5" />

      <div className="rounded-xl border bg-card p-5">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <MousePointerClickIcon className="size-4 text-muted-foreground" />
          Tips
        </div>
        <ul className="flex flex-col gap-2 text-xs text-muted-foreground">
          <li className="flex gap-2">
            <span className="text-primary">•</span> Right-click any file or folder for quick
            actions.
          </li>
          <li className="flex gap-2">
            <span className="text-primary">•</span> Tick the checkbox to select several items at
            once.
          </li>
          <li className="flex gap-2">
            <span className="text-primary">•</span> Star a room to pin it to your sidebar.
          </li>
        </ul>
      </div>
    </aside>
  );
}
