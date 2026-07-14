import { describe, expect, test } from 'bun:test';
import type { DataroomNode, NodeType } from './index';
import {
  collectSubtreeIds,
  isNameTaken,
  NODE_NAME_MAX_LENGTH,
  nextAvailableName,
  roleAtLeast,
  selectTrashRoots,
  sortNodes,
  validateMoveTarget,
  validateNodeName,
} from './index';

describe('validateNodeName', () => {
  test('accepts a normal name and trims whitespace', () => {
    expect(validateNodeName('  report.pdf  ')).toEqual({ ok: true, name: 'report.pdf' });
  });

  test('rejects empty and whitespace-only names', () => {
    expect(validateNodeName('')).toEqual({ ok: false, error: 'empty' });
    expect(validateNodeName('   ')).toEqual({ ok: false, error: 'empty' });
  });

  test('accepts a name at the max length and rejects one over it', () => {
    expect(validateNodeName('a'.repeat(NODE_NAME_MAX_LENGTH)).ok).toBe(true);
    expect(validateNodeName('a'.repeat(NODE_NAME_MAX_LENGTH + 1))).toEqual({
      ok: false,
      error: 'too-long',
    });
  });

  test('rejects every forbidden character', () => {
    const forbidden = ['\\', '/', ':', '*', '?', '"', '<', '>', '|'];
    for (const char of forbidden) {
      expect(validateNodeName(`file${char}name`)).toEqual({ ok: false, error: 'invalid-chars' });
    }
  });
});

describe('nextAvailableName', () => {
  test('returns the desired name when it is free', () => {
    expect(nextAvailableName(['other.pdf'], 'file.pdf')).toBe('file.pdf');
  });

  test('appends (1) before the extension on conflict', () => {
    expect(nextAvailableName(['file.pdf'], 'file.pdf')).toBe('file (1).pdf');
  });

  test('skips suffixes that are already taken', () => {
    expect(nextAvailableName(['file.pdf', 'file (1).pdf'], 'file.pdf')).toBe('file (2).pdf');
  });

  test('is case-insensitive', () => {
    expect(nextAvailableName(['FILE.PDF'], 'file.pdf')).toBe('file (1).pdf');
  });

  test('handles names without an extension', () => {
    expect(nextAvailableName(['reports'], 'reports')).toBe('reports (1)');
  });

  test('treats a leading dot as part of the name, not an extension', () => {
    expect(nextAvailableName(['.env'], '.env')).toBe('.env (1)');
  });
});

describe('isNameTaken', () => {
  test('matches case-insensitively', () => {
    expect(isNameTaken(['Report.PDF'], 'report.pdf')).toBe(true);
  });

  test('trims the candidate before comparing', () => {
    expect(isNameTaken(['report.pdf'], '  report.pdf  ')).toBe(true);
  });

  test('returns false when the name is free', () => {
    expect(isNameTaken(['a.pdf'], 'b.pdf')).toBe(false);
  });
});

describe('sortNodes', () => {
  test('folders first, then files, each alphabetically (case-insensitive)', () => {
    const input: { type: NodeType; name: string }[] = [
      { type: 'file', name: 'b.pdf' },
      { type: 'folder', name: 'Zeta' },
      { type: 'file', name: 'A.pdf' },
      { type: 'folder', name: 'alpha' },
    ];
    expect(sortNodes(input).map((n) => n.name)).toEqual(['alpha', 'Zeta', 'A.pdf', 'b.pdf']);
  });

  test('does not mutate the input array', () => {
    const input: { type: NodeType; name: string }[] = [
      { type: 'file', name: 'b.pdf' },
      { type: 'folder', name: 'a' },
    ];
    sortNodes(input);
    expect(input[0]).toEqual({ type: 'file', name: 'b.pdf' });
  });
});

describe('collectSubtreeIds', () => {
  const nodes = [
    { id: 'root', parentId: null },
    { id: 'a', parentId: 'root' },
    { id: 'b', parentId: 'a' },
    { id: 'c', parentId: 'root' },
    { id: 'other', parentId: null },
  ];

  test('collects the node and all of its descendants', () => {
    expect([...collectSubtreeIds(nodes, 'root')].sort()).toEqual(['a', 'b', 'c', 'root']);
  });

  test('a leaf collects only itself', () => {
    expect(collectSubtreeIds(nodes, 'b')).toEqual(['b']);
  });

  test('does not include unrelated top-level nodes', () => {
    expect(collectSubtreeIds(nodes, 'root')).not.toContain('other');
  });
});

