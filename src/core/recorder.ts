/**
 * Recorder: the live capture engine.
 *
 * Two parallel streams, both timestamped against the same recording start:
 *   - speech: SpeechRecognition events → TranscriptSegment[]
 *   - clicks: capture-phase click listener → ClickMarker[]
 *
 * Vision (screenshot) and source (fiber walk) attach to each ClickMarker
 * asynchronously so they never block the click flow.
 */

import type { ClickMarker, RecorderState, TranscriptSegment } from '../types';
import { buildSelector, directText, isIgnored, pickStyles, warn } from './utils';
import { captureElement } from './vision';
import { findSource } from './source';

interface RecorderOptions {
  language: string;
  ignoreSelectors: string[];
  vision: boolean;
  sourceLink: boolean;
  onMarker?: (marker: ClickMarker) => void;
  onSegment?: (segment: TranscriptSegment) => void;
}

interface SpeechRecognitionLike {
  start: () => void;
  stop: () => void;
  abort: () => void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

export class Recorder {
  private state: RecorderState = 'idle';
  private startedAt = 0;
  private markers: ClickMarker[] = [];
  private segments: TranscriptSegment[] = [];
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private recognition: SpeechRecognitionLike | null = null;
  private speechAvailable = false;
  private restartGuard = false;
  private restartCount = 0;
  private maxRestarts = 50;
  private opts: RecorderOptions;

  constructor(opts: RecorderOptions) {
    this.opts = opts;
  }

  getState(): RecorderState {
    return this.state;
  }

  isSpeechAvailable(): boolean {
    return this.speechAvailable;
  }

  start(): void {
    if (this.state !== 'idle') return;
    this.state = 'recording';
    this.startedAt = Date.now();
    this.markers = [];
    this.segments = [];
    this.restartCount = 0;
    this.attachClickCapture();
    this.startSpeech();
  }

  /** Stop, return raw streams, transition to idle. */
  stop(): { markers: ClickMarker[]; segments: TranscriptSegment[]; duration: number } {
    if (this.state === 'idle') {
      return { markers: [], segments: [], duration: 0 };
    }
    this.state = 'stopping';
    this.detachClickCapture();
    this.stopSpeech();
    const duration = Date.now() - this.startedAt;
    const out = {
      markers: this.markers.slice(),
      segments: this.segments.slice(),
      duration,
    };
    this.state = 'idle';
    return out;
  }

  /** Hard cleanup; safe to call any time. */
  destroy(): void {
    this.detachClickCapture();
    this.stopSpeech();
    this.markers = [];
    this.segments = [];
    this.state = 'idle';
  }

  /* -------------------- click capture -------------------- */

  private attachClickCapture(): void {
    this.clickHandler = (e: MouseEvent) => {
      if (this.state !== 'recording') return;
      const el = e.target as Element | null;
      if (!el || el.nodeType !== 1) return;
      if (isIgnored(el, this.opts.ignoreSelectors)) return;

      const t = Date.now() - this.startedAt;
      const rect = el.getBoundingClientRect();
      const marker: ClickMarker = {
        t,
        selector: buildSelector(el),
        tag: el.tagName.toLowerCase(),
        text: directText(el),
        rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
        styles: pickStyles(el),
        screenshot: null,
        source: this.opts.sourceLink ? findSource(el) : null,
        classes: (el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 10),
        id: el.id || null,
        role: el.getAttribute('role'),
      };

      this.markers.push(marker);
      this.opts.onMarker?.(marker);

      // Vision capture is async; attach when ready, never block.
      if (this.opts.vision) {
        captureElement(el)
          .then((url) => {
            marker.screenshot = url;
          })
          .catch(() => {
            marker.screenshot = null;
          });
      }
    };
    // capture phase so we run before app handlers stop propagation
    document.addEventListener('click', this.clickHandler, true);
  }

  private detachClickCapture(): void {
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler, true);
      this.clickHandler = null;
    }
  }

  /* -------------------- speech recognition -------------------- */

  private startSpeech(): void {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      this.speechAvailable = false;
      warn('SpeechRecognition not available in this browser. Click capture still active.');
      return;
    }
    try {
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = this.opts.language;
      rec.onresult = (event: any) => this.handleSpeechResult(event);
      rec.onerror = (event: any) => {
        // 'no-speech' fires constantly during silence; ignore quietly.
        if (event && event.error && event.error !== 'no-speech' && event.error !== 'aborted') {
          warn('speech error:', event.error);
        }
      };
      rec.onend = () => {
        // Auto-restart when the engine ends mid-recording.
        if (
          this.state === 'recording' &&
          !this.restartGuard &&
          this.restartCount < this.maxRestarts
        ) {
          this.restartCount++;
          this.restartGuard = true;
          setTimeout(() => {
            this.restartGuard = false;
            try {
              rec.start();
            } catch {
              // ignore (already started)
            }
          }, 250);
        }
      };
      this.recognition = rec;
      this.speechAvailable = true;
      try {
        rec.start();
      } catch (err) {
        warn('failed to start speech recognition', err);
      }
    } catch (err) {
      this.speechAvailable = false;
      warn('failed to construct SpeechRecognition', err);
    }
  }

  private stopSpeech(): void {
    if (!this.recognition) return;
    try {
      this.recognition.onend = null;
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.stop();
    } catch {
      try {
        this.recognition.abort();
      } catch {
        // ignore
      }
    }
    this.recognition = null;
  }

  private handleSpeechResult(event: any): void {
    if (this.state !== 'recording') return;
    const t = Date.now() - this.startedAt;
    if (!event || !event.results) return;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      if (!res || !res[0]) continue;
      const transcript = (res[0].transcript || '').trim();
      const confidence = typeof res[0].confidence === 'number' ? res[0].confidence : 0.7;
      if (!transcript) continue;
      if (res.isFinal) {
        const seg: TranscriptSegment = {
          t,
          duration: 0,
          text: transcript,
          final: true,
          confidence,
        };
        this.segments.push(seg);
        this.opts.onSegment?.(seg);
      }
      // interim results are ignored for the report; the panel can read live transcript via callbacks.
    }
  }
}
