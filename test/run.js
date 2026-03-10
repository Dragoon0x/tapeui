// ═══════════════════════════════════════════
// TAPE — Tests
// ═══════════════════════════════════════════
// Tests run against the built dist (CJS).
// Run: npm test

const {
  mergeComments,
  buildReport,
  exportMarkdown,
  exportAgentInstructions,
  exportJSON,
  detectSentiment,
  TAPE_COLORS,
  SENTIMENT_CONFIG,
} = require('../dist/index.js')

let passed = 0
let failed = 0

function assert(condition, msg) {
  if (condition) { passed++; console.log(`  ✓ ${msg}`) }
  else { failed++; console.error(`  ✗ ${msg}`) }
}

function assertEq(a, b, msg) {
  assert(a === b, `${msg} (got: ${JSON.stringify(a)}, expected: ${JSON.stringify(b)})`)
}

// ─── Sentiment Detection ─────────────────────

console.log('\n  Sentiment Detection')

assertEq(detectSentiment('This font weight is way too heavy'), 'negative', 'Detects "too heavy" as negative')
assertEq(detectSentiment('The button padding is aggressive'), 'negative', 'Detects "aggressive" as negative')
assertEq(detectSentiment('This looks ugly and broken'), 'negative', 'Detects "ugly" + "broken" as negative')
assertEq(detectSentiment('Fix this immediately'), 'negative', 'Detects "fix" as negative')
assertEq(detectSentiment('Love this card layout'), 'positive', 'Detects "love" as positive')
assertEq(detectSentiment('The spacing looks great here'), 'positive', 'Detects "great" as positive')
assertEq(detectSentiment('Perfect, keep this as-is'), 'positive', 'Detects "perfect" + "keep" as positive')
assertEq(detectSentiment('Nice work, solid design'), 'positive', 'Detects "nice" + "solid" as positive')
assertEq(detectSentiment('Why is this left-aligned?'), 'question', 'Detects "why" as question')
assertEq(detectSentiment('Should we change the color?'), 'question', 'Detects "should" as question')
assertEq(detectSentiment('Could we try a different approach?'), 'question', 'Detects "could" as question')
assertEq(detectSentiment('The section exists'), 'neutral', 'Classifies ambiguous as neutral')
assertEq(detectSentiment('Noted for later'), 'neutral', 'Classifies plain statement as neutral')
assertEq(detectSentiment('This is nice but too cramped'), 'negative', 'Mixed positive+negative leans negative')

// ─── Merge Comments ──────────────────────────

console.log('\n  Comment Merging')

const mockRecording = {
  id: 'rec_1',
  url: 'https://example.com',
  title: 'Test Page',
  startedAt: 1700000000000,
  duration: 15000,
  state: 'stopped',
  markers: [
    {
      id: 'mk_1', timestamp: 3000, selector: 'h3.hero-title',
      shortSelector: 'h3.hero-title', tag: 'h3',
      bounds: { x: 10, y: 20, w: 300, h: 40 },
      styles: { fontSize: '24px', fontWeight: '800', lineHeight: '1.35' },
      text: 'Welcome to our app',
    },
    {
      id: 'mk_2', timestamp: 7000, selector: 'button.cta-primary',
      shortSelector: 'button.cta-primary', tag: 'button',
      bounds: { x: 100, y: 200, w: 120, h: 44 },
      styles: { padding: '7px 18px', borderRadius: '3px', fontSize: '14px' },
      text: 'Get Started',
    },
    {
      id: 'mk_3', timestamp: 12000, selector: 'div.card-grid',
      shortSelector: 'div.card-grid', tag: 'div',
      bounds: { x: 0, y: 400, w: 800, h: 300 },
      styles: { display: 'grid', gap: '24px' },
      text: null,
    },
  ],
  segments: [
    { text: 'This font weight is way too heavy', startTime: 1500, endTime: 3500, isFinal: true },
    { text: 'Padding too aggressive needs to breathe', startTime: 5500, endTime: 7500, isFinal: true },
    { text: 'Love this card layout keep it', startTime: 10000, endTime: 12500, isFinal: true },
    { text: 'Also the overall page feels good', startTime: 14000, endTime: 15000, isFinal: true },
  ],
  comments: [],
}

const comments = mergeComments(mockRecording)

assert(comments.length === 4, `Produces 4 comments (3 markers + 1 orphan). Got ${comments.length}`)
assert(comments[0].marker !== null, 'First comment has a marker')
assert(comments[0].marker?.shortSelector === 'h3.hero-title', 'First comment pinned to h3.hero-title')
assert(comments[0].sentiment === 'negative', 'First comment detected as negative')
assert(comments[1].marker?.shortSelector === 'button.cta-primary', 'Second comment pinned to button')
assert(comments[2].marker?.shortSelector === 'div.card-grid', 'Third comment pinned to card grid')
assert(comments[2].sentiment === 'positive', 'Third comment detected as positive')

const orphans = comments.filter(c => c.marker === null)
assert(orphans.length === 1, 'Has 1 orphan comment (speech without click)')
assert(orphans[0].transcript === 'Also the overall page feels good', 'Orphan has correct transcript')