describe('roleAtLeast', () => {
  test('owner satisfies every threshold', () => {
    expect(roleAtLeast('owner', 'owner')).toBe(true);
    expect(roleAtLeast('owner', 'editor')).toBe(true);
    expect(roleAtLeast('owner', 'viewer')).toBe(true);
  });

  test('editor satisfies editor and viewer but not owner', () => {
    expect(roleAtLeast('editor', 'owner')).toBe(false);
    expect(roleAtLeast('editor', 'editor')).toBe(true);
    expect(roleAtLeast('editor', 'viewer')).toBe(true);
  });

  test('viewer satisfies only viewer', () => {
    expect(roleAtLeast('viewer', 'editor')).toBe(false);
    expect(roleAtLeast('viewer', 'viewer')).toBe(true);
  });
});

describe('selectTrashRoots', () => {
  const trashed = (id: string, parentId: string | null, deletedAt: number | null) => ({
    id,
    parentId,
    deletedAt,
  });

  test('returns only top-level trashed nodes, not their trashed descendants', () => {
    const nodes = [
      trashed('folder', null, 100),
      trashed('child', 'folder', 100),
      trashed('grandchild', 'child', 100),
    ];
    expect(selectTrashRoots(nodes).map((n) => n.id)).toEqual(['folder']);
  });

  test('a trashed node whose parent is still live counts as a root', () => {
    const nodes = [trashed('live-parent', null, null), trashed('trashed-child', 'live-parent', 200)];
    expect(selectTrashRoots(nodes).map((n) => n.id)).toEqual(['trashed-child']);
  });

  test('ignores live nodes entirely', () => {
    const nodes = [trashed('a', null, null), trashed('b', null, 5)];
    expect(selectTrashRoots(nodes).map((n) => n.id)).toEqual(['b']);
  });

  test('surfaces every independently-trashed root across datarooms', () => {
    const nodes = [trashed('r1', null, 1), trashed('r2', null, 2), trashed('c1', 'r1', 1)];
    expect(selectTrashRoots(nodes).map((n) => n.id).sort()).toEqual(['r1', 'r2']);
  });
});

describe('validateMoveTarget', () => {
  const nodes: DataroomNode[] = [
    node({ id: 'folder-a', parentId: null, type: 'folder' }),
    node({ id: 'folder-b', parentId: 'folder-a', type: 'folder' }),
    node({ id: 'folder-c', parentId: null, type: 'folder' }),
    node({ id: 'file-a', parentId: 'folder-a', type: 'file' }),
    node({ id: 'other-folder', dataroomId: 'other', parentId: null, type: 'folder' }),
  ];

  test('allows moving to the root', () => {
    expect(validateMoveTarget(nodes, 'file-a', null)).toEqual({ ok: true, parentId: null });
  });

  test('allows moving to a folder in the same data room', () => {
    expect(validateMoveTarget(nodes, 'file-a', 'folder-c')).toEqual({
      ok: true,
      parentId: 'folder-c',
    });
  });

  test('rejects moving into itself or a descendant', () => {
    expect(validateMoveTarget(nodes, 'folder-a', 'folder-a')).toEqual({
      ok: false,
      error: 'target-is-self',
    });
    expect(validateMoveTarget(nodes, 'folder-a', 'folder-b')).toEqual({
      ok: false,
      error: 'target-is-descendant',
    });
  });

  test('rejects missing, file, and cross-room targets', () => {
    expect(validateMoveTarget(nodes, 'missing', null)).toEqual({
      ok: false,
      error: 'node-not-found',
    });
    expect(validateMoveTarget(nodes, 'folder-a', 'missing')).toEqual({
      ok: false,
      error: 'target-not-found',
    });
    expect(validateMoveTarget(nodes, 'folder-a', 'file-a')).toEqual({
      ok: false,
      error: 'target-not-folder',
    });
    expect(validateMoveTarget(nodes, 'folder-a', 'other-folder')).toEqual({
      ok: false,
      error: 'target-cross-dataroom',
    });
  });
});

function node(input: {
  id: string;
  dataroomId?: string;
  parentId: string | null;
  type: NodeType;
}): DataroomNode {
  const base = {
    id: input.id,
    dataroomId: input.dataroomId ?? 'room',
    parentId: input.parentId,
    name: input.id,
    createdAt: 1,
    updatedAt: 1,
    createdBy: null,
    updatedBy: null,
    deletedAt: null,
    deletedBy: null,
  };
  return input.type === 'folder'
    ? { ...base, type: 'folder' }
    : { ...base, type: 'file', size: 1, shareSlug: null };
}
