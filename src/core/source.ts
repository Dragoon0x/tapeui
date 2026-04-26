/**
 * Source linking: walk framework internals on a DOM element to find the
 * owning component and (in dev) its source file location.
 *
 * Supports React 16/17/18, Vue 3, and best-effort Svelte 5.
 * Production builds strip _debugSource so fileName/lineNumber will be null.
 * That's expected; the componentName alone is still very useful.
 */

import type { SourceInfo } from '../types';

/* ------------------------- React ------------------------- */

interface ReactFiberLike {
  type?: any;
  return?: ReactFiberLike | null;
  _debugSource?: { fileName?: string; lineNumber?: number; columnNumber?: number };
  _debugOwner?: ReactFiberLike;
  stateNode?: any;
  memoizedProps?: any;
}

function getReactFiberKey(el: Element): string | null {
  for (const key in el) {
    if (key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')) {
      return key;
    }
  }
  return null;
}

function getComponentName(type: any): string | null {
  if (!type) return null;
  if (typeof type === 'string') return null; // host (div, span, etc.)
  if (typeof type === 'function') {
    return type.displayName || type.name || null;
  }
  // forwardRef / memo / lazy
  if (type.displayName) return type.displayName;
  if (type.render && (type.render.displayName || type.render.name)) {
    return type.render.displayName || type.render.name;
  }
  if (type.type) {
    return getComponentName(type.type); // memo unwrap
  }
  return null;
}

export function findReactSource(el: Element): SourceInfo | null {
  const key = getReactFiberKey(el);
  if (!key) return null;
  let fiber: ReactFiberLike | null | undefined = (el as any)[key];
  if (!fiber) return null;

  // Walk up until we find a non-host (non-string-type) component.
  while (fiber) {
    const name = getComponentName(fiber.type);
    if (name) {
      const ds = fiber._debugSource;
      return {
        framework: 'react',
        componentName: name,
        fileName: ds?.fileName ?? null,
        lineNumber: ds?.lineNumber ?? null,
        columnNumber: ds?.columnNumber ?? null,
      };
    }
    fiber = fiber.return;
  }
  return null;
}

/* ------------------------- Vue 3 ------------------------- */

interface VueComponentLike {
  type?: { __name?: string; name?: string; __file?: string };
  parent?: VueComponentLike | null;
}

export function findVueSource(el: Element): SourceInfo | null {
  const inst = (el as any).__vueParentComponent || (el as any).__vue_app__ || (el as any).__vue__;
  if (!inst) return null;
  let cur: VueComponentLike | null = inst as VueComponentLike;
  while (cur) {
    const t = cur.type;
    if (t && (t.__name || t.name)) {
      return {
        framework: 'vue',
        componentName: t.__name || t.name || null,
        fileName: t.__file || null,
        lineNumber: null,
        columnNumber: null,
      };
    }
    cur = cur.parent ?? null;
  }
  return null;
}

/* ------------------------- Svelte ------------------------- */

export function findSvelteSource(el: Element): SourceInfo | null {
  // Svelte 5 attaches debug info on host elements via __svelte_meta in dev.
  const meta = (el as any).__svelte_meta;
  if (meta && meta.loc) {
    return {
      framework: 'svelte',
      componentName: meta.loc.fileName ? basename(meta.loc.fileName) : null,
      fileName: meta.loc.fileName || null,
      lineNumber: meta.loc.lineNumber || null,
      columnNumber: meta.loc.columnNumber || null,
    };
  }
  return null;
}

function basename(p: string): string {
  const slash = p.lastIndexOf('/');
  const name = slash >= 0 ? p.slice(slash + 1) : p;
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

/* ------------------------- Public API ------------------------- */

/** Try every supported framework and return the first hit. */
export function findSource(el: Element): SourceInfo | null {
  return findReactSource(el) || findVueSource(el) || findSvelteSource(el) || null;
}

/** Format a source as a human-readable reference. */
export function formatSource(s: SourceInfo): string {
  if (!s.componentName && !s.fileName) return '';
  const file = s.fileName ? ` (${shortenPath(s.fileName)}${s.lineNumber ? `:${s.lineNumber}` : ''})` : '';
  return `${s.componentName ?? '?'}${file}`;
}

function shortenPath(p: string): string {
  // Trim long absolute paths down to the last 3 segments.
  const parts = p.split('/').filter(Boolean);
  if (parts.length <= 3) return p;
  return '…/' + parts.slice(-3).join('/');
}
