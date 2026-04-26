/**
 * Vue 3 adapter.
 *
 * Provides a defineComponent that mounts the vanilla TAPE SDK on mount
 * and tears it down on unmount. Props mirror TapeConfig.
 *
 *   <script setup>
 *   import { Tape } from 'usetapeui/vue';
 *   </script>
 *   <template><Tape :vision="true" /></template>
 *
 * Vue is a peer dep; this file does not import vue at runtime, only at type-time.
 */

import type { TapeConfig } from '../types';
import { TapeVanilla } from '../vanilla';

// We intentionally don't import vue. We define the component shape via a factory
// that the consumer calls with their own `defineComponent` if they need the full
// Vue type. The default export is a plain factory that mounts/unmounts.

export interface VueTapeInstance {
  destroy: () => void;
  start: () => void;
  stop: () => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

/** Imperative mount used by the Vue component below or directly in setup blocks. */
export function mountTape(opts: Partial<TapeConfig> = {}): VueTapeInstance {
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
 * Vue component definition (plain object). Vue will accept this as a component
 * thanks to the standard options API. We avoid importing vue to keep this
 * adapter zero-dep at runtime.
 */
export const Tape = {
  name: 'Tape',
  props: {
    shortcut: { type: String, default: 'Alt+T' },
    language: { type: String, default: 'en-US' },
    vision: { type: Boolean, default: true },
    sourceLink: { type: Boolean, default: true },
    tokens: { type: Boolean, default: true },
    intent: { type: Boolean, default: true },
    mergeWindow: { type: Number, default: 3000 },
    position: { type: String, default: 'bottom-right' },
    zIndex: { type: Number, default: 99999 },
  },
  data() {
    return { _instance: null as TapeVanilla | null };
  },
  mounted(this: any) {
    this._instance = TapeVanilla.init({
      shortcut: this.shortcut,
      language: this.language,
      vision: this.vision,
      sourceLink: this.sourceLink,
      tokens: this.tokens,
      intent: this.intent,
      mergeWindow: this.mergeWindow,
      position: this.position,
      zIndex: this.zIndex,
      onReport: (r) => this.$emit('report', r),
      onClick: (m) => this.$emit('click', m),
      onSegment: (s) => this.$emit('segment', s),
    });
  },
  beforeUnmount(this: any) {
    if (this._instance) {
      this._instance.unmount();
      this._instance = null;
    }
  },
  // Vue requires a render function; we return null because the SDK manages its own DOM.
  render() {
    return null;
  },
} as const;

export default Tape;
