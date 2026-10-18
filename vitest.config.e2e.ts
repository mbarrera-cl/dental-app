import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    fileParallelism: false,
    // One fork at a time: every spec rebuilds the same shared test schema and
    // assumes files never overlap (see postgres-test-database.ts).
    poolOptions: { forks: { maxForks: 1 } },
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
