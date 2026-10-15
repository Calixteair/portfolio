import { defineConfig } from 'vitest/config';

// Unit tests only cover pure TypeScript (state machine, helpers): no GPU, no DOM.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
