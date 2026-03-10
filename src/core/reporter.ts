import type { Recording, Comment, Marker, Segment, Sentiment, CritiqueReport } from '../types'

let commentCounter = 0
function uid(): string { return `cmt_${++commentCounter}` }

const MERGE_WINDOW = 3000 // ms window to associate a click with surrounding speech

/**
 * Merge transcript segments with click markers into comments.
 * Associates each marker with the nearest transcript text within a time window.
 */
export function mergeComments(recording: Recording): Comment[] {
  const finalSegments = recording.segments.filter(s => s.isFinal)
  const markers = [...recording.markers].sort((a, b) => a.timestamp - b.timestamp)
  const comments: Comment[] = []
  const usedSegments = new Set<number>()

  // For each marker, find the closest transcript segment
  for (const marker of markers) {
    let bestSegment: Segment | null = null
    let bestDist = Infinity
    let bestIdx = -1

    for (let i = 0; i < finalSegments.length; i++) {
      if (usedSegments.has(i)) continue
      const seg = finalSegments[i]
      // Check if segment is within window of click
      const distStart = Math.abs(marker.timestamp - seg.startTime)
      const distEnd = Math.abs(marker.timestamp - seg.endTime)
      const dist = Math.min(distStart, distEnd)

      // Segment should be close to click (before or after)
      if (dist < MERGE_WINDOW && dist < bestDist) {
        bestSegment = seg
        bestDist = dist
        bestIdx = i
      }
    }

    if (bestSegment) {
      usedSegments.add(bestIdx)
      comments.push({
        id: uid(),
        transcript: bestSegment.text,
        sentiment: detectSentiment(bestSegment.text),
        marker,
        timestamp: marker.timestamp,
        duration: bestSegment.endTime - bestSegment.startTime,
      })
    } else {
      // Click without speech — add as silent marker
      comments.push({
        id: uid(),
        transcript: '(clicked without comment)',
        sentiment: 'neutral',
        marker,
        timestamp: marker.timestamp,
        duration: 0,
      })
    }
  }

  // Add orphan segments (speech without clicks)
  for (let i = 0; i < finalSegments.length; i++) {
    if (usedSegments.has(i)) continue
    const seg = finalSegments[i]
    comments.push({
      id: uid(),
      transcript: seg.text,
      sentiment: detectSentiment(seg.text),
      marker: null,
      timestamp: seg.startTime,
      duration: seg.endTime - seg.startTime,
    })
  }

  return comments.sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * Simple sentiment detection from transcript text.
 */
export function detectSentiment(text: string): Sentiment {
  const lower = text.toLowerCase()

  // Positive patterns
  const posPatterns = /\b(love|like|good|great|nice|perfect|clean|beautiful|well done|solid|correct|keep|awesome|excellent)\b/
  // Negative patterns
  const negPatterns = /\b(wrong|bad|ugly|broken|hate|too much|too little|not enough|fix|issue|problem|aggressive|cramped|cluttered|harsh|heavy|light|weak|off|weird|gross)\b/
  // Question patterns
  const qPatterns = /\b(why|what|how|should|could|would|is this|are these|can we)\b|\?$/

  const hasPos = posPatterns.test(lower)
  const hasNeg = negPatterns.test(lower)
  const hasQ = qPatterns.test(lower)

  if (hasQ && !hasNeg) return 'question'
  if (hasNeg && !hasPos) return 'negative'
  if (hasPos && !hasNeg) return 'positive'
  if (hasNeg && hasPos) return 'negative' // mixed leans negative in critique context
  return 'neutral'
}

/**
 * Build structured critique report.
 */
export function buildReport(recording: Recording, comments: Comment[]): CritiqueReport {
  return {
    url: recording.url,
    title: recording.title,
    timestamp: new Date(recording.startedAt).toISOString(),
    duration: formatDuration(recording.duration),
    commentCount: comments.length,
    comments: comments.map((c, i) => ({
      index: i + 1,
      sentiment: c.sentiment,
      transcript: c.transcript,
      selector: c.marker?.selector || null,
      shortSelector: c.marker?.shortSelector || null,
      tag: c.marker?.tag || null,
      styles: c.marker?.styles || null,
      time: formatTime(c.timestamp),
    })),
  }
}

/**
 * Export as structured markdown for agent consumption.
 */
export function exportMarkdown(report: CritiqueReport): string {
  const lines: string[] = []
  lines.push(`# Design Critique`)
  lines.push('')
  lines.push(`**URL:** ${report.url}`)
  lines.push(`**Recorded:** ${new Date(report.timestamp).toLocaleString()}`)
  lines.push(`**Duration:** ${report.duration}`)
  lines.push(`**Comments:** ${report.commentCount}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  for (const c of report.comments) {
    const icon = c.sentiment === 'positive' ? '✓' : c.sentiment === 'negative' ? '✗' : c.sentiment === 'question' ? '?' : '●'
    const label = c.sentiment === 'positive' ? 'POSITIVE' : c.sentiment === 'negative' ? 'ISSUE' : c.sentiment === 'question' ? 'QUESTION' : 'NOTE'

    lines.push(`## ${icon} ${label} — ${c.time}`)
    lines.push('')
    lines.push(`> ${c.transcript}`)
    lines.push('')

    if (c.selector) {
      lines.push(`**Element:** \`${c.shortSelector}\` (\`${c.tag}\`)`)
      lines.push(`**Selector:** \`${c.selector}\``)
      if (c.styles && Object.keys(c.styles).length > 0) {
        lines.push('**Computed styles:**')
        for (const [k, v] of Object.entries(c.styles)) {
          lines.push(`- \`${formatProp(k)}: ${v}\``)
        }
      }
      lines.push('')
    }

    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Export as agent-ready instructions.
 * This is the money format — each comment becomes an actionable instruction.
 */
export function exportAgentInstructions(report: CritiqueReport): string {
  const lines: string[] = []
  lines.push(`<design_critique>`)
  lines.push(`<!-- URL: ${report.url} — ${report.commentCount} comments, ${report.duration} -->`)
  lines.push('')

  const issues = report.comments.filter(c => c.sentiment === 'negative')
  const positives = report.comments.filter(c => c.sentiment === 'positive')
  const questions = report.comments.filter(c => c.sentiment === 'question')
  const notes = report.comments.filter(c => c.sentiment === 'neutral')

  if (issues.length > 0) {
    lines.push(`## Issues to fix (${issues.length})`)
    lines.push('')
    for (const c of issues) {
      let line = `- **${c.shortSelector || 'general'}**: ${c.transcript}`
      if (c.styles) {
        const relevant = getRelevantStyles(c.transcript, c.styles)
        if (relevant.length > 0) line += ` (current: ${relevant.join(', ')})`
      }
      lines.push(line)
    }
    lines.push('')
  }

  if (positives.length > 0) {
    lines.push(`## Keep as-is (${positives.length})`)
    lines.push('')
    for (const c of positives) {
      lines.push(`- **${c.shortSelector || 'general'}**: ${c.transcript}`)
    }
    lines.push('')
  }

  if (questions.length > 0) {
    lines.push(`## Questions (${questions.length})`)
    lines.push('')
    for (const c of questions) {
      lines.push(`- **${c.shortSelector || 'general'}**: ${c.transcript}`)
    }
    lines.push('')
  }

  if (notes.length > 0) {
    lines.push(`## Notes (${notes.length})`)
    lines.push('')
    for (const c of notes) {
      lines.push(`- **${c.shortSelector || 'general'}**: ${c.transcript}`)
    }
    lines.push('')
  }

  lines.push(`</design_critique>`)
  return lines.join('\n')
}

/**
 * Export as JSON.
 */
export function exportJSON(report: CritiqueReport): string {
  return JSON.stringify(report, null, 2)
}

// ─── Helpers ─────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000)
  const min = Math.floor(sec / 60)
  const rem = sec % 60
  if (min === 0) return `${rem}s`
  return `${min}m ${rem}s`
}

function formatTime(ms: number): string {
  const sec = Math.floor(ms / 1000)
  const min = Math.floor(sec / 60)
  const rem = sec % 60
  return `${min}:${rem.toString().padStart(2, '0')}`
}

function formatProp(prop: string): string {
  return prop.replace(/([A-Z])/g, '-$1').toLowerCase()
}

function getRelevantStyles(text: string, styles: Record<string, string>): string[] {
  const lower = text.toLowerCase()
  const relevant: string[] = []

  if (/pad|spacing|space|gap|breath|cram/.test(lower)) {
    if (styles.padding) relevant.push(`padding: ${styles.padding}`)
    if (styles.gap) relevant.push(`gap: ${styles.gap}`)
    if (styles.margin) relevant.push(`margin: ${styles.margin}`)
  }
  if (/color|shade|dark|light|background/.test(lower)) {
    if (styles.backgroundColor) relevant.push(`bg: ${styles.backgroundColor}`)
    if (styles.color) relevant.push(`color: ${styles.color}`)
  }
  if (/font|text|size|weight|bold|heavy|light|heading/.test(lower)) {
    if (styles.fontSize) relevant.push(`font-size: ${styles.fontSize}`)
    if (styles.fontWeight) relevant.push(`font-weight: ${styles.fontWeight}`)
    if (styles.lineHeight) relevant.push(`line-height: ${styles.lineHeight}`)
  }
  if (/shadow|depth|flat/.test(lower)) {
    if (styles.boxShadow) relevant.push(`shadow: ${styles.boxShadow}`)
  }
  if (/round|radius|sharp|corner/.test(lower)) {
    if (styles.borderRadius) relevant.push(`radius: ${styles.borderRadius}`)
  }
  if (/border/.test(lower)) {
    if (styles.borderWidth) relevant.push(`border: ${styles.borderWidth}`)
    if (styles.borderColor) relevant.push(`border-color: ${styles.borderColor}`)
  }

  return relevant.slice(0, 4)
}
