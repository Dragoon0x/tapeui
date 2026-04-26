/**
 * Shared utilities used across the recorder, reporter, and adapters.
 * Pure functions, no side effects, no DOM mutation.
 */

/**
 * Build a stable, unique-as-possible CSS selector for an element.
 * Strategy: id → data-testid → tag.classes → nth-of-type chain capped at depth 6.
 */
export function buildSelector(el: Element): string {
  if (!el || el.nodeType !== 1) return '';

  // Try id (must be unique in the document).
  if (el.id && /^[A-Za-z][\w-]*$/.test(el.id)) {
    return `#${cssEscape(el.id)}`;
  }

  // Try data-testid.
  const testid = el.getAttribute('data-testid');
  if (testid) {
    return `[data-testid="${cssEscapeAttr(testid)}"]`;
  }

  // Build a chain: tag.class.class > tag.class.class ...
  const parts: string[] = [];
  let cur: Element | null = el;
  let depth = 0;
  while (cur && cur.nodeType === 1 && depth < 6) {
    const tag = cur.tagName.toLowerCase();
    let part = tag;
    if (cur.id && /^[A-Za-z][\w-]*$/.test(cur.id)) {
      part = `${tag}#${cssEscape(cur.id)}`;
      parts.unshift(part);
      break;
    }
    const cls = (cur.getAttribute('class') || '')
      .split(/\s+/)
      .filter((c) => c && !c.startsWith('tape-') && /^[A-Za-z_][\w-]*$/.test(c))
      .slice(0, 3);
    if (cls.length) part += '.' + cls.map(cssEscape).join('.');
    // nth-of-type for disambiguation if no classes/id
    if (!cls.length && cur.parentElement) {
      const sibs = Array.from(cur.parentElement.children).filter(
        (s) => s.tagName === cur!.tagName,
      );
      if (sibs.length > 1) {
        const idx = sibs.indexOf(cur) + 1;
        part += `:nth-of-type(${idx})`;
      }
    }
    parts.unshift(part);
    cur = cur.parentElement;
    depth++;
  }
  return parts.join(' > ');
}

/** Conservative CSS identifier escape. */
function cssEscape(s: string): string {
  if (typeof (window as any).CSS !== 'undefined' && typeof (window as any).CSS.escape === 'function') {
    return (window as any).CSS.escape(s);
  }
  return s.replace(/[^\w-]/g, '\\$&');
}

function cssEscapeAttr(s: string): string {
  return s.replace(/["\\]/g, '\\$&');
}

/** Pick a focused subset of computed styles relevant to design feedback. */
export const PICKED_STYLE_PROPS: readonly string[] = [
  // spacing
  'padding',
  'margin',
  'gap',
  'row-gap',
  'column-gap',
  // box
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'box-sizing',
  // type
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-transform',
  'text-decoration',
  // color
  'color',
  'background-color',
  'opacity',
  // borders
  'border',
  'border-radius',
  'box-shadow',
  // layout
  'display',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'z-index',
  'flex',
  'flex-direction',
  'justify-content',
  'align-items',
  'grid-template-columns',
  'grid-template-rows',
  // transforms
  'transform',
  'transition',
] as const;

export function pickStyles(el: Element): Record<string, string> {
  const cs = window.getComputedStyle(el);
  const result: Record<string, string> = {};
  for (const prop of PICKED_STYLE_PROPS) {
    const v = cs.getPropertyValue(prop);
    if (v && v !== 'normal' && v !== 'auto' && v !== 'none' && v !== '0px' && v !== 'rgba(0, 0, 0, 0)') {
      result[prop] = v.trim();
    }
  }
  // Always include these even when default-ish, because they're core to the box.
  if (cs.padding && cs.padding !== '0px') result.padding = cs.padding;
  if (cs.margin && cs.margin !== '0px') result.margin = cs.margin;
  return result;
}

/** Direct text content of an element, excluding nested elements' text. */
export function directText(el: Element): string {
  let out = '';
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 3) out += node.textContent || '';
  }
  out = out.trim().replace(/\s+/g, ' ');
  return out.length > 100 ? out.slice(0, 100) : out;
}

/** Generate a stable id (timestamp + counter), no deps. */
let idCounter = 0;
export function makeId(): string {
  idCounter = (idCounter + 1) % 1_000_000;
  return `c_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

/** True when running in a real browser. */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/** Safe console warn. */
export function warn(...args: unknown[]): void {
  if (typeof console !== 'undefined' && console.warn) {
    console.warn('[tape]', ...args);
  }
}

/** Deep equal for plain string-keyed objects of strings. */
export function shallowEqualStringMap(a: Record<string, string>, b: Record<string, string>): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

/** Diff two style maps; returns properties that differ. */
export function diffStyles(
  before: Record<string, string>,
  after: Record<string, string>,
): Record<string, { before: string; after: string }> {
  const out: Record<string, { before: string; after: string }> = {};
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of allKeys) {
    const a = before[k] ?? '';
    const b = after[k] ?? '';
    if (a !== b) out[k] = { before: a, after: b };
  }
  return out;
}

/**
 * Find the closest matching element for a saved selector.
 * Returns null if not found. Falls back to first match if selector returns multiple.
 */
export function findBySelector(selector: string): Element | null {
  if (!selector) return null;
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}

/** Test if an element should be ignored based on a list of selectors. */
export function isIgnored(el: Element, ignoreSelectors: string[]): boolean {
  for (const sel of ignoreSelectors) {
    try {
      if (el.matches(sel) || el.closest(sel)) return true;
    } catch {
      // invalid selector, skip
    }
  }
  return false;
}
