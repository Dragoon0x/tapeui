/**
 * Replay engine: walk through saved markers in chronological order,
 * highlight each clicked element on the live page, and surface the matched
 * transcript text.
 *
 * The replay is overlay-only: it never modifies the page. If an element no
 * longer exists in the DOM, we mark it missing and continue.
 */

import type { Comment, CritiqueReport } from '../types';
import { findBySelector } from './utils';

export interface ReplayStep {
  index: number;
  comment: Comment;
  element: Element | null;
  rect: DOMRect | null;
  text: string;
}

export interface ReplayController {
  /** Total number of replayable comments (those with a marker). */
  total: number;
  /** Current step index, 0-based, or -1 if not started. */
  current: number;
  /** Move to the next step. Returns step or null if at end. */
  next: () => ReplayStep | null;
  /** Move to the previous step. Returns step or null if at start. */
  prev: () => ReplayStep | null;
  /** Jump to a specific step. */
  goto: (i: number) => ReplayStep | null;
  /** Auto-advance with a delay between steps. Stops when stop() is called. */
  play: (delayMs?: number, onStep?: (s: ReplayStep | null) => void) => void;
  /** Stop autoplay. */
  stop: () => void;
  /** Clean up and remove highlight overlays. */
  destroy: () => void;
}

export function createReplay(report: CritiqueReport): ReplayController {
  const steps: Comment[] = report.comments.filter((c) => c.marker !== null);
  let current = -1;
  let timer: number | null = null;
  let overlay: HTMLElement | null = null;
  let label: HTMLElement | null = null;

  function ensureOverlay(): void {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.setAttribute('data-tape-ui', '');
    overlay.style.cssText = [
      'position: fixed',
      'pointer-events: none',
      'z-index: 2147483646',
      'border: 2px solid #f59e0b',
      'border-radius: 6px',
      'box-shadow: 0 0 0 9999px rgba(0,0,0,0.18), 0 6px 24px rgba(0,0,0,0.35)',
      'transition: all 220ms cubic-bezier(.2,.8,.2,1)',
      'background: rgba(245, 158, 11, 0.06)',
    ].join(';');

    label = document.createElement('div');
    label.setAttribute('data-tape-ui', '');
    label.style.cssText = [
      'position: fixed',
      'pointer-events: none',
      'z-index: 2147483647',
      'background: #0f172a',
      'color: #f8fafc',
      'padding: 8px 12px',
      'border-radius: 6px',
      'font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
      'max-width: 360px',
      'box-shadow: 0 6px 24px rgba(0,0,0,0.35)',
    ].join(';');

    document.body.appendChild(overlay);
    document.body.appendChild(label);
  }

  function clearOverlay(): void {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (label && label.parentNode) label.parentNode.removeChild(label);
    overlay = null;
    label = null;
  }

  function show(step: ReplayStep): void {
    ensureOverlay();
    if (!overlay || !label) return;
    if (step.element && step.rect) {
      overlay.style.display = 'block';
      overlay.style.left = step.rect.left - 4 + 'px';
      overlay.style.top = step.rect.top - 4 + 'px';
      overlay.style.width = step.rect.width + 8 + 'px';
      overlay.style.height = step.rect.height + 8 + 'px';

      label.style.display = 'block';
      const labelTop = step.rect.bottom + 8;
      label.style.left = Math.max(8, step.rect.left) + 'px';
      label.style.top = Math.min(window.innerHeight - 80, labelTop) + 'px';
    } else {
      overlay.style.display = 'none';
      label.style.display = 'block';
      label.style.left = '16px';
      label.style.top = '16px';
    }
    label.textContent = `▶ ${step.index + 1}/${steps.length}  ${step.text || '(no transcript)'}`;
  }

  function buildStep(i: number): ReplayStep | null {
    const c = steps[i];
    if (!c) return null;
    const el = c.marker ? findBySelector(c.marker.selector) : null;
    const rect = el ? el.getBoundingClientRect() : null;
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    return {
      index: i,
      comment: c,
      element: el,
      rect,
      text: c.text,
    };
  }

  return {
    total: steps.length,
    get current() {
      return current;
    },
    next() {
      if (current >= steps.length - 1) return null;
      current++;
      const step = buildStep(current);
      if (step) show(step);
      return step;
    },
    prev() {
      if (current <= 0) return null;
      current--;
      const step = buildStep(current);
      if (step) show(step);
      return step;
    },
    goto(i: number) {
      if (i < 0 || i >= steps.length) return null;
      current = i;
      const step = buildStep(current);
      if (step) show(step);
      return step;
    },
    play(delayMs = 1500, onStep) {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
      const tick = () => {
        const step = current < steps.length - 1 ? this.next() : null;
        onStep?.(step);
        if (step === null) {
          if (timer != null) {
            clearInterval(timer);
            timer = null;
          }
        }
      };
      // immediate first step if not started
      if (current < 0) {
        const step = this.next();
        onStep?.(step);
      }
      timer = window.setInterval(tick, delayMs);
    },
    stop() {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    },
    destroy() {
      this.stop();
      clearOverlay();
      current = -1;
    },
  };
}
