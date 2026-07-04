import type { PdfUploadInput } from '../domain/pdf-upload';

export interface UploadedFilePayload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export function toPdfUploadInput(
  file: UploadedFilePayload | undefined,
): PdfUploadInput | undefined {
  if (!file) return undefined;
  return {
    originalName: file.originalname,
    contentType: file.mimetype,
    size: file.size,
    content: file.buffer,
  };
}
