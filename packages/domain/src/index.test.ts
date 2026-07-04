import { describe, expect, test } from 'bun:test';
import type { NodeType } from './index';
import {
  collectSubtreeIds,
  isNameTaken,
  NODE_NAME_MAX_LENGTH,
  nextAvailableName,
  sortNodes,
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
