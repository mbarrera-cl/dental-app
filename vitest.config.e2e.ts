import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    fileParallelism: false,
    // One worker at a time: every spec rebuilds the same shared test schema and
    // assumes files never overlap (see postgres-test-database.ts).
    maxWorkers: 1,
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
