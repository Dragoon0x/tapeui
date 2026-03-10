import React, { useState, useEffect, useRef } from 'react'
import type { Recording, Comment, CritiqueReport } from '../types'
import { TAPE_COLORS as C, SENTIMENT_CONFIG } from '../types'
import { exportMarkdown, exportAgentInstructions, exportJSON } from '../core/reporter'

interface PanelProps {
  recording: Recording
  comments: Comment[]
  report: CritiqueReport | null
  onStart: () => void
  onStop: () => void
  onReset: () => void
  onClose: () => void
  zIndex: number
}

export function Panel({ recording, comments, report, onStart, onStop, onReset, onClose, zIndex }: PanelProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const [expandedComment, setExpandedComment] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isRecording = recording.state === 'recording'
  const isStopped = recording.state === 'stopped'
  const hasContent = comments.length > 0 || recording.segments.length > 0 || recording.markers.length > 0

  // Auto-scroll timeline
  useEffect(() => {
    if (scrollRef.current && isRecording) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [recording.segments.length, recording.markers.length, isRecording])

  const handleCopy = (format: 'agent' | 'markdown' | 'json') => {
    if (!report) return
    const text = format === 'agent' ? exportAgentInstructions(report)
      : format === 'markdown' ? exportMarkdown(report)
      : exportJSON(report)
    navigator.clipboard?.writeText(text)
    setCopied(format)
    setTimeout(() => setCopied(null), 1500)
  }

  const elapsed = recording.duration
  const elapsedStr = `${Math.floor(elapsed / 60000)}:${Math.floor((elapsed % 60000) / 1000).toString().padStart(2, '0')}`

  return (
    <div data-tape-ui style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 360, zIndex,
      background: C.bg, borderLeft: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column',
      fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
      fontSize: 11, color: C.text, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: `1px solid ${C.border}`,
        background: isRecording ? 'rgba(239,68,68,.03)' : 'rgba(0,0,0,.2)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isRecording && (
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: C.red,
              animation: 'tape-pulse 1.2s ease infinite',
            }} />
          )}
          <span style={{ fontWeight: 600, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: C.bright }}>TAPE</span>
          {(isRecording || isStopped) && (
            <span style={{ color: C.dim, fontSize: 9, fontVariantNumeric: 'tabular-nums' }}>{elapsedStr}</span>
          )}
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: C.dim,
          cursor: 'pointer', fontSize: 13, padding: '0 2px', lineHeight: 1,
        }}>×</button>
        <style>{`@keyframes tape-pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
      </div>

      {/* Controls */}
      <div style={{
        padding: '10px 12px', borderBottom: `1px solid ${C.border}`, flexShrink: 0,
        display: 'flex', gap: 6,
      }}>
        {!isRecording && !isStopped && (
          <RecBtn label="Start Recording" color={C.red} onClick={onStart} wide />
        )}
        {isRecording && (
          <RecBtn label="Stop" color={C.red} onClick={onStop} wide />
        )}
        {isStopped && (
          <>
            <RecBtn label="New Recording" color={C.bright} onClick={onReset} wide />
          </>
        )}
      </div>

      {/* Content */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {/* Idle state */}
        {!isRecording && !isStopped && !hasContent && (
          <div style={{ textAlign: 'center', paddingTop: 40, color: C.dim, fontSize: 10, lineHeight: 2 }}>
            Hit record. Start talking. Click elements.<br />
            TAPE captures your voice and maps each<br />
            comment to the element you clicked.<br /><br />
            Requires microphone permission.<br />
            Works in Chrome, Edge, Safari.
          </div>
        )}

        {/* Live recording view */}
        {isRecording && (
          <>
            <Card title="Recording...">
              <div style={{ fontSize: 9, color: C.dim, marginBottom: 6 }}>
                {recording.markers.length} click{recording.markers.length !== 1 ? 's' : ''} · {recording.segments.filter(s => s.isFinal).length} transcript{recording.segments.filter(s => s.isFinal).length !== 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: 9, color: C.text, lineHeight: 1.6 }}>
                Click elements while talking. Each click gets pinned to your nearest comment.
              </div>
            </Card>

            {/* Live transcript */}
            {recording.segments.length > 0 && (
              <Card title="Live transcript">
                {recording.segments.map((seg, i) => (
                  <div key={i} style={{
                    padding: '3px 0', fontSize: 10, lineHeight: 1.5,
                    color: seg.isFinal ? C.bright : C.dim,
                    fontStyle: seg.isFinal ? 'normal' : 'italic',
                  }}>
                    <span style={{ color: C.dim, fontSize: 8, marginRight: 6 }}>
                      {Math.floor(seg.startTime / 1000)}s
                    </span>
                    {seg.text}
                  </div>
                ))}
              </Card>
            )}

            {/* Live markers */}
            {recording.markers.length > 0 && (
              <Card title="Click markers">
                {recording.markers.map(m => (
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '3px 6px', marginBottom: 2,
                    background: C.card2, borderRadius: 4,
                  }}>
                    <span style={{ color: C.red, fontSize: 8 }}>●</span>
                    <span style={{ color: C.bright, fontSize: 9 }}>{m.shortSelector}</span>
                    <span style={{ color: C.dim, fontSize: 8, marginLeft: 'auto' }}>
                      {Math.floor(m.timestamp / 1000)}s
                    </span>
                  </div>
                ))}
              </Card>
            )}
          </>
        )}

        {/* Stopped: show merged comments */}
        {isStopped && (
          <>
            {/* Stats */}
            {report && (
              <Card title={`${report.commentCount} comments · ${report.duration}`}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(['negative', 'positive', 'question', 'neutral'] as const).map(s => {
                    const count = comments.filter(c => c.sentiment === s).length
                    if (count === 0) return null
                    const cfg = SENTIMENT_CONFIG[s]
                    return (
                      <span key={s} style={{
                        display: 'flex', alignItems: 'center', gap: 3,
                        padding: '2px 6px', borderRadius: 3,
                        background: cfg.bg, color: cfg.color,
                        fontSize: 8, textTransform: 'uppercase', letterSpacing: '.04em',
                      }}>
                        <span>{cfg.icon}</span> {count} {cfg.label}
                      </span>
                    )
                  })}
                </div>
              </Card>
            )}

            {/* Export buttons */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              <CopyBtn label={copied === 'agent' ? 'Copied!' : 'Agent'} active={copied === 'agent'} primary onClick={() => handleCopy('agent')} />
              <CopyBtn label={copied === 'markdown' ? 'Copied!' : 'Markdown'} active={copied === 'markdown'} onClick={() => handleCopy('markdown')} />
              <CopyBtn label={copied === 'json' ? 'Copied!' : 'JSON'} active={copied === 'json'} onClick={() => handleCopy('json')} />
            </div>

            {/* Comment list */}
            {comments.map(comment => {
              const cfg = SENTIMENT_CONFIG[comment.sentiment]
              const expanded = expandedComment === comment.id

              return (
                <div key={comment.id} style={{
                  background: C.card, border: `1px solid ${expanded ? C.border2 : C.border}`,
                  borderRadius: 6, marginBottom: 3, overflow: 'hidden',
                }}>
                  <div onClick={() => setExpandedComment(expanded ? null : comment.id)} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 6,
                    padding: '6px 8px', cursor: 'pointer',
                  }}>
                    <span style={{
                      background: cfg.bg, color: cfg.color,
                      padding: '1px 5px', borderRadius: 3, flexShrink: 0,
                      fontSize: 7, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 1,
                    }}>{cfg.icon} {cfg.label}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {comment.marker && (
                        <div style={{ color: C.blue, fontSize: 9, marginBottom: 2 }}>
                          {comment.marker.shortSelector}
                        </div>
                      )}
                      <div style={{ color: C.bright, fontSize: 10, lineHeight: 1.5 }}>
                        "{comment.transcript}"
                      </div>
                    </div>
                    <span style={{ color: C.dim, fontSize: 8, flexShrink: 0 }}>
                      {Math.floor(comment.timestamp / 1000)}s
                    </span>
                  </div>

                  {expanded && comment.marker && (
                    <div style={{ padding: '0 8px 8px', borderTop: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 8, color: C.dim, marginTop: 6, wordBreak: 'break-all', marginBottom: 4 }}>
                        {comment.marker.selector}
                      </div>
                      {Object.entries(comment.marker.styles).slice(0, 8).map(([k, v]) => (
                        <div key={k} style={{
                          display: 'flex', justifyContent: 'space-between', padding: '1px 4px',
                          fontSize: 9,
                        }}>
                          <span style={{ color: C.dim }}>{k.replace(/([A-Z])/g, '-$1').toLowerCase()}</span>
                          <span style={{ color: C.text }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Agent preview */}
            {report && (
              <Card title="Agent instructions preview">
                <pre style={{
                  background: '#080810', borderRadius: 4, padding: 8,
                  fontSize: 8, lineHeight: 1.6, color: C.dim,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  maxHeight: 300, overflow: 'auto', margin: 0,
                }}>
                  {exportAgentInstructions(report)}
                </pre>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Shared ──────────────────────────────────────────────────

function Card({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 6, padding: 10, marginBottom: 8,
    }}>
      {title && <div style={{ fontSize: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.1em', color: C.dim, marginBottom: 6 }}>{title}</div>}
      {children}
    </div>
  )
}

function RecBtn({ label, color, onClick, wide }: { label: string; color: string; onClick: () => void; wide?: boolean }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 12px', background: `${color}12`,
      border: `1px solid ${color}25`, borderRadius: 5,
      color, fontFamily: 'inherit', fontSize: 9,
      cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.06em',
      width: wide ? '100%' : undefined, transition: 'all .12s',
    }}>{label}</button>
  )
}

function CopyBtn({ label, onClick, active, primary }: { label: string; onClick: () => void; active?: boolean; primary?: boolean }) {
  const color = active ? C.green : primary ? C.red : C.text
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '5px 10px',
      background: active ? C.greenBg : primary ? C.redBg : C.card,
      border: `1px solid ${active ? C.green + '30' : primary ? C.red + '25' : C.border}`,
      borderRadius: 5, color,
      fontFamily: 'inherit', fontSize: 8, cursor: 'pointer',
      textTransform: 'uppercase', letterSpacing: '.04em', transition: 'all .15s',
    }}>{label}</button>
  )
}
