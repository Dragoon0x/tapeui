/**
 * useTape: a headless hook for programmatic access.
 *
 * Lets users build custom recording surfaces without rendering the default
 * Panel. Returns the full lifecycle: start, stop, comments, exports.
 */

import * as React from 'react';
import type {
  ClickMarker,
  Comment,
  CritiqueReport,
  RecorderState,
  TapeConfig,
  TranscriptSegment,
  VerifyReport,
} from '../types';
import { Recorder } from '../core/recorder';
import { buildReport } from '../core/reporter';
import { detectTokenSystem } from '../core/tokens';
import {
  exportAgent as expAgent,
  exportJson as expJson,
  exportMarkdown as expMd,
  exportPrompt as expPrompt,
} from '../core/exporters';
import { downloadTape } from '../core/persist';
import { verifyReport as runVerify } from '../core/verify';
import { DEFAULTS } from '../components/Tape';

export interface UseTapeReturn {
  state: RecorderState;
  isRecording: boolean;
  speechAvailable: boolean;
  /** Live transcript string while recording. */
  liveTranscript: string;
  /** Live markers while recording. */
  liveMarkers: ClickMarker[];
  /** Live segments while recording. */
  liveSegments: TranscriptSegment[];
  /** Final report after stop, or null. */
  report: CritiqueReport | null;
  /** Begin a new recording session. */
  start: () => void;
  /** Stop and produce a CritiqueReport. */
  stop: () => CritiqueReport | null;
  /** Replace the report's comments (e.g. after editing). */
  setComments: (comments: Comment[]) => void;
  /** Reset report state without affecting the recorder. */
  reset: () => void;
  /** Export the current report as agent format. */
  exportAgent: () => string;
  /** Export as a ready-to-paste prompt. */
  exportPrompt: () => string;
  /** Export as markdown. */
  exportMarkdown: () => string;
  /** Export as JSON (screenshots stripped). */
  exportJson: (opts?: { includeScreenshots?: boolean }) => string;
  /** Download the report as a .tape.json file. */
  download: (filename?: string) => void;
  /** Run a verify pass on the current report against the live DOM. */
  verify: () => VerifyReport | null;
}

export function useTape(userConfig?: TapeConfig): UseTapeReturn {
  const config = React.useMemo(
    () => ({ ...DEFAULTS, ...(userConfig || {}) }) as Required<TapeConfig>,
    [userConfig],
  );

  const [state, setState] = React.useState<RecorderState>('idle');
  const [report, setReport] = React.useState<CritiqueReport | null>(null);
  const [liveTranscript, setLiveTranscript] = React.useState('');
  const [liveMarkers, setLiveMarkers] = React.useState<ClickMarker[]>([]);
  const [liveSegments, setLiveSegments] = React.useState<TranscriptSegment[]>([]);
  const [speechAvailable, setSpeechAvailable] = React.useState(true);

  const recorderRef = React.useRef<Recorder | null>(null);
  const tokensRef = React.useRef<ReturnType<typeof detectTokenSystem> | null>(null);

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

  const start = React.useCallback(() => {
    const rec = recorderRef.current;
    if (!rec) return;
    setLiveMarkers([]);
    setLiveSegments([]);
    setLiveTranscript('');
    setReport(null);
    tokensRef.current = config.tokens ? detectTokenSystem() : null;
    rec.start();
    setSpeechAvailable(rec.isSpeechAvailable());
    setState('recording');
  }, [config.tokens]);

  const stop = React.useCallback((): CritiqueReport | null => {
    const rec = recorderRef.current;
    if (!rec) return null;
    const { markers, segments, duration } = rec.stop();
    const built = buildReport({
      markers,
      segments,
      duration,
      tokens: tokensRef.current,
      mergeWindow: config.mergeWindow,
    });
    setReport(built);
    setState('idle');
    config.onReport?.(built);
    return built;
  }, [config.mergeWindow, config.onReport]);

  const setComments = React.useCallback((comments: Comment[]) => {
    setReport((prev) => (prev ? { ...prev, comments } : prev));
  }, []);

  const reset = React.useCallback(() => {
    setReport(null);
    setLiveMarkers([]);
    setLiveSegments([]);
    setLiveTranscript('');
  }, []);

  const exportAgent = React.useCallback(() => (report ? expAgent(report) : ''), [report]);
  const exportPrompt = React.useCallback(() => (report ? expPrompt(report) : ''), [report]);
  const exportMarkdown = React.useCallback(() => (report ? expMd(report) : ''), [report]);
  const exportJson = React.useCallback(
    (opts?: { includeScreenshots?: boolean }) => (report ? expJson(report, opts) : ''),
    [report],
  );
  const download = React.useCallback(
    (filename?: string) => {
      if (report) downloadTape(report, filename);
    },
    [report],
  );
  const verify = React.useCallback((): VerifyReport | null => (report ? runVerify(report) : null), [report]);

  return {
    state,
    isRecording: state === 'recording',
    speechAvailable,
    liveTranscript,
    liveMarkers,
    liveSegments,
    report,
    start,
    stop,
    setComments,
    reset,
    exportAgent,
    exportPrompt,
    exportMarkdown,
    exportJson,
    download,
    verify,
  };
}
