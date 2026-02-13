import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    splitting: false,
    sourcemap: true,
    target: 'node18',
    shims: true,
  },
  {
    entry: { cli: 'src/cli/index.ts' },
    format: ['esm'],
    dts: false,
    clean: false,
    splitting: false,
    sourcemap: true,
    target: 'node18',
    shims: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
