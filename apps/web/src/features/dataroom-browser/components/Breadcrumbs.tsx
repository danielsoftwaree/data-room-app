import { Fragment } from 'react';
import { Link } from '@tanstack/react-router';
import type { DataroomNode } from '@repo/domain';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@repo/ui/components/breadcrumb';

/** Breadcrumb trail: data-room root followed by the folder ancestor chain. */
export function DataroomBreadcrumbs({
  dataroomId,
  dataroomName,
  path,
}: {
  dataroomId: string;
  dataroomName: string;
  /** Ancestors of the current folder, root-most first, including the current folder. */
  path: readonly DataroomNode[];
}) {
  const atRoot = path.length === 0;
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {atRoot ? (
            <BreadcrumbPage>{dataroomName}</BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <Link to="/datarooms/$dataroomId" params={{ dataroomId }}>
                {dataroomName}
              </Link>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {path.map((folder, index) => {
          const isLast = index === path.length - 1;
          return (
            <Fragment key={folder.id}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{folder.name}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link
                      to="/datarooms/$dataroomId/folders/$folderId"
                      params={{ dataroomId, folderId: folder.id }}
                    >
                      {folder.name}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
