---
spec_id: update-checker
title: Update Checker
status: active
last_updated: 2026-03-31
---

# Update Checker

## Overview

The `UpdateChecker` component polls for new deployments by fetching
`/_build_id.txt` and comparing its contents to the build ID baked into the
current page at build time (`NEXT_PUBLIC_BUILD_ID`). When a mismatch is
detected, a persistent toast prompts the user to refresh.

## Functional Requirements

### FR-1: Build ID Polling

- The component renders nothing visible (returns `null`).
- On mount in production (`NODE_ENV === "production"`) and when
  `CURRENT_BUILD_ID` is non-empty, it:
  1. Performs an immediate check.
  2. Sets up an interval that runs every 60 seconds (`POLL_INTERVAL`).
- Each check fetches `/_build_id.txt?t={timestamp}` with `cache: "no-store"`.
- The cache-busting `?t=` parameter ensures CDN caches are bypassed.

### FR-2: Refresh Prompt

- If the fetched build ID differs from `CURRENT_BUILD_ID`, a toast is shown:
  - Message: "A new version of Override is available."
  - Duration: `Infinity` (persistent until acted upon).
  - Action button: "Refresh" which calls `window.location.reload()`.
- The toast is shown at most once per detection (subsequent intervals that still
  see the mismatch are effectively idempotent because the toast persists).

### FR-3: Error Handling

- Network errors from the fetch are silently caught (no toast, no log). The
  next interval will retry.
- If `/_build_id.txt` returns a non-OK status (e.g. 404), the check exits early
  without showing a toast.

### FR-4: Skipping in Development

- The `useEffect` returns early when `NODE_ENV !== "production"`, so no polling
  or fetching happens during local development.
- If `CURRENT_BUILD_ID` is empty (env var not set), the effect also exits early.

### FR-5: Cleanup

- On unmount, `clearInterval` is called to stop the polling loop.

## Acceptance Criteria

- [ ] AC-1: No fetch is made when `NODE_ENV` is not `"production"`.
- [ ] AC-2: No fetch is made when `CURRENT_BUILD_ID` is empty.
- [ ] AC-3: A fetch to `/_build_id.txt` happens immediately on mount.
- [ ] AC-4: Subsequent fetches happen every 60 seconds.
- [ ] AC-5: When the fetched ID differs from the current ID, a persistent toast
  with a "Refresh" action is shown.
- [ ] AC-6: When the fetched ID matches, no toast is shown.
- [ ] AC-7: Network errors are silently swallowed.
- [ ] AC-8: The interval is cleared on component unmount.
