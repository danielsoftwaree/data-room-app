import { useRef, useState } from 'react';
import { getApiErrorMessage } from '@repo/api-client';
import { toast } from '@repo/ui/components/sonner';
import { partitionUploadFiles } from '../helpers/upload-validation';
import type { useNodeMutations } from './use-node-mutations.mutation';

interface UseFileUploadOptions {
  dataroomId: string;
  folderId: string | null;
  /** The shared createFile mutation from {@link useNodeMutations}. */
  createFile: ReturnType<typeof useNodeMutations>['createFile'];
}

/**
 * Multi-file PDF upload into the current folder: client-side validation,
 * sequential upload with per-file placeholder rows, and a partial-failure
 * report (every rejected/failed file gets its own line in one error toast).
 */
export function useFileUpload({ dataroomId, folderId, createFile }: UseFileUploadOptions) {
  const [uploadingNames, setUploadingNames] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(fileList: FileList | File[]): Promise<void> {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    const { accepted, rejected } = partitionUploadFiles(files);
    const failures = [...rejected];
    setUploadingNames(accepted.map((file) => file.name));
    let succeeded = 0;
    for (const file of accepted) {
      try {
        await createFile.mutateAsync({ id: dataroomId, data: { parentId: folderId, file } });
        succeeded += 1;
      } catch (error) {
        failures.push(`${file.name}: ${getApiErrorMessage(error)}`);
      }
      setUploadingNames((names) => names.filter((name) => name !== file.name));
    }
    if (succeeded > 0) toast.success(`${succeeded} file(s) uploaded`);
    if (failures.length > 0) toast.error(failures.slice(0, 5).join('\n'));
  }

  return {
    uploadingNames,
    isUploading: uploadingNames.length > 0,
    inputRef,
    openFilePicker: () => inputRef.current?.click(),
    uploadFiles,
  };
}
