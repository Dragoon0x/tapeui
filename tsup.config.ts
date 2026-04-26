import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      vanilla: 'src/vanilla.ts',
      core: 'src/core/index.ts',
      vue: 'src/adapters/vue.ts',
      svelte: 'src/adapters/svelte.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    minify: true,
    sourcemap: false,
    splitting: false,
    treeshake: true,
    external: ['react', 'react-dom', 'vue', 'svelte', '@modelcontextprotocol/sdk'],
  },
  {
    entry: { 'mcp/cli': 'src/mcp/cli.ts' },
    format: ['cjs'],
    dts: false,
    clean: false,
    minify: false,
    sourcemap: false,
    splitting: false,
    platform: 'node',
    target: 'node18',
    external: ['@modelcontextprotocol/sdk'],
    banner: { js: '#!/usr/bin/env node' },
  },
]);
