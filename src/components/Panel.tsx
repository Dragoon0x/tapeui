/**
 * Panel: the floating recording surface.
 *
 * Tabs:
 *   record  → live recording controls + transcript
 *   review  → comment list + edit inline + export
 *   verify  → run verify against current DOM
 *   replay  → load a .tape file and walk through it
 *   exports → export formats: agent, prompt, markdown, json
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
import { Editor } from './Editor';
import { VerifyDiff } from './VerifyDiff';
import { palette, styles, KEYFRAMES, positions, MONO_FAMILY } from './styles';
import {
  exportAgent,
  exportJson,
  exportMarkdown,
  exportPrompt,
} from '../core/exporters';
import { downloadTape, uploadTape } from '../core/persist';
import { createReplay, type ReplayController } from '../core/replay';
import { verifyReport } from '../core/verify';

type Tab = 'record' | 'review' | 'verify' | 'replay' | 'exports';

interface PanelProps {
  config: Required<TapeConfig>;
  state: RecorderState;
  isOpen: boolean;
  speechAvailable: boolean;
  liveTranscript: string;
  liveMarkers: ClickMarker[];
  liveSegments: TranscriptSegment[];
  report: CritiqueReport | null;
  onStart: () => void;
  onStop: () => void;
  onClose: () => void;
  onCommentsChange: (comments: Comment[]) => void;
}

export function Panel(props: PanelProps): React.ReactElement {
  const {
    config,
    state,
    isOpen,
    speechAvailable,
    liveTranscript,
    liveMarkers,
    liveSegments,
    report,
    onStart,
    onStop,
    onClose,
    onCommentsChange,
  } = props;

  const [tab, setTab] = React.useState<Tab>('record');
  const [exportFormat, setExportFormat] = React.useState<'agent' | 'prompt' | 'markdown' | 'json'>('agent');
  const [verify, setVerify] = React.useState<VerifyReport | null>(null);
  const [replayController, setReplayController] = React.useState<ReplayController | null>(null);
  const [vu, setVu] = React.useState<number[]>(Array(8).fill(2));

  // VU meter — animated bars during recording (purely cosmetic, deterministic).
  React.useEffect(() => {
    if (state !== 'recording') {
      setVu(Array(8).fill(2));
      return;
    }
    const id = window.setInterval(() => {
      setVu(Array.from({ length: 8 }, () => 4 + Math.floor(Math.random() * 12)));
    }, 140);
    return () => clearInterval(id);
  }, [state]);

  // Auto-switch to review after stop.
  React.useEffect(() => {
    if (state === 'idle' && report && tab === 'record') {
      setTab('review');
    }
  }, [state, report, tab]);

  // Tear down replay when leaving the replay tab.
  React.useEffect(() => {
    if (tab !== 'replay' && replayController) {
      replayController.destroy();
      setReplayController(null);
    }
  }, [tab, replayController]);

  if (!isOpen) return <></>;

  const pos = positions[config.position] as React.CSSProperties;

  const recording = state === 'recording';
  const exportText = report
    ? exportFormat === 'agent'
      ? exportAgent(report)
      : exportFormat === 'prompt'
        ? exportPrompt(report)
        : exportFormat === 'markdown'
          ? exportMarkdown(report)
          : exportJson(report)
    : '';

  const copyExport = (): void => {
    if (!exportText) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(exportText).catch(() => {
        fallbackCopy(exportText);
      });
    } else {
      fallbackCopy(exportText);
    }
  };

  const downloadCurrent = (): void => {
    if (!report) return;
    downloadTape(report);
  };

  const loadFile = async (): Promise<void> => {
    const loaded = await uploadTape();
    if (!loaded) return;
    const ctl = createReplay(loaded);
    setReplayController(ctl);
  };

  const runVerify = (): void => {
    if (!report) return;
    setVerify(verifyReport(report));
  };

  return (
    <>
      <style data-tape-ui="">{KEYFRAMES}</style>
      <div data-tape-ui="" style={{ ...styles.panel, ...pos } as React.CSSProperties}>
        <div style={styles.header}>
          <div style={styles.brand}>
            <span style={styles.led(recording)} />
            <span>TAPE</span>
            {recording && (
              <div style={{ ...styles.vu, marginLeft: 6 }}>
                {vu.map((h, i) => (
                  <div key={i} style={styles.vuBar(true, h)} />
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: palette.textFaint, fontFamily: MONO_FAMILY }}>
              {config.shortcut}
            </span>
            <button data-tape-ui="" style={styles.closeBtn} onClick={onClose} title="Close">×</button>
          </div>
        </div>

        <div style={{ padding: '10px 14px 0 14px' }}>
          <div style={styles.tabs}>
            <button data-tape-ui="" style={styles.tab(tab === 'record')} onClick={() => setTab('record')}>Record</button>
            <button data-tape-ui="" style={styles.tab(tab === 'review')} onClick={() => setTab('review')}>Review {report ? `(${report.comments.length})` : ''}</button>
            <button data-tape-ui="" style={styles.tab(tab === 'exports')} onClick={() => setTab('exports')}>Export</button>
            <button data-tape-ui="" style={styles.tab(tab === 'verify')} onClick={() => setTab('verify')}>Verify</button>
            <button data-tape-ui="" style={styles.tab(tab === 'replay')} onClick={() => setTab('replay')}>Replay</button>
          </div>
        </div>

        <div style={styles.body}>
          {tab === 'record' && (
            <RecordTab
              recording={recording}
              speechAvailable={speechAvailable}
              liveTranscript={liveTranscript}
              liveMarkers={liveMarkers}
              liveSegments={liveSegments}
              onStart={onStart}
              onStop={onStop}
              vision={config.vision}
              tokens={config.tokens}
              sourceLink={config.sourceLink}
            />
          )}

          {tab === 'review' && (
            report ? (
              <Editor report={report} onChange={onCommentsChange} onClose={() => setTab('exports')} />
            ) : (
              <div style={styles.empty}>Record a session to start reviewing.</div>
            )
          )}

          {tab === 'exports' && (
            report ? (
              <div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                  {(['agent', 'prompt', 'markdown', 'json'] as const).map((f) => (
                    <button
                      key={f}
                      data-tape-ui=""
                      style={{
                        ...styles.iconBtn,
                        background: exportFormat === f ? palette.accent : palette.bgRow,
                        color: exportFormat === f ? '#0b0d10' : palette.textDim,
                        fontWeight: exportFormat === f ? 700 : 400,
                      }}
                      onClick={() => setExportFormat(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <pre data-tape-ui="" style={styles.exportBlock}>{exportText}</pre>
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <button data-tape-ui="" style={styles.primaryBtn} onClick={copyExport}>Copy to clipboard</button>
                  <button data-tape-ui="" style={styles.ghostBtn} onClick={downloadCurrent}>Save .tape</button>
                </div>
              </div>
            ) : (
              <div style={styles.empty}>Record a session to export.</div>
            )
          )}

          {tab === 'verify' && (
            verify ? (
              <VerifyDiff report={verify} onClose={() => setVerify(null)} />
            ) : (
              <div>
                <div style={{ ...styles.empty, paddingBottom: 16 }}>
                  Verify checks each marker against the current DOM and shows what changed since recording.
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                  <button data-tape-ui="" style={styles.primaryBtn} disabled={!report} onClick={runVerify}>
                    Run verify on current report
                  </button>
                </div>
              </div>
            )
          )}

          {tab === 'replay' && (
            <ReplayPanel
              controller={replayController}
              onLoad={loadFile}
              onLoadCurrent={() => {
                if (!report) return;
                const ctl = createReplay(report);
                setReplayController(ctl);
              }}
              hasCurrent={!!report}
              onDestroy={() => {
                if (replayController) {
                  replayController.destroy();
                  setReplayController(null);
                }
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}

/* ---- Tab subcomponents ---- */

