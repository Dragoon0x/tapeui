/**
 * Design token detection: figure out the project's design vocabulary so the
 * critique export can speak it.
 *
 * Detection strategy:
 *  - Tailwind: scan a sample of elements for utility class patterns (text-xs,
 *    px-4, bg-slate-100, etc.). Threshold: ≥ 6 distinct tailwind-style classes
 *    across a 200-element sample.
 *  - CSS variables: enumerate custom properties on :root and build a reverse
 *    map from value → variable name.
 */

import type { TokenSystem } from '../types';

const TAILWIND_SPACING_PX_TO_SCALE: ReadonlyArray<[string, string]> = [
  ['0px', '0'],
  ['1px', 'px'],
  ['2px', '0.5'],
  ['4px', '1'],
  ['6px', '1.5'],
  ['8px', '2'],
  ['10px', '2.5'],
  ['12px', '3'],
  ['14px', '3.5'],
  ['16px', '4'],
  ['20px', '5'],
  ['24px', '6'],
  ['28px', '7'],
  ['32px', '8'],
  ['36px', '9'],
  ['40px', '10'],
  ['44px', '11'],
  ['48px', '12'],
  ['56px', '14'],
  ['64px', '16'],
  ['80px', '20'],
  ['96px', '24'],
  ['112px', '28'],
  ['128px', '32'],
  ['144px', '36'],
  ['160px', '40'],
  ['176px', '44'],
  ['192px', '48'],
  ['208px', '52'],
  ['224px', '56'],
  ['240px', '60'],
  ['256px', '64'],
  ['288px', '72'],
  ['320px', '80'],
  ['384px', '96'],
];

const TAILWIND_TYPE_PX_TO_CLASS: ReadonlyArray<[string, string]> = [
  ['12px', 'text-xs'],
  ['14px', 'text-sm'],
  ['16px', 'text-base'],
  ['18px', 'text-lg'],
  ['20px', 'text-xl'],
  ['24px', 'text-2xl'],
  ['30px', 'text-3xl'],
  ['36px', 'text-4xl'],
  ['48px', 'text-5xl'],
  ['60px', 'text-6xl'],
  ['72px', 'text-7xl'],
  ['96px', 'text-8xl'],
  ['128px', 'text-9xl'],
];

// A tiny but useful subset of Tailwind named colors (rgb form).
const TAILWIND_COLORS: ReadonlyArray<[string, string]> = [
  ['rgb(255, 255, 255)', 'white'],
  ['rgb(0, 0, 0)', 'black'],
  ['rgb(248, 250, 252)', 'slate-50'],
  ['rgb(241, 245, 249)', 'slate-100'],
  ['rgb(226, 232, 240)', 'slate-200'],
  ['rgb(203, 213, 225)', 'slate-300'],
  ['rgb(148, 163, 184)', 'slate-400'],
  ['rgb(100, 116, 139)', 'slate-500'],
  ['rgb(71, 85, 105)', 'slate-600'],
  ['rgb(51, 65, 85)', 'slate-700'],
  ['rgb(30, 41, 59)', 'slate-800'],
  ['rgb(15, 23, 42)', 'slate-900'],
  ['rgb(2, 6, 23)', 'slate-950'],
  ['rgb(239, 68, 68)', 'red-500'],
  ['rgb(34, 197, 94)', 'green-500'],
  ['rgb(59, 130, 246)', 'blue-500'],
  ['rgb(168, 85, 247)', 'purple-500'],
  ['rgb(245, 158, 11)', 'amber-500'],
];

const TAILWIND_CLASS_RX =
  /\b(text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl)|p[xytrbl]?-\d+(\.\d+)?|m[xytrbl]?-\d+(\.\d+)?|gap(-x|-y)?-\d+(\.\d+)?|bg-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+|text-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+|rounded(-(none|sm|md|lg|xl|2xl|3xl|full))?|font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)|flex|grid|inline-flex|items-(start|center|end|stretch|baseline)|justify-(start|center|end|between|around|evenly))\b/;

function detectTailwind(): boolean {
  const sample = Array.from(document.querySelectorAll('*'))
    .slice(0, 200)
    .map((el) => el.getAttribute('class') || '')
    .filter(Boolean)
    .join(' ');
  if (!sample) return false;
  const matches = sample.match(new RegExp(TAILWIND_CLASS_RX.source, 'g'));
  const distinct = new Set(matches || []);
  return distinct.size >= 6;
}

function detectCssVars(): Record<string, string> {
  const vars: Record<string, string> = {};
  if (typeof document === 'undefined') return vars;
  const root = document.documentElement;
  const cs = window.getComputedStyle(root);
  for (let i = 0; i < cs.length; i++) {
    const prop = cs.item(i);
    if (prop && prop.startsWith('--')) {
      const value = cs.getPropertyValue(prop).trim();
      if (value) vars[value] = prop;
    }
  }
  return vars;
}

export function detectTokenSystem(): TokenSystem {
  if (typeof document === 'undefined') {
    return {
      type: 'none',
      spacing: {},
      colors: {},
      typography: {},
      cssVars: {},
      tailwindDetected: false,
      cssVarsDetected: false,
    };
  }

  const tailwindDetected = detectTailwind();
  const cssVars = detectCssVars();
  const cssVarsDetected = Object.keys(cssVars).length > 0;

  const spacing = tailwindDetected ? Object.fromEntries(TAILWIND_SPACING_PX_TO_SCALE) : {};
  const typography = tailwindDetected ? Object.fromEntries(TAILWIND_TYPE_PX_TO_CLASS) : {};
  const colors = tailwindDetected ? Object.fromEntries(TAILWIND_COLORS) : {};

  let type: TokenSystem['type'] = 'none';
  if (tailwindDetected && cssVarsDetected) type = 'mixed';
  else if (tailwindDetected) type = 'tailwind';
  else if (cssVarsDetected) type = 'css-vars';

  return {
    type,
    spacing,
    colors,
    typography,
    cssVars,
    tailwindDetected,
    cssVarsDetected,
  };
}

/** Translate a single value to its token equivalent if known. Returns the original string if no token matches. */
export function translateValue(
  property: string,
  value: string,
  tokens: TokenSystem | null,
): string {
  if (!tokens || tokens.type === 'none') return value;

  // CSS variable matches take priority — they're the project's own naming.
  if (tokens.cssVars[value]) {
    return `var(${tokens.cssVars[value]}) /* ${value} */`;
  }

  // Tailwind translations.
  if (tokens.tailwindDetected) {
    if (
      (property.startsWith('padding') ||
        property.startsWith('margin') ||
        property === 'gap' ||
        property === 'row-gap' ||
        property === 'column-gap') &&
      tokens.spacing[value]
    ) {
      return `${value} (≈ ${tokens.spacing[value]} on the spacing scale)`;
    }
    if (property === 'font-size' && tokens.typography[value]) {
      return `${value} (≈ ${tokens.typography[value]})`;
    }
    if ((property === 'color' || property === 'background-color') && tokens.colors[value]) {
      return `${value} (≈ ${tokens.colors[value]})`;
    }
  }
  return value;
}

/** Translate every value in a style map; returns a new map. */
export function translateStyles(
  styles: Record<string, string>,
  tokens: TokenSystem | null,
): Record<string, string> {
  if (!tokens || tokens.type === 'none') return { ...styles };
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(styles)) {
    out[k] = translateValue(k, v, tokens);
  }
  return out;
}
