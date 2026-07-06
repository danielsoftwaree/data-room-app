import type { ViewMode } from '@/shared/store/ui-store';

/** Toolbar filter over the current folder's children. */
export type FilterMode = 'all' | 'folders' | 'files';

/** Column the browser sorts by. */
export type SortKey = 'name' | 'updated' | 'size';

/** Sort direction toggle. */
export type SortDir = 'asc' | 'desc';

// The list/grid switch is a persisted UI preference; reuse the store's type
// instead of redeclaring it here (one fact, one place).
export type { ViewMode };
