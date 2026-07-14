import { describe, expect, test } from 'bun:test';
import { UPLOAD } from '@repo/config';
import type { DataroomNode } from '@repo/domain';
import { toDataroomNode } from './api-adapters';
import { validateBrowserSearch } from './browser-search';
import { filterNodes } from './filter-nodes';
import { childrenOf, findNode, folderPath, subtreeCounts } from './node-tree';
import { sortVisibleNodes } from './sort-nodes';
import { partitionUploadFiles } from './upload-validation';

function folder(id: string, parentId: string | null, name = id): DataroomNode {
  return {
    id,
    dataroomId: 'room',
    parentId,
    name,
    type: 'folder',
    createdAt: 1,
    updatedAt: 1,
    createdBy: null,
    updatedBy: null,
    deletedAt: null,
    deletedBy: null,
  };
}

function file(
  id: string,
  parentId: string | null,
  overrides: Partial<{ name: string; size: number; updatedAt: number }> = {},
): DataroomNode {
  return {
    ...folder(id, parentId, overrides.name ?? id),
    type: 'file',
    size: overrides.size ?? 10,
    updatedAt: overrides.updatedAt ?? 1,
  } as DataroomNode;
}

// Root -> A (-> A1, a.pdf), b.pdf
const TREE: DataroomNode[] = [
  folder('A', null),
  folder('A1', 'A'),
  file('a.pdf', 'A'),
  file('b.pdf', null),
];

describe('filterNodes', () => {
  test('narrows to folders, files, or everything', () => {
    expect(filterNodes(TREE, 'folders').map((n) => n.id)).toEqual(['A', 'A1']);
    expect(filterNodes(TREE, 'files').map((n) => n.id)).toEqual(['a.pdf', 'b.pdf']);
    expect(filterNodes(TREE, 'all')).toHaveLength(4);
  });
});

describe('sortVisibleNodes', () => {
  const nodes = [
    file('old.pdf', null, { size: 5, updatedAt: 10 }),
    file('new.pdf', null, { size: 50, updatedAt: 99 }),
    { ...folder('Z', null), updatedAt: 2 },
    { ...folder('a', null), updatedAt: 3 },
  ];

  test('folders always come first, sorted case-insensitively', () => {
    expect(sortVisibleNodes(nodes, 'name', 'asc').map((n) => n.id)).toEqual([
      'a',
      'Z',
      'new.pdf',
      'old.pdf',
    ]);
  });

  test('the chosen key orders both groups, folders still first', () => {
    expect(sortVisibleNodes(nodes, 'updated', 'desc').map((n) => n.id)).toEqual([
      'a',
      'Z',
      'new.pdf',
      'old.pdf',
    ]);
    expect(sortVisibleNodes(nodes, 'size', 'asc').map((n) => n.id)).toEqual([
      'Z',
      'a',
      'old.pdf',
      'new.pdf',
    ]);
  });

  test('does not mutate the input', () => {
    const input = [...nodes];
    sortVisibleNodes(input, 'name', 'desc');
    expect(input.map((n) => n.id)).toEqual(nodes.map((n) => n.id));
  });
});

describe('node-tree', () => {
  test('childrenOf resolves root (null) and folder children', () => {
    expect(childrenOf(TREE, null).map((n) => n.id)).toEqual(['A', 'b.pdf']);
    expect(childrenOf(TREE, 'A').map((n) => n.id)).toEqual(['A1', 'a.pdf']);
  });

  test('findNode returns the node or undefined', () => {
    expect(findNode(TREE, 'A1')?.id).toBe('A1');
    expect(findNode(TREE, 'missing')).toBeUndefined();
  });

  test('folderPath walks from the top-most ancestor down to the folder', () => {
    expect(folderPath(TREE, 'A1').map((n) => n.id)).toEqual(['A', 'A1']);
    expect(folderPath(TREE, null)).toEqual([]);
    expect(folderPath(TREE, 'missing')).toEqual([]);
  });

  test('folderPath survives a corrupted parent cycle', () => {
    const cycle = [folder('x', 'y'), folder('y', 'x')];
    expect(folderPath(cycle, 'x').map((n) => n.id)).toEqual(['y', 'x']);
  });

  test('subtreeCounts counts descendants only, not the root', () => {
    expect(subtreeCounts(TREE, 'A')).toEqual({ folders: 1, files: 1 });
    expect(subtreeCounts(TREE, 'A1')).toEqual({ folders: 0, files: 0 });
  });
});

describe('validateBrowserSearch', () => {
  test('keeps trimmed q and select, drops empty and non-string values', () => {
    expect(validateBrowserSearch({ q: '  balance ', select: 'id-1' })).toEqual({
      q: 'balance',
      select: 'id-1',
    });
    expect(validateBrowserSearch({ q: '   ', select: 42 })).toEqual({});
    expect(validateBrowserSearch({})).toEqual({});
  });
});

describe('partitionUploadFiles', () => {
  test('accepts PDFs (case-insensitive), rejects other extensions with a named reason', () => {
    const { accepted, rejected } = partitionUploadFiles([
      new File(['%PDF-'], 'Report.PDF'),
      new File(['plain'], 'notes.txt'),
    ]);
    expect(accepted.map((f) => f.name)).toEqual(['Report.PDF']);
    expect(rejected).toEqual(['notes.txt: only PDF files are allowed']);
  });

  test('rejects a file over the size limit', () => {
    const big = new File([new Uint8Array(UPLOAD.maxFileSizeBytes + 1)], 'big.pdf');
    const { accepted, rejected } = partitionUploadFiles([big]);
    expect(accepted).toEqual([]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toStartWith('big.pdf: larger than');
  });
});

describe('toDataroomNode', () => {
  const base = {
    id: 'n1',
    dataroomId: 'room',
    parentId: null,
    name: 'x',
    createdAt: 1,
    updatedAt: 2,
    createdBy: null,
    updatedBy: null,
    deletedAt: null,
    deletedBy: null,
  };

  test('maps the transport type to the discriminated union', () => {
    const folderNode = toDataroomNode({ ...base, type: 'folder', size: null });
    expect(folderNode.type).toBe('folder');
    expect('size' in folderNode).toBe(false);

    const fileNode = toDataroomNode({ ...base, type: 'file', size: 7 });
    expect(fileNode).toMatchObject({ type: 'file', size: 7 });
  });

  test('a file with a missing size falls back to 0', () => {
    expect(toDataroomNode({ ...base, type: 'file', size: null })).toMatchObject({
      type: 'file',
      size: 0,
    });
  });
});
