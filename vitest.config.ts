import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/core/**', 'src/utils/**', 'src/cli/**'],
    },
  },
});
