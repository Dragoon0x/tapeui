/**
 * Svelte adapter.
 *
 * Two ways to use:
 *
 * 1) Imperative (recommended, works in any Svelte version):
 *
 *      <script>
 *      import { onMount, onDestroy } from 'svelte';
 *      import { mountTape } from 'usetapeui/svelte';
 *      let tape;
 *      onMount(() => { tape = mountTape({ vision: true }); });
 *      onDestroy(() => tape?.destroy());
 *      </script>
 *
 * 2) Action:
 *
 *      <div use:tape={{ vision: true }} />
 */

import type { TapeConfig } from '../types';
import { TapeVanilla } from '../vanilla';

export interface SvelteTapeInstance {
  destroy: () => void;
  start: () => void;
  stop: () => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export function mountTape(opts: Partial<TapeConfig> = {}): SvelteTapeInstance {
  const inst = TapeVanilla.init(opts);
  return {
    destroy: () => inst.unmount(),
    start: () => inst.start(),
    stop: () => { inst.stop(); },
    open: () => inst.open(),
    close: () => inst.close(),
    toggle: () => inst.toggle(),
  };
}

/**
 * Svelte action: <div use:tape={config}>
 * The host element is ignored; TAPE renders its own floating panel.
 */
export function tape(_node: HTMLElement, opts: Partial<TapeConfig> = {}) {
  let inst: TapeVanilla = TapeVanilla.init(opts);
  return {
    update(newOpts: Partial<TapeConfig>) {
      inst.unmount();
      inst = TapeVanilla.init(newOpts);
    },
    destroy() {
      inst.unmount();
    },
  };
}

// Default export is the action so users can `import tape from 'usetapeui/svelte'`.
export default tape;
