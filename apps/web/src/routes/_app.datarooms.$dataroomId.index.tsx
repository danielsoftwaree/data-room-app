import { createFileRoute } from '@tanstack/react-router';
import { DataroomBrowserScreen } from '../features/dataroom-browser';

export const Route = createFileRoute('/_app/datarooms/$dataroomId/')({
  validateSearch,
  component: RouteComponent,
});

function RouteComponent() {
  const { dataroomId } = Route.useParams();
  const { q } = Route.useSearch();
  const navigate = Route.useNavigate();

  function handleSearchTermChange(nextTerm: string): void {
    void navigate({ search: nextTerm ? { q: nextTerm } : {}, replace: true });
  }

  return (
    <DataroomBrowserScreen
      dataroomId={dataroomId}
      folderId={null}
      searchTerm={q ?? ''}
      onSearchTermChange={handleSearchTermChange}
    />
  );
}

interface BrowserSearch {
  q?: string;
}

function validateSearch(search: Record<string, unknown>): BrowserSearch {
  const q = typeof search.q === 'string' ? search.q.trim() : '';
  return q ? { q } : {};
}
