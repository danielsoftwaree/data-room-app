import { createFileRoute } from '@tanstack/react-router';
import { DataroomBrowserScreen } from '../features/dataroom-browser';

export const Route = createFileRoute('/_app/datarooms/$dataroomId/')({
  validateSearch,
  component: RouteComponent,
});

function RouteComponent() {
  const { dataroomId } = Route.useParams();
  const { q, select } = Route.useSearch();
  const navigate = Route.useNavigate();

  function handleSearchTermChange(nextTerm: string): void {
    void navigate({ search: nextTerm ? { q: nextTerm } : {}, replace: true });
  }

  return (
    <DataroomBrowserScreen
      dataroomId={dataroomId}
      folderId={null}
      searchTerm={q ?? ''}
      selectNodeId={select ?? null}
      onSearchTermChange={handleSearchTermChange}
      onConsumeSelect={() => void navigate({ search: q ? { q } : {}, replace: true })}
    />
  );
}

interface BrowserSearch {
  q?: string;
  select?: string;
}

function validateSearch(search: Record<string, unknown>): BrowserSearch {
  const q = typeof search.q === 'string' ? search.q.trim() : '';
  const select = typeof search.select === 'string' ? search.select : '';
  return { ...(q ? { q } : {}), ...(select ? { select } : {}) };
}
