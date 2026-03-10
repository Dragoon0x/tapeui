import type { Marker, Segment, Recording } from '../types'

type RecorderListener = (recording: Recording) => void

let markerCounter = 0
let recCounter = 0
function uid(prefix: string): string { return `${prefix}_${++markerCounter}_${Date.now()}` }

const STYLE_KEYS = [
  'display', 'position', 'width', 'height',
  'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'gap', 'backgroundColor', 'color', 'borderColor', 'borderWidth', 'borderRadius',
  'boxShadow', 'opacity', 'fontSize', 'fontWeight', 'fontFamily', 'lineHeight',
  'textAlign', 'transform',
]

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT'])

export class Recorder {
  private recording: Recording
  private listeners = new Set<RecorderListener>()
  private recognition: any = null
  private startTime = 0
  private ignoreSelectors: string[]
  private language: string
  private clickHandler: ((e: MouseEvent) => void) | null = null

  constructor(language = 'en-US', ignoreSelectors: string[] = ['[data-tape-ui]']) {
    this.language = language
    this.ignoreSelectors = ignoreSelectors
    this.recording = this.freshRecording()
  }

  // ─── Subscription ──────────────────────────────────────────

  subscribe(listener: RecorderListener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    const snapshot = { ...this.recording, markers: [...this.recording.markers], segments: [...this.recording.segments], comments: [...this.recording.comments] }
    this.listeners.forEach(l => l(snapshot))
  }

  getRecording(): Recording { return this.recording }

  // ─── Controls ──────────────────────────────────────────────

  start(): boolean {
    if (this.recording.state === 'recording') return false

    // Check Speech Recognition support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.warn('TAPE: SpeechRecognition not supported in this browser')
      // Still allow recording clicks without voice
    }

    this.recording = this.freshRecording()
    this.recording.state = 'recording'
    this.startTime = Date.now()
    this.recording.startedAt = this.startTime

    // Start speech recognition
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition()
      this.recognition.continuous = true
      this.recognition.interimResults = true
      this.recognition.lang = this.language
      this.recognition.maxAlternatives = 1

      this.recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          const text = result[0].transcript.trim()
          if (!text) continue

          const now = Date.now() - this.startTime
          const existing = this.recording.segments.find(s => !s.isFinal && s.startTime === (this.recording.segments.filter(ss => !ss.isFinal)[0]?.startTime ?? now))

          if (result.isFinal) {
            // Replace interim with final
            this.recording.segments = this.recording.segments.filter(s => s.isFinal)
            this.recording.segments.push({
              text,
              startTime: now - estimateDuration(text),
              endTime: now,
              isFinal: true,
            })
          } else {
            // Update interim
            const interims = this.recording.segments.filter(s => !s.isFinal)
            if (interims.length === 0) {
              this.recording.segments.push({
                text,
                startTime: now,
                endTime: now,
                isFinal: false,
              })
            } else {
              interims[interims.length - 1].text = text
              interims[interims.length - 1].endTime = now
            }
          }