function RecordTab(props: {
  recording: boolean;
  speechAvailable: boolean;
  liveTranscript: string;
  liveMarkers: ClickMarker[];
  liveSegments: TranscriptSegment[];
  onStart: () => void;
  onStop: () => void;
  vision: boolean;
  tokens: boolean;
  sourceLink: boolean;
}): React.ReactElement {
  const {
    recording,
    speechAvailable,
    liveTranscript,
    liveMarkers,
    liveSegments,
    onStart,
    onStop,
    vision,
    tokens,
    sourceLink,
  } = props;

  return (
    <div>
      <div style={styles.recordRow}>
        <button
          data-tape-ui=""
          style={styles.recordBtn(recording)}
          onClick={recording ? onStop : onStart}
        >
          {recording ? '■ Stop' : '● Record'}
        </button>
        <div style={styles.status}>
          {recording
            ? `${liveMarkers.length} clicks · ${liveSegments.length} segments`
            : 'idle'}
        </div>
      </div>

      <div style={styles.transcript}>
        {liveTranscript || (recording ? 'Listening…' : 'Hit record. Talk and click. Stop. Done.')}
      </div>

      <div style={{ display: 'flex', gap: 8, fontSize: 10, color: palette.textFaint, fontFamily: MONO_FAMILY, flexWrap: 'wrap' }}>
        <span style={{ color: speechAvailable ? palette.green : palette.red }}>
          ● speech: {speechAvailable ? 'on' : 'unavailable'}
        </span>
        <span style={{ color: vision ? palette.green : palette.textFaint }}>
          ● vision: {vision ? 'on' : 'off'}
        </span>
        <span style={{ color: sourceLink ? palette.green : palette.textFaint }}>
          ● source-link: {sourceLink ? 'on' : 'off'}
        </span>
        <span style={{ color: tokens ? palette.green : palette.textFaint }}>
          ● tokens: {tokens ? 'on' : 'off'}
        </span>
      </div>

      {recording && liveMarkers.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, color: palette.textFaint, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Captured this session
          </div>
          {liveMarkers.slice(-5).reverse().map((m, i) => (
            <div key={i} style={{ ...styles.commentRow, padding: 8, marginBottom: 6 }}>
              <div style={styles.selector}>{m.selector}</div>
              {m.source?.componentName && (
                <div style={{ fontSize: 10, color: palette.textFaint, marginTop: 4, fontFamily: MONO_FAMILY }}>
                  ← {m.source.componentName}
                  {m.source.fileName ? ` (${m.source.fileName.split('/').slice(-2).join('/')})` : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReplayPanel(props: {
  controller: ReplayController | null;
  onLoad: () => void;
  onLoadCurrent: () => void;
  hasCurrent: boolean;
  onDestroy: () => void;
}): React.ReactElement {
  const { controller, onLoad, onLoadCurrent, hasCurrent, onDestroy } = props;
  const [tick, setTick] = React.useState(0);

  const refresh = (): void => setTick((n) => n + 1);

  if (!controller) {
    return (
      <div>
        <div style={{ ...styles.empty, paddingBottom: 16 }}>
          Replay walks through a saved session. The element from each comment lights up on the page in order.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button data-tape-ui="" style={styles.primaryBtn} disabled={!hasCurrent} onClick={onLoadCurrent}>
            Replay current report
          </button>
          <button data-tape-ui="" style={styles.ghostBtn} onClick={onLoad}>
            Load .tape file
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: palette.textDim, marginBottom: 10, fontFamily: MONO_FAMILY }}>
        Step {controller.current + 1} / {controller.total}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <button data-tape-ui="" style={styles.ghostBtn} onClick={() => { controller.prev(); refresh(); }}>← Prev</button>
        <button data-tape-ui="" style={styles.primaryBtn} onClick={() => { controller.next(); refresh(); }}>Next →</button>
        <button data-tape-ui="" style={styles.ghostBtn} onClick={() => { controller.play(1500, () => refresh()); refresh(); }}>▶ Play</button>
        <button data-tape-ui="" style={styles.ghostBtn} onClick={() => { controller.stop(); refresh(); }}>Pause</button>
        <button data-tape-ui="" style={styles.dangerBtn} onClick={onDestroy}>Exit</button>
      </div>
      <div style={styles.hint}>The amber outline on the page tracks the current step.</div>
    </div>
  );
}

function fallbackCopy(text: string): void {
  if (typeof document === 'undefined') return;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } catch {
    // ignore
  }
  document.body.removeChild(ta);
}
