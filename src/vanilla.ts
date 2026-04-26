/**
 * Vanilla JS entry: TAPE without React.
 *
 *   import { Tape } from 'usetapeui/vanilla';
 *   const tape = Tape.init({ vision: true });
 *
 * Or via script tag:
 *
 *   <script src="https://unpkg.com/usetapeui/dist/vanilla.js"></script>
 *   <script>UseTape.Tape.init();</script>
 *
 * The vanilla entry mounts a minimal panel built directly with DOM APIs,
 * shares the core engine with the React build, and exposes the same
 * recorder lifecycle.
 */

import type { ClickMarker, CritiqueReport, TapeConfig, TranscriptSegment } from './types';
import { Recorder } from './core/recorder';
import { buildReport } from './core/reporter';
import { detectTokenSystem } from './core/tokens';
import { exportAgent, exportMarkdown, exportPrompt, exportJson } from './core/exporters';
import { downloadTape } from './core/persist';
import { palette, KEYFRAMES, MONO_FAMILY, FONT_FAMILY } from './components/styles';

const DEFAULTS = {
  shortcut: 'Alt+T',
  language: 'en-US',
  ignoreSelectors: ['[data-tape-ui]'] as string[],
  zIndex: 99999,
  vision: true,
  sourceLink: true,
  tokens: true,
  intent: true,
  mergeWindow: 3000,
  position: 'bottom-right' as 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left',
};

export class TapeVanilla {
  private cfg: typeof DEFAULTS & Partial<TapeConfig>;
  private recorder: Recorder;
  private root: HTMLElement | null = null;
  private mounted = false;
  private tokens: ReturnType<typeof detectTokenSystem> | null = null;
  private report: CritiqueReport | null = null;
  private liveMarkers: ClickMarker[] = [];
  private liveSegments: TranscriptSegment[] = [];
  private liveTranscript = '';
  private isOpen = false;
  private shortcutHandler: ((e: KeyboardEvent) => void) | null = null;

  static init(opts: Partial<TapeConfig> = {}): TapeVanilla {
    const inst = new TapeVanilla(opts);
    inst.mount();
    return inst;
  }

  constructor(opts: Partial<TapeConfig> = {}) {
    this.cfg = { ...DEFAULTS, ...opts } as typeof DEFAULTS & Partial<TapeConfig>;
    this.recorder = new Recorder({
      language: this.cfg.language,
      ignoreSelectors: this.cfg.ignoreSelectors,
      vision: this.cfg.vision,
      sourceLink: this.cfg.sourceLink,
      onMarker: (m) => {
        this.liveMarkers.push(m);
        this.cfg.onClick?.(m);
        this.render();
      },
      onSegment: (s) => {
        this.liveSegments.push(s);
        this.liveTranscript = (this.liveTranscript + ' ' + s.text).trim().slice(-400);
        this.cfg.onSegment?.(s);
        this.render();
      },
    });
  }

  mount(): void {
    if (this.mounted || typeof document === 'undefined') return;
    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-tape-ui', '');
    styleEl.textContent = KEYFRAMES;
    document.head.appendChild(styleEl);

    this.root = document.createElement('div');
    this.root.setAttribute('data-tape-ui', '');
    this.root.style.cssText = `position:fixed;z-index:${this.cfg.zIndex};display:none;`;
    document.body.appendChild(this.root);

    this.shortcutHandler = (e: KeyboardEvent): void => {
      const parts = this.cfg.shortcut!.split('+').map((p) => p.trim().toLowerCase());
      const key = parts[parts.length - 1];
      if (
        e.key.toLowerCase() === key &&
        e.altKey === parts.includes('alt') &&
        e.ctrlKey === (parts.includes('ctrl') || parts.includes('control')) &&
        e.shiftKey === parts.includes('shift') &&
        e.metaKey === (parts.includes('meta') || parts.includes('cmd') || parts.includes('command'))
      ) {
        e.preventDefault();
        this.toggle();
      }
    };
    window.addEventListener('keydown', this.shortcutHandler);
    this.mounted = true;
    this.render();
  }

  unmount(): void {
    if (!this.mounted) return;
    if (this.shortcutHandler) {
      window.removeEventListener('keydown', this.shortcutHandler);
      this.shortcutHandler = null;
    }
    this.recorder.destroy();
    if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    this.root = null;
    this.mounted = false;
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
    this.render();
  }

  open(): void {
    this.isOpen = true;
    this.render();
  }

  close(): void {
    this.isOpen = false;
    this.render();
  }

  start(): void {
    this.liveMarkers = [];
    this.liveSegments = [];
    this.liveTranscript = '';
    this.report = null;
    this.tokens = this.cfg.tokens ? detectTokenSystem() : null;
    this.recorder.start();
    this.render();
  }

  stop(): CritiqueReport {
    const { markers, segments, duration } = this.recorder.stop();
    const built = buildReport({
      markers,
      segments,
      duration,
      tokens: this.tokens,
      mergeWindow: this.cfg.mergeWindow,
    });
    this.report = built;
    this.cfg.onReport?.(built);
    this.render();
    return built;
  }

  getReport(): CritiqueReport | null {
    return this.report;
  }

