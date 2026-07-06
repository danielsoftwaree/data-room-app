import { useState } from 'react';
import type { DataroomNode, FileNode } from '@repo/domain';

/** Which modal the browser currently shows — at most one at a time. */
export type BrowserDialog =
  | { kind: 'create-folder' }
  | { kind: 'rename'; node: DataroomNode }
  | { kind: 'move'; targets: DataroomNode[] }
  | { kind: 'members' }
  | { kind: 'viewer'; file: FileNode };

/** One state for all browser modals, so two can never fight over the screen. */
export function useBrowserDialogs() {
  const [dialog, setDialog] = useState<BrowserDialog | null>(null);
  return {
    dialog,
    openCreateFolder: () => setDialog({ kind: 'create-folder' }),
    openRename: (node: DataroomNode) => setDialog({ kind: 'rename', node }),
    openMove: (targets: DataroomNode[]) => setDialog({ kind: 'move', targets }),
    openMembers: () => setDialog({ kind: 'members' }),
    openViewer: (file: FileNode) => setDialog({ kind: 'viewer', file }),
    close: () => setDialog(null),
  };
}
