import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { TapeProps, Recording, Comment, CritiqueReport } from '../types'
import { Recorder } from '../core/recorder'
import { mergeComments, buildReport } from '../core/reporter'
import { Panel } from './Panel'

let fontInjected = false
function injectFont() {
  if (fontInjected || typeof document === 'undefined') return
  fontInjected = true
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap'
  document.head.appendChild(link)
}

/**
 * <Tape />
 *
 * Record design critiques by talking and clicking.
 * Voice → transcription. Clicks → selectors + computed styles.
 * Output → structured critique your agent can action.
 *
 * ```jsx
 * <Tape />
 * ```
 */
export function Tape({
  shortcut = 'Alt+T',
  ignoreSelectors = ['[data-tape-ui]'],
  language = 'en-US',
  zIndex = 99999,
  onReport,
}: TapeProps) {
  const [visible, setVisible] = useState(false)
  const [recording, setRecording] = useState<Recording | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [report, setReport] = useState<CritiqueReport | null>(null)
  const recorderRef = useRef<Recorder | null>(null)

  useEffect(() => { injectFont() }, [])

  // Create recorder
  useEffect(() => {
    recorderRef.current = new Recorder(language, ignoreSelectors)
    const unsub = recorderRef.current.subscribe((rec) => {
      setRecording({ ...rec })
    })
    return () => { unsub(); recorderRef.current?.stop() }
  }, [language, ignoreSelectors])

  // Keyboard shortcut
  useEffect(() => {
    const parts = shortcut.split('+').map(s => s.trim().toLowerCase())
    const key = parts[parts.length - 1]
    const alt = parts.includes('alt')
    const ctrl = parts.includes('ctrl') || parts.includes('control')
    const shift = parts.includes('shift')
    const meta = parts.includes('meta') || parts.includes('cmd')

    const handleKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === key && e.altKey === alt && e.ctrlKey === ctrl && e.shiftKey === shift && e.metaKey === meta) {
        e.preventDefault()
        setVisible(prev => !prev)
      }
      if (e.key === 'Escape' && visible) setVisible(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [shortcut, visible])

  const handleStart = useCallback(() => {
    if (!recorderRef.current) return
    recorderRef.current.start()
  }, [])

  const handleStop = useCallback(() => {
    if (!recorderRef.current) return
    const rec = recorderRef.current.stop()
    const merged = mergeComments(rec)
    const rpt = buildReport(rec, merged)
    setComments(merged)
    setReport(rpt)
    onReport?.(rpt)
  }, [onReport])

  const handleReset = useCallback(() => {
    if (!recorderRef.current) return
    recorderRef.current.reset()
    setComments([])
    setReport(null)
  }, [])

  const handleClose = useCallback(() => {
    setVisible(false)
  }, [])

  const currentRecording = recording || {
    id: '', url: '', title: '', startedAt: 0, duration: 0,
    markers: [], segments: [], comments: [], state: 'idle' as const,
  }

  if (!visible) {
    return (
      <div data-tape-ui style={{ position: 'fixed', bottom: 16, right: 16, zIndex }}>
        <button
          onClick={() => setVisible(true)}
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: '#0a0a0e', border: '1px solid #1c1c24',
            color: currentRecording.state === 'recording' ? '#ef4444' : '#ef4444',
            fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,.4)', transition: 'all .2s',
            fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
            animation: currentRecording.state === 'recording' ? 'tape-btn-pulse 1.5s ease infinite' : 'none',
          }}
          title={`Toggle Tape (${shortcut})`}
        >
          ●
        </button>
        <style>{`@keyframes tape-btn-pulse{0%,100%{box-shadow:0 4px 16px rgba(0,0,0,.4)}50%{box-shadow:0 4px 16px rgba(239,68,68,.3)}}`}</style>
      </div>
    )
  }

  return (
    <Panel
      recording={currentRecording}
      comments={comments}
      report={report}
      onStart={handleStart}
      onStop={handleStop}
      onReset={handleReset}
      onClose={handleClose}
      zIndex={zIndex}
    />
  )
}
