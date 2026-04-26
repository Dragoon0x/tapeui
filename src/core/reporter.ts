/**
 * Reporter: merge raw streams into a final CritiqueReport.
 *
 * Pipeline:
 *   1) For each click marker, find the nearest transcript segment within the
 *      merge window. That pair becomes a Comment.
 *   2) Orphan segments (no nearby click) become text-only Comments.
 *   3) Each Comment is sentiment-classified, intent-extracted, and
 *      reference-resolved.
 *
 * The reporter is pure: same input → same output.
 */

import type {
  ClickMarker,
  Comment,
  CritiqueReport,
  Sentiment,
  TokenSystem,
  TranscriptSegment,
} from '../types';
import { extractIntent } from './intent';
import { resolveReference } from './resolver';
import { makeId } from './utils';

const NEG = ['too', 'wrong', 'fix', 'broken', 'ugly', 'bad', 'hate', 'aggressive', 'cramped', 'ugly', 'awful', 'terrible', 'gross', 'busted', 'glitched', 'misaligned', 'off', 'small', 'big', 'tiny', 'huge'];
const POS = ['love', 'great', 'perfect', 'keep', 'clean', 'solid', 'nice', 'beautiful', 'excellent', 'works', 'good', 'works', 'amazing', 'lovely'];
const QST = ['why', 'should', 'could', 'is this', 'what if', 'how about', 'wondering'];

function classifySentiment(text: string): Sentiment {
  const lower = text.toLowerCase();
  let neg = 0;
  let pos = 0;
  let qst = 0;
  for (const w of NEG) if (new RegExp(`\\b${w}\\b`).test(lower)) neg++;
  for (const w of POS) if (new RegExp(`\\b${w}\\b`).test(lower)) pos++;
  for (const w of QST) if (new RegExp(`\\b${w}\\b`).test(lower)) qst++;
  if (qst > 0 && /\?$/.test(lower.trim())) return 'question';
  if (qst > 0 && pos === 0 && neg === 0) return 'question';
  if (neg > pos) return 'issue';
  if (pos > neg) return 'positive';
  if (qst > 0) return 'question';
  return 'note';
}

export interface MergeOptions {
  /** Max distance in ms from a click to a segment for them to pair. Default 3000. */
  window?: number;
}

export function mergeStreams(
  markers: ClickMarker[],
  segments: TranscriptSegment[],
  opts: MergeOptions = {},
): Comment[] {
  const window = opts.window ?? 3000;
  const usedSegments = new Set<number>();
  const comments: Comment[] = [];

  // 1) For each marker, find the closest unused segment within the window.
  markers.forEach((marker, markerIdx) => {
    let bestIdx = -1;
    let bestDist = Infinity;
    segments.forEach((seg, segIdx) => {
      if (usedSegments.has(segIdx)) return;
      const dist = Math.abs(seg.t - marker.t);
      if (dist <= window && dist < bestDist) {
        bestDist = dist;
        bestIdx = segIdx;
      }
    });

    let text = '';
    if (bestIdx >= 0) {
      usedSegments.add(bestIdx);
      text = segments[bestIdx].text;
    }

    const intent = extractIntent(text);
    const ref = resolveReference(text, markerIdx, markers);
    const sentiment = text ? classifySentiment(text) : 'note';

    comments.push({
      id: makeId(),
      t: marker.t,
      text,
      marker,
      sentiment,
      intent,
      resolvedTargetIndex: ref.targetIndex,
      edited: false,
    });
  });

  // 2) Orphan segments become text-only comments.
  segments.forEach((seg, idx) => {
    if (usedSegments.has(idx)) return;
    const intent = extractIntent(seg.text);
    const sentiment = classifySentiment(seg.text);
    comments.push({
      id: makeId(),
      t: seg.t,
      text: seg.text,
      marker: null,
      sentiment,
      intent,
      resolvedTargetIndex: null,
      edited: false,
    });
  });

  comments.sort((a, b) => a.t - b.t);
  return comments;
}

export function buildReport(args: {
  markers: ClickMarker[];
  segments: TranscriptSegment[];
  duration: number;
  tokens: TokenSystem | null;
  mergeWindow?: number;
}): CritiqueReport {
  const { markers, segments, duration, tokens, mergeWindow } = args;
  const comments = mergeStreams(markers, segments, { window: mergeWindow });

  return {
    version: '1',
    recordedAt: Date.now(),
    duration,
    url: typeof location !== 'undefined' ? location.href : '',
    title: typeof document !== 'undefined' ? document.title : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    viewport:
      typeof window !== 'undefined'
        ? {
            w: window.innerWidth,
            h: window.innerHeight,
            dpr: window.devicePixelRatio || 1,
          }
        : { w: 0, h: 0, dpr: 1 },
    markers,
    segments,
    comments,
    tokens,
  };
}

/** Re-classify after the user edits a comment text in the editor. */
export function reclassifyComment(c: Comment): Comment {
  return {
    ...c,
    sentiment: c.text ? classifySentiment(c.text) : 'note',
    intent: extractIntent(c.text),
    edited: true,
  };
}
