/**
 * Reference resolution: when a transcript segment contains pronouns or
 * sequence references ("this", "the previous one", "the first one"), bind
 * them to a specific click marker.
 *
 * Resolution priority:
 *  1) Explicit ordinal: "the first/second/third/last one" → that index.
 *  2) Backreference: "the previous", "before that", "the last one" → previous click.
 *  3) Demonstrative without ordinal: "this", "that", "it", "these", "those" → current click.
 *  4) Otherwise: null (the merger keeps its time-window decision).
 */

import type { ClickMarker } from '../types';

const ORDINAL_WORDS: Record<string, number | 'last'> = {
  first: 0,
  second: 1,
  third: 2,
  fourth: 3,
  fifth: 4,
  sixth: 5,
  seventh: 6,
  eighth: 7,
  ninth: 8,
  tenth: 9,
  last: 'last',
};

const BACK_REFS = [
  'the previous',
  'previous one',
  'the last one',
  'before that',
  'one before',
  'last one',
];

const DEMONSTRATIVES = ['\\bthis\\b', '\\bthat\\b', '\\bit\\b', '\\bthese\\b', '\\bthose\\b'];

export interface ResolutionResult {
  /** Index into markers[] this text refers to, or null. */
  targetIndex: number | null;
  /** Confidence 0..1 (rules-based, coarse). */
  confidence: number;
  /** Reason code for debugging. */
  reason: 'ordinal' | 'backref' | 'demonstrative' | 'none';
}

export function resolveReference(
  text: string,
  currentMarkerIndex: number,
  markers: ClickMarker[],
): ResolutionResult {
  const lower = text.toLowerCase();

  // 1) Ordinal: "the second one", "first card", "the last button"
  const ordMatch = lower.match(/\bthe\s+(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last)\b/);
  if (ordMatch) {
    const word = ordMatch[1];
    const ord = ORDINAL_WORDS[word];
    if (typeof ord === 'number' && ord < markers.length) {
      return { targetIndex: ord, confidence: 0.9, reason: 'ordinal' };
    }
    if (ord === 'last' && markers.length > 0) {
      return { targetIndex: markers.length - 1, confidence: 0.9, reason: 'ordinal' };
    }
  }

  // 2) Backreference
  for (const phrase of BACK_REFS) {
    if (lower.includes(phrase)) {
      const target = Math.max(0, currentMarkerIndex - 1);
      return { targetIndex: target, confidence: 0.75, reason: 'backref' };
    }
  }

  // 3) Demonstrative pointing at the current click
  for (const rx of DEMONSTRATIVES) {
    if (new RegExp(rx).test(lower)) {
      if (currentMarkerIndex >= 0 && currentMarkerIndex < markers.length) {
        return { targetIndex: currentMarkerIndex, confidence: 0.6, reason: 'demonstrative' };
      }
    }
  }

  return { targetIndex: null, confidence: 0, reason: 'none' };
}
