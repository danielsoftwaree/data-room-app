// Re-export the shared generator so the mock store keeps its ./pdf import while
// the implementation lives in ../shared (usable from prod code too).
export { makePdfBytes } from '../shared/pdf';
