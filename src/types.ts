// ─── Sentiment ───────────────────────────────────────────────

export type Sentiment = 'positive' | 'negative' | 'neutral' | 'question'

// ─── Element Marker ──────────────────────────────────────────

export interface Marker {
  id: string
  /** When the click happened (ms from recording start) */
  timestamp: number
  /** CSS selector */
  selector: string
  /** Short display selector */
  shortSelector: string
  /** Tag name */
  tag: string
  /** Bounding box at click time */
  bounds: { x: number; y: number; w: number; h: number }
  /** Curated computed styles */
  styles: Record<string, string>
  /** Text content (first 100 chars) */
  text: string | null
}

// ─── Transcript Segment ──────────────────────────────────────

export interface Segment {
  /** Transcribed text */
  text: string
  /** Start time (ms from recording start) */
  startTime: number
  /** End time */
  endTime: number
  /** Whether this is a final (stable) result */
  isFinal: boolean
}

// ─── Comment (merged marker + transcript) ────────────────────

export interface Comment {
  id: string
  /** The spoken feedback */
  transcript: string
  /** Detected sentiment */
  sentiment: Sentiment
  /** Pinned element (null = general comment) */
  marker: Marker | null
  /** Timestamp from recording start (ms) */
  timestamp: number
  /** Duration of this comment (ms) */
  duration: number
}

// ─── Recording Session ───────────────────────────────────────

export interface Recording {
  id: string
  /** Page URL */
  url: string
  /** Page title */
  title: string
  /** When recording started */
  startedAt: number
  /** Duration in ms */
  duration: number
  /** All markers (clicks) */
  markers: Marker[]
  /** All transcript segments */
  segments: Segment[]
  /** Merged comments */
  comments: Comment[]
  /** Recording state */
  state: 'idle' | 'recording' | 'paused' | 'stopped'
}

// ─── Critique Report ─────────────────────────────────────────

export interface CritiqueReport {
  url: string
  title: string
  timestamp: string
  duration: string
  commentCount: number
  comments: {
    index: number
    sentiment: Sentiment
    transcript: string
    selector: string | null
    shortSelector: string | null
    tag: string | null
    styles: Record<string, string> | null
    time: string
  }[]
}

// ─── Component Props ─────────────────────────────────────────

export interface TapeProps {
  /** Keyboard shortcut. Default: 'Alt+T' */
  shortcut?: string
  /** Ignore selectors. Default: ['[data-tape-ui]'] */
  ignoreSelectors?: string[]
  /** Language for speech recognition. Default: 'en-US' */
  language?: string
  /** Z-index. Default: 99999 */
  zIndex?: number
  /** Callback when recording stops with full report */
  onReport?: (report: CritiqueReport) => void
}

// ─── Colors ──────────────────────────────────────────────────

export const TAPE_COLORS = {
  bg: '#0a0a0e',
  card: '#111116',
  card2: '#161620',
  border: '#1c1c24',
  border2: '#252530',
  dim: '#505060',
  text: '#909098',
  bright: '#e0e0e8',
  red: '#ef4444',
  redBg: 'rgba(239, 68, 68, 0.08)',
  redDim: 'rgba(239, 68, 68, 0.4)',
  green: '#4ade80',
  greenBg: 'rgba(74, 222, 128, 0.06)',
  yellow: '#fbbf24',
  yellowBg: 'rgba(251, 191, 36, 0.06)',
  blue: '#60a5fa',
  blueBg: 'rgba(96, 165, 250, 0.06)',
  accent: '#ef4444',
} as const

export const SENTIMENT_CONFIG: Record<Sentiment, { color: string; bg: string; icon: string; label: string }> = {
  positive: { color: TAPE_COLORS.green, bg: TAPE_COLORS.greenBg, icon: '✓', label: 'positive' },
  negative: { color: TAPE_COLORS.red, bg: TAPE_COLORS.redBg, icon: '✗', label: 'issue' },
  neutral:  { color: TAPE_COLORS.text, bg: 'rgba(144,144,152,.06)', icon: '●', label: 'note' },
  question: { color: TAPE_COLORS.yellow, bg: TAPE_COLORS.yellowBg, icon: '?', label: 'question' },
}
