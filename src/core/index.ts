/**
 * Framework-agnostic core API.
 *
 * Imported by the vanilla, Vue, Svelte, and MCP entries. Anything that
 * doesn't need React lives here.
 */

export * from '../types';
export { Recorder } from './recorder';
export { buildReport, mergeStreams, reclassifyComment } from './reporter';
export { extractIntent, describeIntent } from './intent';
export { resolveReference } from './resolver';
export { detectTokenSystem, translateValue, translateStyles } from './tokens';
export { findSource, findReactSource, findVueSource, findSvelteSource, formatSource } from './source';
export { captureElement, captureViewport } from './vision';
export {
  exportAgent,
  exportPrompt,
  exportMarkdown,
  exportJson,
} from './exporters';
export { serializeTape, parseTape, downloadTape, uploadTape } from './persist';
export { createReplay, type ReplayController, type ReplayStep } from './replay';
export { verifyReport } from './verify';
export {
  buildSelector,
  pickStyles,
  PICKED_STYLE_PROPS,
  directText,
  diffStyles,
  findBySelector,
  isIgnored,
  isBrowser,
} from './utils';
