/**
 * Verify engine: take a saved CritiqueReport, locate each marker on the live
 * page, capture current styles, and diff against the saved snapshot.
 *
 * Use case: after the agent applies fixes, run verify to confirm which
 * elements actually changed.
 */

import type { CritiqueReport, VerifyReport, VerifyResult } from '../types';
import { diffStyles, findBySelector, pickStyles } from './utils';

export function verifyReport(source: CritiqueReport): VerifyReport {
  const results: VerifyResult[] = [];
  let found = 0;
  let changed = 0;
  let unchanged = 0;
  let missing = 0;

  source.markers.forEach((marker, idx) => {
    const el = findBySelector(marker.selector);
    if (!el) {
      missing++;
      results.push({ markerIndex: idx, selector: marker.selector, status: 'missing', diff: {} });
      return;
    }
    found++;
    const currentStyles = pickStyles(el);
    const diff = diffStyles(marker.styles, currentStyles);
    if (Object.keys(diff).length === 0) {
      unchanged++;
      results.push({ markerIndex: idx, selector: marker.selector, status: 'unchanged', diff });
    } else {
      changed++;
      results.push({ markerIndex: idx, selector: marker.selector, status: 'changed', diff });
    }
  });

  return {
    source,
    results,
    total: source.markers.length,
    found,
    changed,
    unchanged,
    missing,
  };
}
