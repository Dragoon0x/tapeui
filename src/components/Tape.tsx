/**
 * Tape: the root React component the user mounts.
 *
 * Responsibilities:
 *   - Construct + own the Recorder instance.
 *   - Listen for the keyboard shortcut and toggle the panel.
 *   - Track lifecycle (idle / recording / editing) and assemble the report
 *     when recording stops.
 *   - Render the Panel when open.
 *
 * The component takes no required props; everything is configurable via
 * TapeConfig with sensible defaults.
 */

import * as React from 'react';
import type {
  ClickMarker,
  Comment,
  CritiqueReport,
  RecorderState,
  TapeConfig,
  TranscriptSegment,
} from '../types';
import { Recorder } from '../core/recorder';
import { buildReport } from '../core/reporter';
import { detectTokenSystem } from '../core/tokens';
import { Panel } from './Panel';

export const DEFAULTS: Required<TapeConfig> = {
  shortcut: 'Alt+T',
  language: 'en-US',
  ignoreSelectors: ['[data-tape-ui]'],
  zIndex: 99999,
  vision: true,
  sourceLink: true,
  tokens: true,
  intent: true,
  mergeWindow: 3000,
  openEditorOnStop: false,
  onReport: () => {},
  onClick: () => {},
  onSegment: () => {},
  theme: 'dark',
  position: 'bottom-right',
};

function mergeConfig(user: TapeConfig | undefined): Required<TapeConfig> {
  return { ...DEFAULTS, ...(user || {}) } as Required<TapeConfig>;
}

export interface TapeProps extends TapeConfig {}

export function Tape(props: TapeProps): React.ReactElement | null {
  const config = React.useMemo(() => mergeConfig(props), [
    props.shortcut, props.language, props.ignoreSelectors, props.zIndex,
    props.vision, props.sourceLink, props.tokens, props.intent,
    props.mergeWindow, props.openEditorOnStop, props.theme, props.position,
    props.onReport, props.onClick, props.onSegment,
  ]);

  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState<RecorderState>('idle');
  const [report, setReport] = React.useState<CritiqueReport | null>(null);
  const [liveTranscript, setLiveTranscript] = React.useState('');
  const [liveMarkers, setLiveMarkers] = React.useState<ClickMarker[]>([]);
  const [liveSegments, setLiveSegments] = React.useState<TranscriptSegment[]>([]);
  const [speechAvailable, setSpeechAvailable] = React.useState(true);

  const recorderRef = React.useRef<Recorder | null>(null);
  const tokensRef = React.useRef<ReturnType<typeof detectTokenSystem> | null>(null);

  // Lazy-construct the recorder once.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const rec = new Recorder({
      language: config.language,
      ignoreSelectors: config.ignoreSelectors,
      vision: config.vision,
      sourceLink: config.sourceLink,
      onMarker: (m) => {
        setLiveMarkers((prev) => [...prev, m]);
        config.onClick?.(m);
      },
      onSegment: (s) => {
        setLiveSegments((prev) => [...prev, s]);
        setLiveTranscript((prev) => (prev + ' ' + s.text).trim().slice(-400));
        config.onSegment?.(s);
      },
    });
    recorderRef.current = rec;
    return () => {
      rec.destroy();
      recorderRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update recorder options (vision, sourceLink, language, ignoreSelectors) when config changes.
  // The Recorder reads these on access; we mutate via re-init only on language change because
  // SpeechRecognition doesn't allow runtime language switching mid-recording.
  React.useEffect(() => {
    // Nothing to do — recorder reads opts from its constructor; users should not mutate these mid-recording.
  }, [config.vision, config.sourceLink, config.ignoreSelectors]);

  // Keyboard shortcut.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: KeyboardEvent): void => {
      const parts = config.shortcut.split('+').map((p) => p.trim().toLowerCase());
      const key = parts[parts.length - 1];
      const wantAlt = parts.includes('alt');
      const wantCtrl = parts.includes('ctrl') || parts.includes('control');
      const wantShift = parts.includes('shift');
      const wantMeta = parts.includes('meta') || parts.includes('cmd') || parts.includes('command');
      const matches =
        e.key.toLowerCase() === key &&
        e.altKey === wantAlt &&
        e.ctrlKey === wantCtrl &&
        e.shiftKey === wantShift &&
        e.metaKey === wantMeta;
      if (matches) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [config.shortcut]);

  const handleStart = React.useCallback(() => {
    const rec = recorderRef.current;
    if (!rec) return;
    setLiveMarkers([]);
    setLiveSegments([]);
    setLiveTranscript('');
    setReport(null);
    if (config.tokens) {
      tokensRef.current = detectTokenSystem();
    } else {
      tokensRef.current = null;
    }
    rec.start();
    setSpeechAvailable(rec.isSpeechAvailable());
    setState('recording');
  }, [config.tokens]);

  const handleStop = React.useCallback(() => {
    const rec = recorderRef.current;
    if (!rec) return;
    const { markers, segments, duration } = rec.stop();
    const built = buildReport({
      markers,
      segments,
      duration,
      tokens: tokensRef.current,
      mergeWindow: config.mergeWindow,
    });
    setReport(built);
    setState(config.openEditorOnStop ? 'editing' : 'idle');
    config.onReport?.(built);
  }, [config.mergeWindow, config.openEditorOnStop, config.onReport]);

  const handleCommentsChange = React.useCallback((comments: Comment[]) => {
    setReport((prev) => (prev ? { ...prev, comments } : prev));
  }, []);

  if (typeof window === 'undefined') return null;

  return (
    <Panel
      config={config}
      state={state}
      isOpen={open}
      speechAvailable={speechAvailable}
      liveTranscript={liveTranscript}
      liveMarkers={liveMarkers}
      liveSegments={liveSegments}
      report={report}
      onStart={handleStart}
      onStop={handleStop}
      onClose={() => setOpen(false)}
      onCommentsChange={handleCommentsChange}
    />
  );
}
