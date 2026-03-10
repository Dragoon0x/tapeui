import { useCallback, useEffect, useRef, useState } from 'react'
import type { Recording, Comment, CritiqueReport } from '../types'
import { Recorder } from '../core/recorder'
import { mergeComments, buildReport, exportMarkdown, exportAgentInstructions, exportJSON } from '../core/reporter'

/**
 * useTape
 *
 * Programmatic access to TAPE recording.
 *
 * ```tsx
 * const { start, stop, comments, report, exportAgent } = useTape()
 * start()
 * // ... user talks and clicks ...
 * stop()
 * console.log(exportAgent())
 * ```
 */
export function useTape(opts?: { language?: string; ignoreSelectors?: string[] }) {
  const language = opts?.language ?? 'en-US'
  const ignoreSelectors = opts?.ignoreSelectors ?? ['[data-tape-ui]']

  const recorderRef = useRef<Recorder | null>(null)
  const [recording, setRecording] = useState<Recording | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [report, setReport] = useState<CritiqueReport | null>(null)

  useEffect(() => {
    recorderRef.current = new Recorder(language, ignoreSelectors)
    const unsub = recorderRef.current.subscribe(setRecording)
    return () => { unsub(); recorderRef.current?.stop() }
  }, [language, ignoreSelectors])

  const start = useCallback(() => {
    recorderRef.current?.start()
  }, [])

  const stop = useCallback((): CritiqueReport | null => {
    if (!recorderRef.current) return null
    const rec = recorderRef.current.stop()
    const merged = mergeComments(rec)
    const rpt = buildReport(rec, merged)
    setComments(merged)
    setReport(rpt)
    return rpt
  }, [])

  const reset = useCallback(() => {
    recorderRef.current?.reset()
    setComments([])
    setReport(null)
  }, [])

  const exportAgent = useCallback((): string => {
    if (!report) return ''
    return exportAgentInstructions(report)
  }, [report])

  const exportMD = useCallback((): string => {
    if (!report) return ''
    return exportMarkdown(report)
  }, [report])

  const exportJSONStr = useCallback((): string => {
    if (!report) return ''
    return exportJSON(report)
  }, [report])

  return {
    recording,
    comments,
    report,
    isRecording: recording?.state === 'recording',
    start,
    stop,
    reset,
    exportAgent,
    exportMarkdown: exportMD,
    exportJSON: exportJSONStr,
  }
}
