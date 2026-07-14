import type { NodeDto } from '@repo/api-client';
import type { DataroomNode } from '@repo/domain';

/**
 * Maps a transport NodeDto (orval-generated: non-discriminated `type`, optional
 * `size`) to the domain's discriminated `DataroomNode` union, so feature code
 * and the pure @repo/domain helpers work against a single, precise model.
 */
export function toDataroomNode(dto: NodeDto): DataroomNode {
  const base = {
    id: dto.id,
    dataroomId: dto.dataroomId,
    parentId: dto.parentId,
    name: dto.name,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    createdBy: dto.createdBy,
    updatedBy: dto.updatedBy,
    deletedAt: dto.deletedAt,
    deletedBy: dto.deletedBy,
    shareSlug: dto.shareSlug ?? null,
  };
  return dto.type === 'folder'
    ? { ...base, type: 'folder' }
    : { ...base, type: 'file', size: dto.size ?? 0 };
}
