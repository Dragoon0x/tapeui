/**
 * usetapeui v1.0 — type definitions
 *
 * The data model is the contract every module respects.
 * If you change a type here, the change ripples to recorder, reporter,
 * exporters, persist, MCP server, and the React/Vanilla/Vue/Svelte adapters.
 */

export type Sentiment = 'issue' | 'positive' | 'question' | 'note';

/** A click on the page during a recording. Captured as it happens. */
export interface ClickMarker {
  /** Time relative to recording start, in ms. */
  t: number;
  /** Stable selector chain for the clicked element. */
  selector: string;
  /** HTML tag name, lowercased. */
  tag: string;
  /** First 100 chars of direct text content. */
  text: string;
  /** Bounding rect at click time. */
  rect: { x: number; y: number; w: number; h: number };
  /** Computed style snapshot. Map of property → value. */
  styles: Record<string, string>;
  /** Optional cropped screenshot of the element as a data URL. */
  screenshot?: string | null;
  /** Optional source location from React/Vue/Svelte fiber walk. */
  source?: SourceInfo | null;
  /** Class list of the element. */
  classes: string[];
  /** id attribute, if present. */
  id?: string | null;
  /** ARIA role, if present. */
  role?: string | null;
}

/** A timestamped chunk of speech. */
export interface TranscriptSegment {
  /** Start time relative to recording start, in ms. */
  t: number;
  /** Duration in ms, best-effort. */
  duration: number;
  /** Final transcript text for this segment. */
  text: string;
  /** True if confidence ≥ threshold (0.7 by default). */
  final: boolean;
  /** Speech recognition confidence 0..1. */
  confidence: number;
}

/** A merged comment: one click paired with its matching transcript. */
export interface Comment {
  /** Stable id for editor operations. */
  id: string;
  /** Time on the recording timeline. */
  t: number;
  /** Comment author text (post-merge). */
  text: string;
  /** Click marker, if this comment has one. */
  marker: ClickMarker | null;
  /** Sentiment classification. */
  sentiment: Sentiment;
  /** Structured intent extraction. */
  intent: Intent;
  /** Reference resolution result (which click index this text refers to). */
  resolvedTargetIndex: number | null;
  /** True if user edited the comment in the editor. */
  edited: boolean;
}

/** Structured intent extracted from comment text. */
export interface Intent {
  /** What the user wants done. */
  action: 'change' | 'add' | 'remove' | 'keep' | 'question' | 'unknown';
  /** Which CSS-ish attribute is involved, if any. */
  attribute: string | null;
  /** Direction of change. */
  direction: 'increase' | 'decrease' | 'fix' | 'replace' | null;
  /** Subjective magnitude. */
  magnitude: 'small' | 'medium' | 'large' | null;
  /** True if a numeric value was extracted. */
  hasValue: boolean;
  /** Extracted numeric value (with unit) if any. */
  value: string | null;
  /** Original text. */
  raw: string;
}

/** Source location from a framework fiber walk. */
export interface SourceInfo {
  framework: 'react' | 'vue' | 'svelte' | 'unknown';
  componentName: string | null;
  fileName: string | null;
  lineNumber: number | null;
  columnNumber: number | null;
}

/** Detected design system context. */
export interface TokenSystem {
  /** Detected token vocabulary. */
  type: 'tailwind' | 'css-vars' | 'mixed' | 'none';
  /** Px → tailwind spacing scale. */
  spacing: Record<string, string>;
  /** Color string → token name. */
  colors: Record<string, string>;
  /** Px font-size → tailwind text class. */
  typography: Record<string, string>;
  /** computed value → CSS variable name. */
  cssVars: Record<string, string>;
  /** True if Tailwind is detected. */
  tailwindDetected: boolean;
  /** True if any CSS custom properties are defined on :root. */
  cssVarsDetected: boolean;
}

/** Final report produced when a recording is stopped. */
export interface CritiqueReport {
  /** Schema version. Increment on breaking change. */
  version: '1';
  /** ISO timestamp at stop. */
  recordedAt: number;
  /** Duration of recording, ms. */
  duration: number;
  /** Page URL at recording start. */
  url: string;
  /** Page title at recording start. */
  title: string;
  /** User agent string. */
  userAgent: string;
  /** Viewport size at recording start. */
  viewport: { w: number; h: number; dpr: number };
  /** Click markers in order. */
  markers: ClickMarker[];
  /** Raw transcript segments in order. */
  segments: TranscriptSegment[];
  /** Merged comments. */
  comments: Comment[];
  /** Detected token system. */
  tokens: TokenSystem | null;
}

/** Configuration accepted by the React component, vanilla SDK, and adapters. */
export interface TapeConfig {
  /** Keyboard shortcut to toggle the panel. Default 'Alt+T'. */
  shortcut?: string;
  /** Speech recognition language. Default 'en-US'. */
  language?: string;
  /** Selectors to ignore on click. */
  ignoreSelectors?: string[];
  /** z-index for the floating panel. Default 99999. */
  zIndex?: number;
  /** Capture element screenshots on click. Default true. */
  vision?: boolean;
  /** Walk framework fibers to extract component + source file. Default true. */
  sourceLink?: boolean;
  /** Detect design tokens at session start. Default true. */
  tokens?: boolean;
  /** Run intent extraction after merge. Default true. */
  intent?: boolean;
  /** Maximum ms between a transcript segment and a click for them to be merged. Default 3000. */
  mergeWindow?: number;
  /** Auto-open the editor when recording stops. Default false. */
  openEditorOnStop?: boolean;
  /** Callback fired with the final report. */
  onReport?: (report: CritiqueReport) => void;
  /** Callback fired with each click captured live. */
  onClick?: (marker: ClickMarker) => void;
  /** Callback fired with each transcript segment captured live. */
  onSegment?: (segment: TranscriptSegment) => void;
  /** Theme variant for the panel. Default 'dark'. */
  theme?: 'dark' | 'light';
  /** Default panel position. Default 'bottom-right'. */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

/** Persisted .tape file format. */
export interface TapeFile {
  format: 'tape';
  version: '1';
  report: CritiqueReport;
  meta: {
    generator: string;
    generatorVersion: string;
    createdAt: number;
  };
}

/** Result of a verify pass against a saved session. */
export interface VerifyReport {
  /** Original report. */
  source: CritiqueReport;
  /** Per-marker verification results. */
  results: VerifyResult[];
  /** Total markers checked. */
  total: number;
  /** Markers found in current DOM. */
  found: number;
  /** Markers where styles changed since recording. */
  changed: number;
  /** Markers where styles were unchanged. */
  unchanged: number;
  /** Markers no longer in the DOM. */
  missing: number;
}

export interface VerifyResult {
  markerIndex: number;
  selector: string;
  status: 'unchanged' | 'changed' | 'missing';
  /** Diffed properties: { property: { before, after } }. */
  diff: Record<string, { before: string; after: string }>;
}

/** Public recorder lifecycle states. */
export type RecorderState = 'idle' | 'recording' | 'stopping' | 'editing';
