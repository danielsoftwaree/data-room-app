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
    originalName: decodeOriginalName(file.originalname),
    contentType: file.mimetype,
    size: file.size,
    content: file.buffer,
  };
}

/**
 * multer (busboy) decodes multipart filenames as latin1 while browsers send
 * UTF-8, so "Отчёт.pdf" arrives as mojibake. Re-decode as UTF-8 when the raw
 * bytes are valid UTF-8 (a lossless round-trip); ASCII names are unaffected.
 */
function decodeOriginalName(raw: string): string {
  const bytes = Buffer.from(raw, 'latin1');
  const utf8 = bytes.toString('utf8');
  return Buffer.from(utf8, 'utf8').equals(bytes) ? utf8 : raw;
}
