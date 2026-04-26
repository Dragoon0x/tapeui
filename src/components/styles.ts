/**
 * Inline style tokens for the floating panel.
 *
 * We use inline styles intentionally to dodge style collisions with the host
 * page. No global CSS, no class names that could clash, no dependencies.
 */

import type { CSSProperties } from 'react';

export const palette = {
  bg: '#0b0d10',
  bgPanel: '#0f1216',
  bgRow: '#13171c',
  bgRowHover: '#181d23',
  border: '#22272e',
  borderStrong: '#2d343c',
  text: '#e6e8eb',
  textDim: '#9aa3ad',
  textFaint: '#5b6370',
  accent: '#f59e0b',
  accentDim: '#f59e0b22',
  red: '#ef4444',
  green: '#10b981',
  blue: '#3b82f6',
  purple: '#a855f7',
};

export const positions = {
  'bottom-right': { right: 20, bottom: 20 },
  'bottom-left': { left: 20, bottom: 20 },
  'top-right': { right: 20, top: 20 },
  'top-left': { left: 20, top: 20 },
} as const;

const baseFont =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif';
const monoFont = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

export const styles = {
  panel: {
    position: 'fixed',
    width: 380,
    maxHeight: 'min(640px, 80vh)',
    background: palette.bgPanel,
    color: palette.text,
    border: `1px solid ${palette.border}`,
    borderRadius: 12,
    boxShadow: '0 20px 60px rgba(0,0,0,0.45), 0 4px 12px rgba(0,0,0,0.25)',
    fontFamily: baseFont,
    fontSize: 13,
    lineHeight: 1.5,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxSizing: 'border-box',
  } satisfies CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 14px',
    borderBottom: `1px solid ${palette.border}`,
    background: palette.bg,
  } satisfies CSSProperties,

  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontWeight: 600,
    letterSpacing: '0.04em',
    fontSize: 12,
    textTransform: 'uppercase',
    color: palette.text,
  } satisfies CSSProperties,

  led: (active: boolean): CSSProperties => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: active ? palette.red : palette.accent,
    boxShadow: active ? '0 0 8px ' + palette.red : 'none',
    animation: active ? 'tape-pulse 1.4s ease-in-out infinite' : 'none',
  }),

  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: palette.textFaint,
    cursor: 'pointer',
    fontSize: 16,
    padding: '4px 6px',
    lineHeight: 1,
    borderRadius: 4,
  } satisfies CSSProperties,

  body: {
    padding: 14,
    overflowY: 'auto',
    flex: 1,
    boxSizing: 'border-box',
  } satisfies CSSProperties,

  recordRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  } satisfies CSSProperties,

  recordBtn: (active: boolean): CSSProperties => ({
    background: active ? palette.red : palette.accent,
    color: active ? '#fff' : '#0b0d10',
    border: 'none',
    borderRadius: 8,
    padding: '10px 16px',
    fontFamily: baseFont,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    transition: 'transform 120ms ease',
  }),

  iconBtn: {
    background: palette.bgRow,
    color: palette.textDim,
    border: `1px solid ${palette.border}`,
    borderRadius: 6,
    padding: '6px 10px',
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: baseFont,
  } satisfies CSSProperties,

  primaryBtn: {
    background: palette.accent,
    color: '#0b0d10',
    border: 'none',
    borderRadius: 6,
    padding: '8px 14px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: baseFont,
  } satisfies CSSProperties,

  ghostBtn: {
    background: 'transparent',
    color: palette.textDim,
    border: `1px solid ${palette.border}`,
    borderRadius: 6,
    padding: '8px 12px',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: baseFont,
  } satisfies CSSProperties,

  dangerBtn: {
    background: 'transparent',
    color: palette.red,
    border: `1px solid ${palette.red}55`,
    borderRadius: 6,
    padding: '6px 10px',
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: baseFont,
  } satisfies CSSProperties,

  status: {
    fontSize: 11,
    color: palette.textFaint,
    marginLeft: 'auto',
    fontFamily: monoFont,
  } satisfies CSSProperties,

  transcript: {
    background: palette.bgRow,
    border: `1px solid ${palette.border}`,
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    color: palette.textDim,
    fontStyle: 'italic',
    minHeight: 48,
    marginBottom: 12,
    fontFamily: baseFont,
  } satisfies CSSProperties,

  commentRow: {
    background: palette.bgRow,
    border: `1px solid ${palette.border}`,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    fontSize: 12,
  } satisfies CSSProperties,

  commentMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    fontFamily: monoFont,
    fontSize: 10,
    color: palette.textFaint,
  } satisfies CSSProperties,

  badge: (sentiment: string): CSSProperties => {
    const map: Record<string, { bg: string; fg: string }> = {
      issue: { bg: '#ef444422', fg: '#ef4444' },
      positive: { bg: '#10b98122', fg: '#10b981' },
      question: { bg: '#3b82f622', fg: '#3b82f6' },
      note: { bg: '#9aa3ad22', fg: '#9aa3ad' },
    };
    const c = map[sentiment] || map.note;
    return {
      background: c.bg,
      color: c.fg,
      padding: '2px 6px',
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    };
  },

  selector: {
    fontFamily: monoFont,
    fontSize: 11,
    color: palette.accent,
    wordBreak: 'break-all',
  } satisfies CSSProperties,

  textarea: {
    width: '100%',
    background: palette.bg,
    color: palette.text,
    border: `1px solid ${palette.border}`,
    borderRadius: 6,
    padding: 8,
    fontSize: 12,
    fontFamily: baseFont,
    resize: 'vertical',
    minHeight: 60,
    boxSizing: 'border-box',
    outline: 'none',
  } satisfies CSSProperties,

  exportBlock: {
    background: '#020409',
    border: `1px solid ${palette.border}`,
    borderRadius: 8,
    padding: 12,
    fontFamily: monoFont,
    fontSize: 11,
    color: '#9be3a4',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: 220,
    overflow: 'auto',
    margin: 0,
  } satisfies CSSProperties,

  tabs: {
    display: 'flex',
    gap: 4,
    marginBottom: 10,
    borderBottom: `1px solid ${palette.border}`,
  } satisfies CSSProperties,

  tab: (active: boolean): CSSProperties => ({
    background: 'transparent',
    color: active ? palette.text : palette.textFaint,
    border: 'none',
    borderBottom: active ? `2px solid ${palette.accent}` : '2px solid transparent',
    padding: '6px 10px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: baseFont,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }),

  empty: {
    textAlign: 'center',
    color: palette.textFaint,
    padding: '24px 12px',
    fontSize: 12,
  } satisfies CSSProperties,

  hint: {
    color: palette.textFaint,
    fontSize: 11,
    fontFamily: monoFont,
    marginTop: 8,
  } satisfies CSSProperties,

  vu: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 2,
    height: 16,
  } satisfies CSSProperties,

  vuBar: (active: boolean, h: number): CSSProperties => ({
    width: 2,
    height: h,
    background: active ? palette.red : palette.borderStrong,
    transition: 'height 80ms linear',
    borderRadius: 1,
  }),
};

export const KEYFRAMES = `
@keyframes tape-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
@keyframes tape-fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

export const FONT_FAMILY = baseFont;
export const MONO_FAMILY = monoFont;
