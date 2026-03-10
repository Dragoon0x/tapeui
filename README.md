# tapeui

> Experimental software. DYOR. Use at your own risk.

Record design critiques by talking and clicking. Voice gets transcribed, clicks get pinned to CSS selectors with computed styles attached. Output is a structured review your AI agent can action without you typing a word.

```
npm install tapeui
```

You're staring at your app. The heading weight is wrong. The button padding is too aggressive. The footer text is barely readable. Instead of opening a text editor and describing each issue, you hit record, start talking, and click each element. "This font weight is way too heavy." Click. "Padding needs to breathe." Click. "Love this card layout, keep it." Click. Stop. TAPE produces a structured critique with each comment pinned to a selector, sentiment classified, and computed styles attached.

## Quick start

```jsx
import { Tape } from 'tapeui'

function App() {
  return (
    <>
      <YourApp />
      <Tape />
    </>
  )
}
```

Press `Alt+T` to toggle. Hit record. Talk and click. Stop. Export.

## How it works

1. **Record** — TAPE starts the Web Speech API for live transcription and begins capturing element clicks.
2. **Talk + click** — Speak naturally. Click elements as you mention them. TAPE timestamps everything.
3. **Merge** — When you stop, TAPE matches each click to the nearest transcript segment within a 3-second window. Each pair becomes a comment.
4. **Classify** — Sentiment detection flags each comment as an issue, positive, question, or note based on word patterns.
5. **Export** — Copy as agent instructions (`<design_critique>` block), markdown, or JSON.

## What it captures per click

Every element you click gets a full context snapshot:

- **CSS selector** — Unique path using id, data-testid, classes, nth-child fallback
- **Computed styles** — 25+ properties: spacing, colors, typography, shadows, borders, layout
- **Text content** — First 100 characters of direct text nodes
- **Bounding box** — Position and dimensions at click time
- **Tag name** — For element type context

## Sentiment detection

TAPE classifies comments by analyzing transcript text:

- **Issue** — "wrong", "too much", "fix", "ugly", "broken", "aggressive", "cramped"
- **Positive** — "love", "great", "perfect", "keep", "clean", "solid", "nice"
- **Question** — "why", "should", "could", "is this", "what if"
- **Note** — Everything else

## The agent instructions format

The primary export groups issues first, positives as "keep as-is", and attaches relevant computed styles inline:

```xml
<design_critique>
<!-- URL: https://app.example.com — 6 comments, 0m 34s -->

## Issues to fix (3)

- **h3.hero-title**: This font weight is way too heavy
  (current: font-weight: 800, line-height: 1.35)
- **button.cta-primary**: Padding too aggressive, needs to breathe
  (current: padding: 7px 18px, border-radius: 3px)
- **p.footer-text**: Barely readable, too small and faded
  (current: font-size: 10px, color: #bbb)

## Keep as-is (2)

- **div.card-grid**: Card layout spacing feels right
- **div.mini-card**: Shadow is perfect

## Questions (1)

- **div.hero-section**: Should this be left-aligned?

</design_critique>
```

Paste into Cursor rules, CLAUDE.md, Copilot instructions, or any system prompt. Your agent reads it and executes.

## Programmatic API

```tsx
import { useTape } from 'tapeui'

const { start, stop, exportAgent, exportMarkdown, comments, isRecording } = useTape()

start()
// ... user talks and clicks ...
const report = stop()
console.log(exportAgent())
```

## Smart style attachment

TAPE matches transcript keywords to relevant styles. If you say "padding is too aggressive", the export includes the current padding value. If you say "font is too heavy", it includes font-weight and font-size. Your agent gets the exact context it needs to understand your complaint.

## Props

| Prop | Default | Description |
|------|---------|-------------|
| `shortcut` | `'Alt+T'` | Keyboard toggle |
| `language` | `'en-US'` | Speech recognition language |
| `ignoreSelectors` | `['[data-tape-ui]']` | Selectors to skip on click |
| `zIndex` | `99999` | Z-index for panel |
| `onReport` | — | Callback with CritiqueReport on stop |

## Browser support

Speech recognition uses the Web Speech API (Chrome, Edge, Safari). Firefox has partial support. If the browser doesn't support speech recognition, TAPE still captures clicks with element context — you just won't get transcription.

## Disclaimer

Experimental, open-source software provided as-is. No warranties, no guarantees. Use at your own risk. DYOR. The author assumes no liability for any issues arising from the use of this software.

## License

MIT. Built by 0xDragoon.
