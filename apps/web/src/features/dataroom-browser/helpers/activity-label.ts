import type { ActivityDto } from '@repo/api-client';

const ACTION_LABELS: Record<ActivityDto['action'], string> = {
  'dataroom.created': 'Data room created',
  'folder.created': 'Folder created',
  'file.uploaded': 'File uploaded',
  'node.renamed': 'Renamed',
  'node.moved': 'Moved',
  'node.deleted': 'Deleted',
  'node.restored': 'Restored',
  'member.added': 'Member added',
  'member.removed': 'Member removed',
  'member.updated': 'Member updated',
  'share.created': 'Shared via link',
  'share.removed': 'Share link removed',
};

/** Human-readable label for an activity entry, with the affected node name when present. */
export function activityLabel(entry: ActivityDto): string {
  return entry.nodeName
    ? `${ACTION_LABELS[entry.action]} - ${entry.nodeName}`
    : ACTION_LABELS[entry.action];
}
