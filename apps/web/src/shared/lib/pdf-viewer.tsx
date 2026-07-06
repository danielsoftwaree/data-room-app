/**
 * Shared react-pdf (pdf.js) setup: the worker is bundled by Vite via `?url`,
 * and the text-layer CSS is imported once here. Consumers render pages through
 * the re-exported PdfDocument/PdfPage.
 */
import { pdfjs } from 'react-pdf';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export { Document as PdfDocument, Page as PdfPage } from 'react-pdf';
