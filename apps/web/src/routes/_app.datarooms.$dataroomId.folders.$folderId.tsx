import { createFileRoute } from '@tanstack/react-router';
import { DataroomBrowserScreen, validateBrowserSearch } from '@/features/dataroom-browser';

export const Route = createFileRoute('/_app/datarooms/$dataroomId/folders/$folderId')({
  validateSearch: validateBrowserSearch,
  component: RouteComponent,
});

function RouteComponent() {
  const { dataroomId, folderId } = Route.useParams();
  const { q, select } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <DataroomBrowserScreen
      dataroomId={dataroomId}
      folderId={folderId}
      searchTerm={q ?? ''}
      selectNodeId={select ?? null}
      onSearchTermChange={(term) =>
        void navigate({ search: term ? { q: term } : {}, replace: true })
      }
      onConsumeSelect={() => void navigate({ search: q ? { q } : {}, replace: true })}
    />
  );
}
