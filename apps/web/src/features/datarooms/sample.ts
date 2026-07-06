import {
  addMember,
  createDataroom,
  createFile,
  createFolder,
  getMe,
  listDatarooms,
  listUsers,
} from '@repo/api-client';
import type { Dataroom } from '@repo/domain';
import { nextAvailableName } from '@repo/domain';
import { makePdfBytes } from '@/shared/lib/pdf';

/**
 * "Create sample data room" builds a realistic Acme due-diligence structure by
 * calling the same public endpoints a user would (create data room, folders,
 * upload PDFs). No dedicated seed endpoint: this works identically against the
 * MSW mocks and the real API, and every file is a genuine, openable PDF.
 */
interface SampleFolder {
  name: string;
  folders?: SampleFolder[];
  files?: string[];
}

const SAMPLE_NAME = 'Acme Corp. — Project Titan';

const SAMPLE_ROOT: SampleFolder = {
  name: SAMPLE_NAME,
  files: ['Executive Summary.pdf'],
  folders: [
    {
      name: '01 · Corporate',
      files: ['Certificate of Incorporation.pdf', 'Bylaws.pdf', 'Cap Table.pdf'],
    },
    {
      name: '02 · Financials',
      files: ['FY2025 Budget.pdf'],
      folders: [
        {
          name: 'Statements',
          files: ['FY2024 Income Statement.pdf', 'FY2024 Balance Sheet.pdf'],
        },
      ],
    },
    {
      name: '03 · Legal',
      files: ['NDA.pdf'],
      folders: [{ name: 'Contracts', files: ['Master Services Agreement.pdf'] }],
    },
    {
      name: '04 · HR',
      files: ['Employee Census.pdf'],
    },
  ],
};

export async function createSampleDataroom(): Promise<Dataroom> {
  const existing = (await listDatarooms()).data.map((room) => room.name);
  const name = nextAvailableName(existing, SAMPLE_NAME);
  const room = (await createDataroom({ name })).data;
  await seedMembers(room.id);
  await seedFolder(room.id, null, SAMPLE_ROOT);
  return room;
}

async function seedMembers(dataroomId: string): Promise<void> {
  // The current user is already the room owner (createDataroom adds them), so
  // exclude them here — re-adding an existing member is a 409 that would fail
  // the whole sample after the room was already created.
  const me = (await getMe()).data;
  const users = (await listUsers()).data.filter((user) => user.id !== me.id).slice(0, 4);
  const roles = ['editor', 'viewer', 'viewer', 'viewer'] as const;
  await Promise.all(
    users.map((user, index) => addMember(dataroomId, { userId: user.id, role: roles[index] })),
  );
}

async function seedFolder(
  dataroomId: string,
  parentId: string | null,
  folder: SampleFolder,
): Promise<void> {
  for (const fileName of folder.files ?? []) {
    const bytes = makePdfBytes(fileName.replace(/\.pdf$/i, ''));
    // Cast: TS types Uint8Array over ArrayBufferLike; the File BlobPart wants an ArrayBuffer view.
    const file = new File([bytes as Uint8Array<ArrayBuffer>], fileName, {
      type: 'application/pdf',
    });
    await createFile(dataroomId, { parentId, file });
  }
  for (const child of folder.folders ?? []) {
    const created = (await createFolder(dataroomId, { parentId, name: child.name })).data;
    await seedFolder(dataroomId, created.id, child);
  }
}
