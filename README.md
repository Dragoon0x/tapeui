# usetapeui

> The design intent capture layer between humans and AI agents.
> Talk. Click. The agent reads what you saw and edits the right files.

[dragoon0x.github.io/tapeui](https://dragoon0x.github.io/tapeui/)

```bash
npm install usetapeui
```

You're staring at your app. The heading weight is wrong. The button padding is too aggressive. The footer text is unreadable. Open TAPE, hit record, talk and click. Stop. TAPE produces a structured critique with each comment pinned to a CSS selector, the source file path, current computed styles translated into your design tokens, an optional screenshot, and a parsed intent any AI agent can execute against.

This is v1.0. It replaces the v0.x voice-only recorder with a five-pillar capture system: voice + click + vision + source + tokens. There's a session editor, a replay engine, a verify pass, a vanilla SDK, Vue and Svelte adapters, and a built-in MCP server so agents can read your sessions natively.

## Quick start (React)

```tsx
import { Tape } from 'usetapeui'

export default function App() {
  return (
    <>
      <YourApp />
      <Tape />
    </>
  )
}
```

Press `Alt+T` to toggle the panel. Hit record. Talk and click. Stop. Switch to the Export tab. Copy the agent format. Paste into Cursor, Claude Code, Copilot, or any system prompt.

## What it captures per click

| Layer        | What you get                                                          |
| ------------ | --------------------------------------------------------------------- |
| Selector     | Stable CSS path: id → data-testid → tag.class.class → nth-of-type    |
| Styles       | 35+ computed properties (spacing, type, color, layout, transforms)    |
| Source       | Component name + source file path via React/Vue/Svelte fiber walk     |
| Tokens       | Tailwind scale + CSS variables, with computed values translated back  |
| Vision       | Cropped PNG of the element (lazy, never blocks the recorder)          |
| Geometry     | Tag, classes, ARIA role, bounding box at click time                   |
| Intent       | `{ action, attribute, direction, magnitude, value }` parsed from text |
| Sentiment    | `issue`, `positive`, `question`, or `note`                            |

## What's new in v1.0

- **Vision capture** — every click takes a cropped PNG, lazy-loaded via `html-to-image`, never blocks the click pipeline
- **Source linking** — React fiber walk (16/17/18), Vue 3 component walk, Svelte meta extraction
- **Design token awareness** — auto-detect Tailwind, enumerate CSS variables, translate computed values back to tokens in the export
- **Intent extraction** — replaces the v0.x sentiment classifier with structured intent (`action / attribute / direction / magnitude / value`), still pure rules-based, deterministic, no API key
- **Reference resolution** — pronouns ("this", "that"), ordinals ("the first one"), backrefs ("the previous one") get bound to specific markers
- **Session editor** — edit comments after recording; reclassify, reorder, merge, delete
- **`.tape.json` files** — save and reload sessions as plain JSON
- **Replay** — walk a saved session step by step, with the live page highlighted
- **Verify** — re-capture styles for each saved marker and diff against the recording (great for confirming agent fixes worked)
- **Vanilla SDK** — `usetapeui/vanilla` works on any page, no React required
- **Vue 3 adapter** — `usetapeui/vue`
- **Svelte adapter** — `usetapeui/svelte`
- **MCP server** — `npx usetapeui mcp --dir ./tapes` exposes your sessions to any MCP-capable agent
- **Browser extension** — scaffold included in `extension/` for taping any site you visit

## Programmatic API (`useTape`)

```tsx
import { useTape } from 'usetapeui'

function MyToolbar() {
  const tape = useTape({ vision: true, sourceLink: true })

  return (
    <div>
      <button onClick={tape.start} disabled={tape.isRecording}>Record</button>
      <button onClick={tape.stop}  disabled={!tape.isRecording}>Stop</button>
      <pre>{tape.exportAgent()}</pre>
      <button onClick={() => tape.download()}>Save .tape</button>
      <button onClick={() => console.log(tape.verify())}>Verify</button>
    </div>
  )
}
```

Returned shape:

```ts
interface UseTapeReturn {
  state: RecorderState
  isRecording: boolean
  speechAvailable: boolean
  liveTranscript: string
  liveMarkers: ClickMarker[]
  liveSegments: TranscriptSegment[]
  report: CritiqueReport | null
  start(): void
  stop(): CritiqueReport | null
  setComments(comments: Comment[]): void
  reset(): void
  exportAgent(): string
  exportPrompt(): string
  exportMarkdown(): string
  exportJson(opts?: { includeScreenshots?: boolean }): string
  download(filename?: string): void
  verify(): VerifyReport | null
}
```

## Vanilla JS

```html
<script type="module">
  import { Tape } from 'https://unpkg.com/usetapeui/dist/vanilla.mjs'
  Tape.init({ vision: true, position: 'bottom-right' })
</script>
```

Or via the bundled global:

```html
<script src="https://unpkg.com/usetapeui/dist/vanilla.js"></script>
<script>UseTape.Tape.init()</script>
```

## Vue 3

```vue
<script setup>
import { Tape } from 'usetapeui/vue'
</script>

<template>
  <Tape :vision="true" @report="onReport" />
</template>
```

## Svelte

```svelte
<script>
  import { onMount, onDestroy } from 'svelte'
  import { mountTape } from 'usetapeui/svelte'

  let tape
  onMount(() => { tape = mountTape({ vision: true }) })
  onDestroy(() => tape?.destroy())
</script>
```

Or as an action:

```svelte
<script>
  import tape from 'usetapeui/svelte'
</script>

<div use:tape={{ vision: true }} />
```

## The agent export format

```
<design_critique>
<!-- URL: https://app.example.com | 6 comments | 0m 34s -->
<!-- Design system: Tailwind + 12 CSS variables -->

## Issues to fix (3)

1. **button.cta-primary** ← CTAButton (src/components/CTAButton.tsx:42): padding too aggressive
   intent: CHANGE padding (decrease, large)
   current: padding: 7px 18px (≈ 1.75 / 4.5 on the spacing scale), border-radius: 3px

2. **h3.hero-title** ← HeroSection (src/components/Hero.tsx:88): font weight is way too heavy
   intent: CHANGE font-weight (decrease, large)
   current: font-weight: 800, line-height: 1.35

3. **p.footer-text** ← Footer (src/components/Footer.tsx:14): barely readable, too small and faded
   intent: CHANGE font-size (increase)
   current: font-size: 10px (≈ text-xs), color: rgb(187, 187, 187)

## Keep as-is (2)

1. **div.card-grid** ← CardGrid (src/components/CardGrid.tsx:20): card layout spacing feels right
2. **div.mini-card**: shadow is perfect

## Questions (1)

1. **div.hero-section** ← HeroSection: should this be left-aligned?

</design_critique>
```

Paste it into Cursor rules, `CLAUDE.md`, Copilot instructions, or any system prompt. The agent reads it and edits the right files.

## .tape file format

A `.tape.json` is a stable JSON envelope:

```json
{
  "format": "tape",
  "version": "1",
  "report": { "version": "1", "url": "...", "comments": [...], "markers": [...], ... },
  "meta": { "generator": "usetapeui", "generatorVersion": "1.0.0", "createdAt": 1714123200000 }
}
```

Save one from the Export tab in the panel, or programmatically:

```ts
import { downloadTape, parseTape, serializeTape } from 'usetapeui'

downloadTape(report)             // browser download
const json = serializeTape(report)
const back = parseTape(json)
```

## Replay

```ts
import { createReplay, parseTape } from 'usetapeui'

const report = parseTape(savedJson)
const replay = createReplay(report)

replay.play(1500, (step) => console.log(step?.text))
// or step manually:
replay.next(); replay.prev(); replay.goto(3); replay.stop(); replay.destroy()
```

Each step highlights the corresponding element on the live page and surfaces the matched transcript text.

## Verify

After your agent applies fixes, run a verify pass to see what changed:

```ts
import { verifyReport, parseTape } from 'usetapeui'

const result = verifyReport(parseTape(savedJson))
// { total, found, changed, unchanged, missing, results: [...] }
```

Each `result` includes a property-level diff: `{ before, after }`.

## MCP server (Claude Code, Cursor, any MCP-capable agent)

usetapeui ships with an MCP server you start from the CLI. It watches a directory of `.tape.json` files and exposes them as MCP tools.

```bash
npx usetapeui mcp --dir ./tapes
```

Or list sessions without starting the server:

```bash
npx usetapeui list --dir ./tapes
```

Tools the server exposes:

| Tool                          | Purpose                                                       |
| ----------------------------- | ------------------------------------------------------------- |
| `tape_list_sessions`          | List all sessions in the directory, newest first              |
| `tape_get_latest_critique`    | Pull the latest session in agent / prompt / markdown / json   |
| `tape_get_critique`           | Pull a specific session by file name                          |
| `tape_get_session`            | Return the full raw `CritiqueReport` JSON                     |
| `tape_summary`                | Stats: counts by sentiment, files involved, top 5 issues      |

To wire it into Claude Code, add to your MCP config:

```json
{
  "mcpServers": {
    "usetapeui": {
      "command": "npx",
      "args": ["usetapeui", "mcp", "--dir", "./tapes"]
    }
  }
}
```

The MCP SDK is an optional peer (`@modelcontextprotocol/sdk`). It's only needed when you actually run `usetapeui mcp`. Install it once with `npm install @modelcontextprotocol/sdk`.

## Browser extension

The `extension/` folder contains a Manifest v3 Chrome extension that injects the vanilla bundle into any page you visit. Load it as an unpacked extension from `chrome://extensions` to TAPE sites that don't ship the SDK themselves.

## Configuration

| Prop                  | Default              | Description                                                              |
| --------------------- | -------------------- | ------------------------------------------------------------------------ |
| `shortcut`            | `'Alt+T'`            | Keyboard toggle for the panel                                            |
| `language`            | `'en-US'`            | Speech recognition language                                              |
| `ignoreSelectors`     | `['[data-tape-ui]']` | Selectors to skip when capturing clicks                                  |
| `zIndex`              | `99999`              | z-index for the floating panel                                           |
| `vision`              | `true`               | Capture a screenshot per click                                           |
| `sourceLink`          | `true`               | Walk React/Vue/Svelte fibers to extract component + source file          |
| `tokens`              | `true`               | Detect Tailwind / CSS variables at session start                         |
| `intent`              | `true`               | Run intent extraction during merge                                       |
| `mergeWindow`         | `3000`               | Max ms between a transcript segment and a click for them to pair         |
| `openEditorOnStop`    | `false`              | Auto-switch to the editor tab when recording stops                       |
| `theme`               | `'dark'`             | Panel theme                                                              |
| `position`            | `'bottom-right'`     | Panel corner                                                             |
| `onReport(report)`    | —                    | Callback fired with the final `CritiqueReport`                           |
| `onClick(marker)`     | —                    | Callback fired with each captured `ClickMarker`                          |
| `onSegment(segment)`  | —                    | Callback fired with each finalized speech segment                        |

## Browser support

Voice transcription uses the Web Speech API. Chrome, Edge, and Safari support it; Firefox is partial. If speech is unavailable, click capture still works and you can edit comment text in the editor afterwards.

Vision uses `html-to-image`, which works in all evergreen browsers.

## Stability

This is `1.0.0`. The schema version on `CritiqueReport` and `TapeFile` is `'1'`; future breaking changes will bump it and ship a migrator. Public API: `Tape`, `useTape`, the vanilla `Tape` class, `mountTape` for Vue/Svelte, and the named exports listed above.

## License

MIT. Built by [Dragoon0x](https://github.com/Dragoon0x).

## Disclaimer

Software is provided as-is. No warranties. Use at your own risk.
