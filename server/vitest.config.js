import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.js'],
    exclude: ['node_modules', 'data'],
    testTimeout: 10000,
    hookTimeout: 10000,
    // Run test files sequentially to avoid database contention
    fileParallelism: false,
  },
});
