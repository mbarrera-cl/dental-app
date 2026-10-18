import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`. Requires Vite 8, which ships this option.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    fileParallelism: false,
    // One worker at a time: the DB-based specs share one test schema and the
    // helper assumes files never overlap (see postgres-test-database.ts).
    maxWorkers: 1,
    root: './',
    // Backend unit specs only; the frontend has its own runner (`ng test`).
    include: ['src/**/*.spec.ts'],
  },
});
