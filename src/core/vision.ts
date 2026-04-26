/**
 * Vision capture: produce a cropped screenshot of a clicked element.
 *
 * Uses html-to-image (lazy-loaded) to render the element to a PNG data URL.
 * Skips TAPE's own UI via a node filter. Returns null on any failure so the
 * recorder pipeline never breaks because of vision.
 */

import { warn } from './utils';

let cached: typeof import('html-to-image') | null = null;
let loadFailed = false;

async function loadHtmlToImage(): Promise<typeof import('html-to-image') | null> {
  if (cached) return cached;
  if (loadFailed) return null;
  try {
    const mod = await import('html-to-image');
    cached = mod;
    return mod;
  } catch (err) {
    loadFailed = true;
    warn('vision unavailable: html-to-image failed to load', err);
    return null;
  }
}

export interface VisionOptions {
  /** Max width in CSS pixels for the screenshot. Default 800. */
  maxWidth?: number;
  /** Max height in CSS pixels. Default 600. */
  maxHeight?: number;
  /** Pixel ratio. Default 1. */
  pixelRatio?: number;
}

/**
 * Capture a single element as a base64 PNG data URL.
 * Returns null if capture fails or the page is server-rendered.
 */
export async function captureElement(
  el: Element,
  options: VisionOptions = {},
): Promise<string | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  if (!(el instanceof HTMLElement)) return null;

  const lib = await loadHtmlToImage();
  if (!lib) return null;

  const { maxWidth = 800, maxHeight = 600, pixelRatio = 1 } = options;

  try {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const widthScale = Math.min(1, maxWidth / Math.max(1, rect.width));
    const heightScale = Math.min(1, maxHeight / Math.max(1, rect.height));
    const scale = Math.min(widthScale, heightScale, 1);

    const dataUrl = await lib.toPng(el, {
      pixelRatio,
      cacheBust: true,
      skipFonts: true,
      width: Math.ceil(rect.width),
      height: Math.ceil(rect.height),
      style: {
        transform: scale < 1 ? `scale(${scale})` : '',
        transformOrigin: 'top left',
      },
      filter: (node) => {
        if (node instanceof Element) {
          if (node.hasAttribute('data-tape-ui')) return false;
          if (node.closest && node.closest('[data-tape-ui]')) return false;
        }
        return true;
      },
    });

    if (!dataUrl || dataUrl.length < 100) return null;
    return dataUrl;
  } catch (err) {
    warn('captureElement failed', err);
    return null;
  }
}

/** Lightweight viewport screenshot, used at recording start/end. */
export async function captureViewport(options: VisionOptions = {}): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  return captureElement(document.body, {
    maxWidth: options.maxWidth ?? 1280,
    maxHeight: options.maxHeight ?? 800,
    pixelRatio: options.pixelRatio ?? 1,
  });
}
