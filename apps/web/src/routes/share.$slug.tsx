import { createFileRoute } from '@tanstack/react-router';
import { PublicShareScreen } from '@/features/public-share';

// Top-level route, deliberately OUTSIDE the `_app` shell: no sidebar and no
// auth — a share link must open for an unauthenticated external viewer.
export const Route = createFileRoute('/share/$slug')({
  component: SharePage,
});

function SharePage() {
  const { slug } = Route.useParams();
  return <PublicShareScreen slug={slug} />;
}
