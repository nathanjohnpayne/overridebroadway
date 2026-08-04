// Vitest global test setup.
//
// Wired in via `setupFiles` in vitest.config.ts. Two things have to happen
// before any component test runs, and neither happens on its own here:
//
// 1. jest-dom matchers. The suites call `expect(...).toBeInTheDocument()`,
//    `.toHaveAttribute()`, etc., but no test file imports the matcher pack.
//    The `/vitest` entrypoint registers them against vitest's `expect`.
//
// 2. DOM cleanup between tests. @testing-library/react auto-registers its
//    `cleanup` in an `afterEach` ONLY when a global `afterEach` exists —
//    i.e. when vitest runs with `globals: true`. This project keeps
//    `globals: false` and imports `describe`/`it`/`expect` explicitly, so
//    auto-cleanup never engages and rendered trees accumulate across tests
//    in a file. That surfaces as "Found multiple elements" failures in the
//    later tests of each suite. Registering cleanup explicitly here keeps
//    `globals: false` while restoring per-test isolation.
import "@testing-library/jest-dom/vitest";

import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
