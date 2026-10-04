import { defineConfig } from 'vitest/config';

// Security rules tests (tests/rules/). These need the Firestore and Storage
// emulators, so they are excluded from `npm test` and run via
// `npm run test:rules`, which starts the emulators with `firebase emulators:exec`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.rules.test.ts'],
    // Both suites share one emulator instance; run files serially.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
