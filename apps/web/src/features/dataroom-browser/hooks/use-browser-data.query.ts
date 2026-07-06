import { useMemo } from 'react';
import {
  useGetDataroom,
  useListActivity,
  useListMembers,
  useListNodes,
  useListUsers,
} from '@repo/api-client';
import { toDataroomNode } from '@/shared/lib/api-adapters';
import { childrenOf, findNode, folderPath } from '@/shared/lib/node-tree';

/**
 * Every server read the browser screen needs, adapted to domain types and
 * derived once: the room's node tree, the current folder's children (or
 * search results while searching), the breadcrumb path, room metadata and the
 * current user's permissions.
 */
export function useBrowserData(dataroomId: string, folderId: string | null, searchTerm: string) {
  const dataroom = useGetDataroom(dataroomId);
  const nodesQuery = useListNodes(dataroomId);
  const activeSearch = searchTerm.trim();
  const isSearchActive = activeSearch.length > 0;
  const searchNodesQuery = useListNodes(
    dataroomId,
    isSearchActive ? { search: activeSearch } : undefined,
    { query: { enabled: isSearchActive } },
  );
  const members = useListMembers(dataroomId);
  const users = useListUsers();
  const recentActivity = useListActivity(dataroomId, { limit: 15 });

  const nodes = useMemo(() => (nodesQuery.data?.data ?? []).map(toDataroomNode), [nodesQuery.data]);
  const searchResults = useMemo(
    () => (searchNodesQuery.data?.data ?? []).map(toDataroomNode),
    [searchNodesQuery.data],
  );
  const usersById = useMemo(
    () => new Map((users.data?.data ?? []).map((user) => [user.id, user] as const)),
    [users.data],
  );
  const path = useMemo(() => folderPath(nodes, folderId), [nodes, folderId]);
  const children = useMemo(() => childrenOf(nodes, folderId), [nodes, folderId]);

  const currentFolder = folderId !== null ? findNode(nodes, folderId) : undefined;
  const myRole = dataroom.data?.data.myRole;

  return {
    nodes,
    children,
    path,
    currentFolder,
    folderMissing: folderId !== null && nodesQuery.isSuccess && !currentFolder,
    isSearchActive,
    activeSearch,
    /** What the list shows: search results while searching, else the folder's children. */
    baseNodes: isSearchActive ? searchResults : children,
    dataroomName: dataroom.data?.data.name ?? 'Data room',
    canEdit: myRole === 'owner' || myRole === 'editor',
    isOwner: myRole === 'owner',
    memberCount: members.data?.data.length ?? 0,
    usersById,
    recentActivity: recentActivity.data?.data ?? [],
    isLoading: dataroom.isPending || nodesQuery.isPending,
    isError: dataroom.isError || nodesQuery.isError || (isSearchActive && searchNodesQuery.isError),
    error: dataroom.error ?? nodesQuery.error ?? (isSearchActive ? searchNodesQuery.error : null),
    refetchNodes: () => void nodesQuery.refetch(),
  };
}