  private render(): void {
    if (!this.root) return;
    if (!this.isOpen) {
      this.root.style.display = 'none';
      return;
    }
    this.root.style.display = 'block';
    const recording = this.recorder.getState() === 'recording';
    const pos = this.positionStyle();

    this.root.style.cssText = [
      `position:fixed`,
      `z-index:${this.cfg.zIndex}`,
      pos,
      `width:380px`,
      `max-height:min(640px,80vh)`,
      `background:${palette.bgPanel}`,
      `color:${palette.text}`,
      `border:1px solid ${palette.border}`,
      `border-radius:12px`,
      `box-shadow:0 20px 60px rgba(0,0,0,0.45),0 4px 12px rgba(0,0,0,0.25)`,
      `font-family:${FONT_FAMILY}`,
      `font-size:13px`,
      `line-height:1.5`,
      `display:flex`,
      `flex-direction:column`,
      `overflow:hidden`,
      `box-sizing:border-box`,
    ].join(';');

    const exportBtn = this.report
      ? `<button data-tape-ui data-act="copy" style="${this.btnStyle('primary')}">Copy agent format</button>
         <button data-tape-ui data-act="download" style="${this.btnStyle('ghost')}">Save .tape</button>`
      : '';

    const recentMarkers = this.liveMarkers
      .slice(-5)
      .reverse()
      .map(
        (m) => `<div style="background:${palette.bgRow};border:1px solid ${palette.border};border-radius:6px;padding:6px 8px;margin-top:4px;font-family:${MONO_FAMILY};font-size:11px;color:${palette.accent};word-break:break-all">${this.escapeHtml(m.selector)}</div>`,
      )
      .join('');

    const reportSection = this.report
      ? `<div style="margin-top:12px"><div style="font-size:10px;color:${palette.textFaint};margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em">Agent format</div>
        <pre data-tape-ui style="background:#020409;border:1px solid ${palette.border};border-radius:8px;padding:12px;font-family:${MONO_FAMILY};font-size:11px;color:#9be3a4;white-space:pre-wrap;word-break:break-word;max-height:220px;overflow:auto;margin:0">${this.escapeHtml(exportAgent(this.report))}</pre>
        <div style="display:flex;gap:6px;margin-top:8px">${exportBtn}</div></div>`
      : '';

    this.root.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid ${palette.border};background:${palette.bg}">
        <div style="display:flex;align-items:center;gap:8px;font-weight:600;letter-spacing:0.04em;font-size:12px;text-transform:uppercase;color:${palette.text}">
          <span style="width:8px;height:8px;border-radius:50%;background:${recording ? palette.red : palette.accent};${recording ? `box-shadow:0 0 8px ${palette.red};animation:tape-pulse 1.4s ease-in-out infinite` : ''}"></span>
          <span>TAPE</span>
        </div>
        <button data-tape-ui data-act="close" style="background:transparent;border:none;color:${palette.textFaint};cursor:pointer;font-size:16px;padding:4px 6px;line-height:1;border-radius:4px">×</button>
      </div>
      <div style="padding:14px;overflow-y:auto;flex:1;box-sizing:border-box">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <button data-tape-ui data-act="${recording ? 'stop' : 'start'}" style="${this.recordBtnStyle(recording)}">${recording ? '■ Stop' : '● Record'}</button>
          <div style="font-size:11px;color:${palette.textFaint};margin-left:auto;font-family:${MONO_FAMILY}">${recording ? `${this.liveMarkers.length} clicks · ${this.liveSegments.length} segs` : 'idle'}</div>
        </div>
        <div style="background:${palette.bgRow};border:1px solid ${palette.border};border-radius:8px;padding:10px;font-size:12px;color:${palette.textDim};font-style:italic;min-height:48px;margin-bottom:12px;font-family:${FONT_FAMILY}">
          ${this.escapeHtml(this.liveTranscript || (recording ? 'Listening…' : 'Hit record. Talk and click. Stop. Done.'))}
        </div>
        ${recentMarkers ? `<div style="font-size:10px;color:${palette.textFaint};margin-top:4px;text-transform:uppercase;letter-spacing:0.05em">Recent</div>${recentMarkers}` : ''}
        ${reportSection}
      </div>
    `;

    // Bind clicks.
    this.root.querySelectorAll<HTMLElement>('[data-act]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = el.getAttribute('data-act');
        switch (act) {
          case 'start':
            this.start();
            break;
          case 'stop':
            this.stop();
            break;
          case 'close':
            this.close();
            break;
          case 'copy':
            if (this.report) {
              const text = exportAgent(this.report);
              if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
            }
            break;
          case 'download':
            if (this.report) downloadTape(this.report);
            break;
        }
      });
    });
  }

  private positionStyle(): string {
    switch (this.cfg.position) {
      case 'bottom-left': return 'left:20px;bottom:20px';
      case 'top-right': return 'right:20px;top:20px';
      case 'top-left': return 'left:20px;top:20px';
      default: return 'right:20px;bottom:20px';
    }
  }

  private recordBtnStyle(active: boolean): string {
    return [
      `background:${active ? palette.red : palette.accent}`,
      `color:${active ? '#fff' : '#0b0d10'}`,
      `border:none`,
      `border-radius:8px`,
      `padding:10px 16px`,
      `font-family:${FONT_FAMILY}`,
      `font-size:13px`,
      `font-weight:600`,
      `cursor:pointer`,
      `display:flex`,
      `align-items:center`,
      `gap:8px`,
    ].join(';');
  }

  private btnStyle(kind: 'primary' | 'ghost'): string {
    if (kind === 'primary') {
      return `background:${palette.accent};color:#0b0d10;border:none;border-radius:6px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;font-family:${FONT_FAMILY}`;
    }
    return `background:transparent;color:${palette.textDim};border:1px solid ${palette.border};border-radius:6px;padding:8px 12px;font-size:12px;cursor:pointer;font-family:${FONT_FAMILY}`;
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

// Named export for ESM consumers.
export const Tape = TapeVanilla;

// Convenient default export.
export default TapeVanilla;

// UMD-style global for `<script>` users.
if (typeof window !== 'undefined') {
  (window as any).UseTape = { Tape: TapeVanilla, exportAgent, exportMarkdown, exportPrompt, exportJson };
}
