/**
 * Intent extraction: convert free speech into a structured intent object
 * that AI agents can execute against.
 *
 * Pure rules-based. No LLM, no network. Deterministic across runs.
 *
 * The output is intentionally conservative: when we can't confidently classify,
 * we mark the field null rather than guess. The agent gets fewer false signals.
 */

import type { Intent } from '../types';

/* --------------------- vocab tables --------------------- */

const ACTION_VERBS: ReadonlyArray<[Intent['action'], readonly string[]]> = [
  ['keep', ['love', 'great', 'perfect', 'leave', 'nice', 'solid', 'clean', 'beautiful', 'works', 'looks good', 'keep', "don't change"]],
  ['question', ['why', 'should', 'could', 'is this', 'what if', 'how about', 'wondering', 'what about', "shouldn't"]],
  ['add', ['add', 'include', 'put', 'insert', 'introduce', 'append', 'show']],
  ['remove', ['remove', 'delete', 'kill', 'drop', 'get rid', 'hide', 'take out', 'strip']],
  ['change', ['change', 'make', 'update', 'modify', 'set', 'tweak', 'adjust', 'fix', 'rework', 'increase', 'decrease', 'reduce', 'shrink', 'grow', 'bigger', 'smaller', 'too', 'should be', 'needs to be']],
];

const ATTRIBUTES: ReadonlyArray<[string, readonly string[]]> = [
  ['padding', ['padding', 'inner space', 'space inside', 'cramped', 'tight', 'breathe']],
  ['margin', ['margin', 'outer space', 'space around', 'space between']],
  ['gap', ['gap', 'spacing between', 'columns are too close', 'too close together']],
  ['font-size', ['font size', 'text size', 'size of text', 'too big text', 'too small text', 'tiny text', 'huge text', 'readable', 'font bigger', 'font smaller', 'font is bigger', 'font is smaller', 'text bigger', 'text smaller', 'bigger font', 'smaller font', 'larger text', 'smaller text']],
  ['font-weight', ['font weight', 'too bold', 'too thin', 'heavy', 'light', 'thicker', 'thinner', 'bolder']],
  ['line-height', ['line height', 'line spacing', 'leading']],
  ['letter-spacing', ['letter spacing', 'tracking', 'kerning']],
  ['color', ['text color', 'color of text', 'color is', 'color']],
  ['background-color', ['background', 'bg color', 'background color', 'fill']],
  ['border-radius', ['radius', 'rounded', 'corners', 'sharp corners']],
  ['border', ['border', 'outline', 'stroke', 'edge']],
  ['box-shadow', ['shadow', 'drop shadow', 'elevation']],
  ['width', ['width', 'too wide', 'too narrow', 'thin', 'wider', 'narrower']],
  ['height', ['height', 'too tall', 'too short', 'taller', 'shorter']],
  ['opacity', ['opacity', 'transparency', 'faded', 'opaque']],
  ['display', ['layout', 'display', 'flex', 'grid', 'block', 'inline']],
  ['text-align', ['alignment', 'aligned', 'left aligned', 'right aligned', 'centered', 'center it']],
  ['position', ['positioning', 'position', 'absolute', 'sticky', 'fixed', 'sits on top']],
  ['z-index', ['z index', 'stacking', 'on top', 'behind', 'in front']],
];

const DIRECTIONS: ReadonlyArray<[Intent['direction'], readonly string[]]> = [
  ['decrease', ['smaller', 'less', 'reduce', 'reducing', 'lower', 'narrower', 'shorter', 'thinner', 'lighter', 'tighter', 'shrink', 'too much', 'too aggressive', 'too heavy', 'too big', 'too wide', 'too tall', 'too dark', 'minus', 'subtract']],
  ['increase', ['bigger', 'larger', 'more', 'increase', 'higher', 'wider', 'taller', 'thicker', 'darker', 'heavier', 'too small', 'too thin', 'too narrow', 'too short', 'too light', 'too faded', 'plus']],
  ['fix', ['broken', 'wrong', 'fix', 'incorrect', 'off', 'misaligned', 'doesn\'t work', 'busted', 'glitched']],
  ['replace', ['use', 'switch to', 'replace with', 'instead of', 'change to', 'set to']],
];

const MAGNITUDES: ReadonlyArray<[Intent['magnitude'], readonly string[]]> = [
  ['large', ['way', 'much', 'extremely', 'very', 'really', 'super', 'massively', 'completely', 'totally', 'a lot']],
  ['small', ['slightly', 'a bit', 'a touch', 'just', 'tiny', 'a little']],
  ['medium', ['noticeably', 'somewhat', 'moderately']],
];

const VALUE_RX = /(\d+(?:\.\d+)?)\s*(px|rem|em|%|pt|vw|vh|deg)\b/i;

/* --------------------- core extractor --------------------- */

export function extractIntent(text: string): Intent {
  const raw = text.trim();
  const lower = raw.toLowerCase();

  if (!raw) {
    return { action: 'unknown', attribute: null, direction: null, magnitude: null, hasValue: false, value: null, raw };
  }

  // action
  let action: Intent['action'] = 'unknown';
  for (const [act, terms] of ACTION_VERBS) {
    if (terms.some((t) => containsPhrase(lower, t))) {
      action = act;
      break;
    }
  }
  // If we found nothing but text is a complete thought ending with a noun, default to 'change'.
  if (action === 'unknown' && /\b(too|the|this|that|these|those)\b/.test(lower)) {
    action = 'change';
  }

  // attribute
  let attribute: string | null = null;
  for (const [attr, terms] of ATTRIBUTES) {
    if (terms.some((t) => containsPhrase(lower, t))) {
      attribute = attr;
      break;
    }
  }

  // direction
  let direction: Intent['direction'] = null;
  for (const [dir, terms] of DIRECTIONS) {
    if (terms.some((t) => containsPhrase(lower, t))) {
      direction = dir;
      break;
    }
  }

  // magnitude
  let magnitude: Intent['magnitude'] = null;
  for (const [mag, terms] of MAGNITUDES) {
    if (terms.some((t) => containsPhrase(lower, t))) {
      magnitude = mag;
      break;
    }
  }

  // numeric value
  const valueMatch = raw.match(VALUE_RX);
  const hasValue = !!valueMatch;
  const value = valueMatch ? `${valueMatch[1]}${valueMatch[2].toLowerCase()}` : null;

  // questions override the action
  if (
    action !== 'question' &&
    /^\s*(why|should|could|what if|how about|is this|what about)\b/.test(lower)
  ) {
    action = 'question';
  }

  return { action, attribute, direction, magnitude, hasValue, value, raw };
}

function containsPhrase(haystack: string, needle: string): boolean {
  if (!needle) return false;
  // word boundary for single words; substring for multi-word phrases
  if (/\s/.test(needle)) {
    return haystack.includes(needle);
  }
  return new RegExp(`\\b${escapeRx(needle)}\\b`).test(haystack);
}

function escapeRx(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Render an intent as a one-line action string for human reading. */
export function describeIntent(intent: Intent): string {
  const parts: string[] = [];
  if (intent.action !== 'unknown') parts.push(intent.action.toUpperCase());
  if (intent.attribute) parts.push(intent.attribute);
  if (intent.direction) parts.push(`(${intent.direction}${intent.magnitude ? `, ${intent.magnitude}` : ''})`);
  if (intent.hasValue && intent.value) parts.push(`→ ${intent.value}`);
  return parts.join(' ').trim() || intent.raw.slice(0, 60);
}