          this.recording.duration = Date.now() - this.startTime
          this.notify()
        }
      }

      this.recognition.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return
        console.warn('TAPE speech error:', event.error)
      }

      this.recognition.onend = () => {
        // Auto-restart if still recording
        if (this.recording.state === 'recording' && this.recognition) {
          try { this.recognition.start() } catch {}
        }
      }

      try { this.recognition.start() } catch (e) {
        console.warn('TAPE: Could not start speech recognition:', e)
      }
    }

    // Start click capture
    this.clickHandler = (e: MouseEvent) => {
      if (this.recording.state !== 'recording') return
      const target = e.target as Element
      if (!target || !(target instanceof HTMLElement)) return

      // Skip own UI
      for (const sel of this.ignoreSelectors) {
        try { if (target.matches(sel) || target.closest(sel)) return } catch {}
      }
      if (SKIP_TAGS.has(target.tagName)) return

      e.preventDefault()
      e.stopPropagation()

      const marker = this.captureMarker(target)
      this.recording.markers.push(marker)
      this.recording.duration = Date.now() - this.startTime
      this.notify()
    }

    document.addEventListener('click', this.clickHandler, true)
    this.notify()
    return true
  }

  stop(): Recording {
    if (this.recording.state !== 'recording' && this.recording.state !== 'paused') return this.recording

    this.recording.state = 'stopped'
    this.recording.duration = Date.now() - this.startTime

    // Stop speech recognition
    if (this.recognition) {
      try { this.recognition.stop() } catch {}
      this.recognition = null
    }

    // Remove click handler
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler, true)
      this.clickHandler = null
    }

    // Clean up: remove interim segments
    this.recording.segments = this.recording.segments.filter(s => s.isFinal)

    this.notify()
    return this.recording
  }

  reset(): void {
    this.stop()
    this.recording = this.freshRecording()
    this.notify()
  }

  // ─── Marker Capture ────────────────────────────────────────

  private captureMarker(el: HTMLElement): Marker {
    const cs = window.getComputedStyle(el)
    const rect = el.getBoundingClientRect()

    const styles: Record<string, string> = {}
    for (const key of STYLE_KEYS) {
      const val = (cs as any)[key]
      if (val && val !== '' && val !== 'none' && val !== 'normal' && val !== 'auto' && val !== '0px' && val !== 'rgba(0, 0, 0, 0)') {
        styles[key] = val
      }
    }

    // Collapse padding/margin
    styles.padding = collapse(cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft)
    styles.margin = collapse(cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft)
    delete styles.paddingTop; delete styles.paddingRight; delete styles.paddingBottom; delete styles.paddingLeft
    delete styles.marginTop; delete styles.marginRight; delete styles.marginBottom; delete styles.marginLeft

    if (styles.fontFamily) styles.fontFamily = styles.fontFamily.split(',')[0].trim().replace(/"/g, '')

    let text: string | null = null
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = child.textContent?.trim()
        if (t) text = (text || '') + t
      }
    }
    if (text && text.length > 100) text = text.slice(0, 100) + '...'

    return {
      id: uid('mk'),
      timestamp: Date.now() - this.startTime,
      selector: getSelector(el),
      shortSelector: getShortSelector(el),
      tag: el.tagName.toLowerCase(),
      bounds: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
      styles,
      text,
    }
  }

  // ─── Helpers ───────────────────────────────────────────────

  private freshRecording(): Recording {
    return {
      id: `rec_${++recCounter}_${Date.now()}`,
      url: typeof window !== 'undefined' ? window.location.href : '',
      title: typeof document !== 'undefined' ? document.title : '',
      startedAt: 0,
      duration: 0,
      markers: [],
      segments: [],
      comments: [],
      state: 'idle',
    }
  }
}

// ─── Utilities ───────────────────────────────────────────────

function estimateDuration(text: string): number {
  // Rough: ~150 words per minute = ~2.5 words/sec
  const words = text.split(/\s+/).length
  return Math.max(500, (words / 2.5) * 1000)
}

function collapse(t: string, r: string, b: string, l: string): string {
  if (t === r && r === b && b === l) return t
  if (t === b && r === l) return `${t} ${r}`
  return `${t} ${r} ${b} ${l}`
}

function getSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`
  const testId = el.getAttribute('data-testid')
  if (testId) return `[data-testid="${testId}"]`
  const path: string[] = []
  let current: Element | null = el
  while (current && current !== document.documentElement) {
    let seg = current.tagName.toLowerCase()
    if (current.id) { path.unshift(`#${CSS.escape(current.id)}`); break }
    const classes = Array.from(current.classList).filter(c => c.length > 2 && !/^[a-z]{1,3}-[a-zA-Z0-9_-]{5,}$/.test(c)).slice(0, 2)
    if (classes.length) seg += '.' + classes.map(c => CSS.escape(c)).join('.')
    const parent = current.parentElement
    if (parent) {
      const siblings = Array.from(parent.children).filter(s => s.tagName === current!.tagName)
      if (siblings.length > 1) seg += `:nth-child(${siblings.indexOf(current) + 1})`
    }
    path.unshift(seg)
    current = current.parentElement
  }
  return path.join(' > ')
}

function getShortSelector(el: Element): string {
  const tag = el.tagName.toLowerCase()
  if (el.id) return `${tag}#${el.id}`
  const classes = Array.from(el.classList).filter(c => c.length > 2).slice(0, 2)
  if (classes.length) return `${tag}.${classes.join('.')}`
  return tag
}
