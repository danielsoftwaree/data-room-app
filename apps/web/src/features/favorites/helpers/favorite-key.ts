/**
 * Stable identity for one favorite. `nodeId === null` means the data room
 * itself is starred; a non-null id targets that folder/file.
 */
export function favoriteKey(dataroomId: string, nodeId: string | null): string {
  return `${dataroomId}:${nodeId ?? 'room'}`;
}
