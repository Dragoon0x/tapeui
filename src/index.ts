/**
 * usetapeui — main React entry.
 *
 *   import { Tape, useTape } from 'usetapeui';
 *
 * For framework-free use:
 *
 *   import { Tape } from 'usetapeui/vanilla';
 *
 * For Vue / Svelte:
 *
 *   import { Tape } from 'usetapeui/vue';
 *   import { Tape } from 'usetapeui/svelte';
 *
 * For just the core (no UI, no framework):
 *
 *   import { Recorder, buildReport, exportAgent } from 'usetapeui/core';
 */

export { Tape, DEFAULTS, type TapeProps } from './components/Tape';
export { useTape, type UseTapeReturn } from './hooks/useTape';

// Re-export the core API so consumers don't need a second import.
export type {
  ClickMarker,
  Comment,
  CritiqueReport,
  Intent,
  RecorderState,
  Sentiment,
  SourceInfo,
  TapeConfig,
  TapeFile,
  TokenSystem,
  TranscriptSegment,
  VerifyReport,
  VerifyResult,
} from './types';

export {
  Recorder,
  buildReport,
  mergeStreams,
  reclassifyComment,
  extractIntent,
  describeIntent,
  resolveReference,
  detectTokenSystem,
  translateValue,
  translateStyles,
  findSource,
  formatSource,
  captureElement,
  captureViewport,
  exportAgent,
  exportPrompt,
  exportMarkdown,
  exportJson,
  serializeTape,
  parseTape,
  downloadTape,
  uploadTape,
  createReplay,
  verifyReport,
  buildSelector,
  pickStyles,
} from './core';
