import { Button } from '@repo/ui/components/button';
import { EmptyState } from '@repo/ui/components/empty-state';
import { FilterIcon, UploadIcon, XIcon } from 'lucide-react';
import type { FilterMode } from '../types';

interface BrowserEmptyStateProps {
  isSearchActive: boolean;
  activeSearch: string;
  filter: FilterMode;
  /** Whether the folder has items at all (empty only because of the filter). */
  hasChildren: boolean;
  canEdit: boolean;
  onClearSearch: () => void;
  onClearFilter: () => void;
  onUpload: () => void;
}

/** Explains WHY the list is empty: no search hits, filtered out, or a truly empty folder. */
export function BrowserEmptyState({
  isSearchActive,
  activeSearch,
  filter,
  hasChildren,
  canEdit,
  onClearSearch,
  onClearFilter,
  onUpload,
}: Readonly<BrowserEmptyStateProps>) {
  if (isSearchActive) {
    return (
      <EmptyState
        title={`No results for "${activeSearch}"`}
        description="Try a shorter name fragment, or clear the search to see everything."
        action={
          <Button variant="outline" onClick={onClearSearch}>
            <XIcon className="size-4" />
            Clear search
          </Button>
        }
      />
    );
  }
  if (filter !== 'all' && hasChildren) {
    return (
      <EmptyState
        title={`No ${filter} here`}
        description={`This folder has items, but none match the "${filter}" filter.`}
        action={
          <Button variant="outline" onClick={onClearFilter}>
            <FilterIcon className="size-4" />
            Clear filter
          </Button>
        }
      />
    );
  }
  return (
    <EmptyState
      title="This folder is empty"
      description={
        canEdit ? 'Create a subfolder or upload PDF files.' : 'Nothing has been added here yet.'
      }
      action={
        canEdit ? (
          <Button onClick={onUpload}>
            <UploadIcon className="size-4" />
            Upload PDF
          </Button>
        ) : undefined
      }
    />
  );
}
