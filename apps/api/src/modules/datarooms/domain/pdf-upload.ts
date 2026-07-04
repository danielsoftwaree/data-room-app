import { UPLOAD } from '@repo/config';

export interface PdfUploadInput {
  originalName: string;
  contentType: string;
  size: number;
  content: Uint8Array;
}

export type PdfUploadError = 'missing' | 'empty' | 'too-large' | 'unsupported-type';

export type PdfUploadResult =
  { ok: true; upload: PdfUpload } | { ok: false; error: PdfUploadError };

export class PdfUpload {
  private constructor(
    readonly originalName: string,
    readonly size: number,
    readonly content: Uint8Array,
    readonly contentType: string,
  ) {}

  static from(input: PdfUploadInput | undefined): PdfUploadResult {
    if (!input) return { ok: false, error: 'missing' };
    if (input.size <= 0) return { ok: false, error: 'empty' };
    if (input.size > UPLOAD.maxFileSizeBytes) return { ok: false, error: 'too-large' };

    const acceptedMimeTypes: readonly string[] = UPLOAD.acceptedMimeTypes;
    const acceptedExtensions: readonly string[] = UPLOAD.acceptedExtensions;
    const lowerName = input.originalName.toLowerCase();
    const hasAcceptedMime = acceptedMimeTypes.includes(input.contentType);
    const hasAcceptedExtension = acceptedExtensions.some((extension) =>
      lowerName.endsWith(extension),
    );

    if (!hasAcceptedMime || !hasAcceptedExtension || !hasPdfSignature(input.content)) {
      return { ok: false, error: 'unsupported-type' };
    }

    return {
      ok: true,
      upload: new PdfUpload(input.originalName, input.size, input.content, input.contentType),
    };
  }
}

function hasPdfSignature(content: Uint8Array): boolean {
  return (
    content.length >= 5 &&
    content[0] === 0x25 &&
    content[1] === 0x50 &&
    content[2] === 0x44 &&
    content[3] === 0x46 &&
    content[4] === 0x2d
  );
}
