import { createFileRoute } from '@tanstack/react-router';
import { DataroomBrowserScreen, validateBrowserSearch } from '@/features/dataroom-browser';

export const Route = createFileRoute('/_app/datarooms/$dataroomId/')({
  validateSearch: validateBrowserSearch,
  component: RouteComponent,
});

function RouteComponent() {
  const { dataroomId } = Route.useParams();
  const { q, select } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <DataroomBrowserScreen
      dataroomId={dataroomId}
      folderId={null}
      searchTerm={q ?? ''}
      selectNodeId={select ?? null}
      onSearchTermChange={(term) =>
        void navigate({ search: term ? { q: term } : {}, replace: true })
      }
      onConsumeSelect={() => void navigate({ search: q ? { q } : {}, replace: true })}
    />
  );
}