// Marker with no nearby speech
const sparseRecording = {
  ...mockRecording,
  markers: [{ ...mockRecording.markers[0], timestamp: 50000 }],
  segments: [{ text: 'Hello', startTime: 1000, endTime: 2000, isFinal: true }],
}
const sparseComments = mergeComments(sparseRecording)
assert(sparseComments.some(c => c.transcript === '(clicked without comment)'), 'Adds silent marker when no speech is near click')

// ─── Build Report ────────────────────────────

console.log('\n  Report Building')

const report = buildReport(mockRecording, comments)

assertEq(report.url, 'https://example.com', 'Report has correct URL')
assertEq(report.commentCount, 4, 'Report has correct comment count')
assert(report.comments[0].selector === 'h3.hero-title', 'Report comment has full selector')
assert(report.comments[0].styles !== null, 'Report comment has styles attached')
assert(report.comments[0].styles?.fontSize === '24px', 'Report styles include font-size')

// ─── Agent Instructions Export ───────────────

console.log('\n  Agent Instructions Export')

const agentExport = exportAgentInstructions(report)

assert(agentExport.startsWith('<design_critique>'), 'Starts with <design_critique> tag')
assert(agentExport.endsWith('</design_critique>'), 'Ends with </design_critique> tag')
assert(agentExport.includes('## Issues to fix'), 'Has issues section')
assert(agentExport.includes('## Keep as-is'), 'Has keep-as-is section')
assert(agentExport.includes('h3.hero-title'), 'Contains selector reference')
assert(agentExport.includes('font-weight: 800'), 'Includes relevant computed style for "heavy"')
assert(agentExport.includes('padding: 7px 18px'), 'Includes relevant computed style for "breathe"')
assert(!agentExport.includes('display: grid'), 'Does NOT include irrelevant styles for positive comment')

// ─── Markdown Export ─────────────────────────

console.log('\n  Markdown Export')

const mdExport = exportMarkdown(report)

assert(mdExport.includes('# Design Critique'), 'Has title')
assert(mdExport.includes('**URL:**'), 'Has URL field')
assert(mdExport.includes('## ✗ ISSUE'), 'Has issue sections')
assert(mdExport.includes('## ✓ POSITIVE'), 'Has positive sections')
assert(mdExport.includes('`h3.hero-title`'), 'Has code-formatted selector')
assert(mdExport.includes('**Computed styles:**'), 'Has computed styles section')

// ─── JSON Export ─────────────────────────────

console.log('\n  JSON Export')

const jsonExport = exportJSON(report)
const parsed = JSON.parse(jsonExport)

assert(typeof parsed === 'object', 'JSON parses correctly')
assertEq(parsed.url, 'https://example.com', 'JSON has correct URL')
assertEq(parsed.commentCount, 4, 'JSON has correct count')
assert(Array.isArray(parsed.comments), 'JSON has comments array')
assert(parsed.comments[0].styles !== null, 'JSON comments have styles')

// ─── Smart Style Matching ────────────────────

console.log('\n  Smart Style Matching')

// The agent export should attach styles relevant to what was said
// "font weight is heavy" → should include font-weight
assert(agentExport.includes('font-weight: 800'), 'Matches "heavy" to font-weight style')
// "padding needs to breathe" → should include padding
assert(agentExport.includes('padding: 7px 18px'), 'Matches "breathe" to padding style')

// ─── Types and Constants ─────────────────────

console.log('\n  Types and Constants')

assert(typeof TAPE_COLORS === 'object', 'TAPE_COLORS exported')
assert(TAPE_COLORS.red === '#ef4444', 'TAPE_COLORS.red is correct')
assert(typeof SENTIMENT_CONFIG === 'object', 'SENTIMENT_CONFIG exported')
assert(SENTIMENT_CONFIG.positive.icon === '✓', 'Positive sentiment icon correct')
assert(SENTIMENT_CONFIG.negative.icon === '✗', 'Negative sentiment icon correct')
assert(SENTIMENT_CONFIG.question.icon === '?', 'Question sentiment icon correct')

// ─── Edge Cases ──────────────────────────────

console.log('\n  Edge Cases')

// Empty recording
const emptyRec = {
  id: 'rec_0', url: '', title: '', startedAt: 0, duration: 0,
  markers: [], segments: [], comments: [], state: 'stopped',
}
const emptyComments = mergeComments(emptyRec)
assertEq(emptyComments.length, 0, 'Empty recording produces 0 comments')

const emptyReport = buildReport(emptyRec, emptyComments)
assertEq(emptyReport.commentCount, 0, 'Empty report has 0 comments')

const emptyAgent = exportAgentInstructions(emptyReport)
assert(emptyAgent.includes('<design_critique>'), 'Empty agent export still has wrapper tags')
assert(!emptyAgent.includes('## Issues'), 'Empty agent export has no sections')

// Interim segments filtered out
const interimRec = {
  ...mockRecording,
  markers: [],
  segments: [
    { text: 'interim text', startTime: 1000, endTime: 2000, isFinal: false },
    { text: 'final text', startTime: 3000, endTime: 4000, isFinal: true },
  ],
}
const interimComments = mergeComments(interimRec)
assert(!interimComments.some(c => c.transcript === 'interim text'), 'Interim segments are filtered out')
assert(interimComments.some(c => c.transcript === 'final text'), 'Final segments are kept')

// ─── Summary ─────────────────────────────────

console.log(`\n  ${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
