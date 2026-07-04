export function createPdfBuffer(body = 'test pdf'): Buffer {
  return Buffer.from(`%PDF-1.4\n${body}\n%%EOF`);
}
