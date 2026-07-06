import { UPLOAD } from '@repo/config';
import { formatFileSize } from '@/shared/lib/format';

export interface UploadPartition {
  accepted: File[];
  /** Human-readable rejection lines, e.g. "notes.docx: only PDF files are allowed". */
  rejected: string[];
}

/**
 * Client-side pre-check of picked files against the upload rules (PDF only,
 * size limit). The API enforces the same rules; this only gives instant feedback.
 */
export function partitionUploadFiles(files: readonly File[]): UploadPartition {
  const accepted: File[] = [];
  const rejected: string[] = [];
  for (const file of files) {
    if (!UPLOAD.acceptedExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      rejected.push(`${file.name}: only PDF files are allowed`);
    } else if (file.size > UPLOAD.maxFileSizeBytes) {
      rejected.push(
        `${file.name}: larger than the ${formatFileSize(UPLOAD.maxFileSizeBytes)} limit`,
      );
    } else {
      accepted.push(file);
    }
  }
  return { accepted, rejected };
}
