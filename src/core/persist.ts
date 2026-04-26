/**
 * Persistence: serialize a CritiqueReport to/from a .tape.json file.
 *
 * The format is a stable JSON envelope with a version field so future
 * versions can migrate old recordings.
 */

import type { CritiqueReport, TapeFile } from '../types';

const GENERATOR = 'usetapeui';
const GENERATOR_VERSION = '1.0.0';

export function serializeTape(report: CritiqueReport): string {
  const file: TapeFile = {
    format: 'tape',
    version: '1',
    report,
    meta: {
      generator: GENERATOR,
      generatorVersion: GENERATOR_VERSION,
      createdAt: Date.now(),
    },
  };
  return JSON.stringify(file, null, 2);
}

export function parseTape(text: string): CritiqueReport | null {
  try {
    const parsed = JSON.parse(text) as Partial<TapeFile>;
    if (!parsed || parsed.format !== 'tape' || parsed.version !== '1' || !parsed.report) {
      return null;
    }
    return parsed.report as CritiqueReport;
  } catch {
    return null;
  }
}

/** Trigger a browser download of the report as a .tape.json file. */
export function downloadTape(report: CritiqueReport, filename?: string): void {
  if (typeof document === 'undefined') return;
  const json = serializeTape(report);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `tape-${new Date(report.recordedAt).toISOString().replace(/[:.]/g, '-')}.tape.json`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/** Open a file picker, return the parsed report or null. */
export function uploadTape(): Promise<CritiqueReport | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.tape,.tape.json,application/json';
    input.style.display = 'none';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || '');
        resolve(parseTape(text));
      };
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    };
    document.body.appendChild(input);
    input.click();
    setTimeout(() => {
      try {
        document.body.removeChild(input);
      } catch {
        // ignore
      }
    }, 1000);
  });
}
