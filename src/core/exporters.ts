/**
 * Exporters: render a CritiqueReport into formats agents and humans consume.
 *
 *   exportAgent()    → primary format wrapped in <design_critique>; what
 *                      Cursor / Claude Code / Copilot actually read.
 *   exportMarkdown() → human-readable review document.
 *   exportJson()     → raw structured data, every field included.
 *   exportPrompt()   → ready-to-paste prompt addressed to the AI agent.
 */

import type { Comment, CritiqueReport, Sentiment } from '../types';
import { describeIntent } from './intent';
import { formatSource } from './source';
import { translateValue } from './tokens';

const SENTIMENT_LABELS: Record<Sentiment, string> = {
  issue: 'Issues to fix',
  positive: 'Keep as-is',
  question: 'Questions',
  note: 'Notes',
};

function renderStylesLine(c: Comment, tokens: CritiqueReport['tokens']): string {
  if (!c.marker) return '';
  // Pick at most 4 most-relevant style props based on intent attribute.
  const styles = c.marker.styles;
  const keys = Object.keys(styles);
  let picked: string[] = [];
  if (c.intent.attribute) {
    picked = keys.filter((k) => k === c.intent.attribute || k.startsWith(c.intent.attribute! + '-'));
  }
  // fallback: spacing/typography defaults if nothing matched
  if (picked.length === 0) {
    const fallback = ['padding', 'margin', 'font-size', 'font-weight', 'color', 'background-color', 'border-radius'];
    picked = keys.filter((k) => fallback.includes(k)).slice(0, 3);
  }
  if (picked.length === 0) picked = keys.slice(0, 3);

  const parts = picked.map((k) => `${k}: ${translateValue(k, styles[k], tokens)}`);
  return parts.join(', ');
}

function renderTarget(c: Comment): string {
  if (!c.marker) return '(general note)';
  const sel = c.marker.selector || c.marker.tag;
  const src = c.marker.source ? ` ← ${formatSource(c.marker.source)}` : '';
  return `**${sel}**${src}`;
}

function groupBySentiment(comments: Comment[]): Record<Sentiment, Comment[]> {
  const out: Record<Sentiment, Comment[]> = { issue: [], positive: [], question: [], note: [] };
  for (const c of comments) out[c.sentiment].push(c);
  return out;
}

/** The primary export: structured block agents can paste into their context. */
export function exportAgent(report: CritiqueReport): string {
  const grouped = groupBySentiment(report.comments);
  const order: Sentiment[] = ['issue', 'positive', 'question', 'note'];
  const lines: string[] = [];

  lines.push('<design_critique>');
  lines.push(`<!-- URL: ${report.url} | ${report.comments.length} comments | ${formatDuration(report.duration)} -->`);
  if (report.tokens && report.tokens.type !== 'none') {
    const detected: string[] = [];
    if (report.tokens.tailwindDetected) detected.push('Tailwind');
    if (report.tokens.cssVarsDetected) detected.push(`${Object.keys(report.tokens.cssVars).length} CSS variables`);
    lines.push(`<!-- Design system: ${detected.join(' + ')} -->`);
  }
  lines.push('');

  for (const sentiment of order) {
    const items = grouped[sentiment];
    if (items.length === 0) continue;
    lines.push(`## ${SENTIMENT_LABELS[sentiment]} (${items.length})`);
    lines.push('');
    items.forEach((c, i) => {
      const text = c.text || '(silent click)';
      const intent = describeIntent(c.intent);
      const styles = renderStylesLine(c, report.tokens);
      lines.push(`${i + 1}. ${renderTarget(c)}: ${text}`);
      if (intent && intent !== c.text) lines.push(`   intent: ${intent}`);
      if (styles) lines.push(`   current: ${styles}`);
      if (c.marker?.screenshot) lines.push(`   screenshot: [attached, ${Math.round(c.marker.screenshot.length / 1024)}KB]`);
      lines.push('');
    });
  }

  lines.push('</design_critique>');
  return lines.join('\n');
}

/** Ready-to-send prompt addressed to a code agent. */
export function exportPrompt(report: CritiqueReport): string {
  const body = exportAgent(report);
  return [
    'You are working on the page below. Apply the design critique by editing the relevant component files.',
    'For each item under "Issues to fix", make the smallest code change that resolves it. Preserve everything under "Keep as-is".',
    'For each item under "Questions", reply with your recommendation; do not change code unless explicitly asked.',
    'Cite the file paths in your response.',
    '',
    body,
  ].join('\n');
}

/** Human-readable markdown report. */
export function exportMarkdown(report: CritiqueReport): string {
  const lines: string[] = [];
  lines.push(`# Design critique`);
  lines.push('');
  lines.push(`- URL: ${report.url}`);
  lines.push(`- Recorded: ${new Date(report.recordedAt).toISOString()}`);
  lines.push(`- Duration: ${formatDuration(report.duration)}`);
  lines.push(`- Comments: ${report.comments.length}`);
  if (report.tokens && report.tokens.type !== 'none') {
    lines.push(`- Design system: ${report.tokens.type}`);
  }
  lines.push('');

  const grouped = groupBySentiment(report.comments);
  const order: Sentiment[] = ['issue', 'positive', 'question', 'note'];
  for (const sentiment of order) {
    const items = grouped[sentiment];
    if (items.length === 0) continue;
    lines.push(`## ${SENTIMENT_LABELS[sentiment]}`);
    lines.push('');
    items.forEach((c) => {
      const target = c.marker ? `\`${c.marker.selector}\`` : '_(general)_';
      const src = c.marker?.source ? ` — _${formatSource(c.marker.source)}_` : '';
      lines.push(`- ${target}${src}: ${c.text || '(silent click)'}`);
      const styles = renderStylesLine(c, report.tokens);
      if (styles) lines.push(`  - current: ${styles}`);
    });
    lines.push('');
  }
  return lines.join('\n');
}

/** Raw JSON of the full report. Strips screenshot data URLs for compactness; pass includeScreenshots: true to keep them. */
export function exportJson(report: CritiqueReport, options: { includeScreenshots?: boolean } = {}): string {
  if (options.includeScreenshots) {
    return JSON.stringify(report, null, 2);
  }
  const stripped: CritiqueReport = {
    ...report,
    markers: report.markers.map((m) => ({ ...m, screenshot: m.screenshot ? '[stripped]' : null })),
    comments: report.comments.map((c) => ({
      ...c,
      marker: c.marker ? { ...c.marker, screenshot: c.marker.screenshot ? '[stripped]' : null } : null,
    })),
  };
  return JSON.stringify(stripped, null, 2);
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}
