---
spec_id: dashboard
title: Dashboard
status: active
last_updated: 2026-03-31
---

# Dashboard

## Overview

The dashboard (`/dashboard`) is the authenticated landing page. It displays the
user's productions as a card grid, supports a "My Investments" filter view, and
provides a dialog for creating new productions. It is backed by a real-time
Firestore subscription via the `useProductions` hook.

## Functional Requirements

### FR-1: Production List Rendering

- Productions are displayed as cards in a responsive grid
  (1 col mobile, 2 col md, 3 col lg).
- Each card shows:
  - Artwork banner (or a gradient placeholder with a theater mask emoji).
  - Production name, optional subtitle, and optional venue.
  - A status badge with color coding: development (yellow), preview (blue),
    open (green), closed (gray).
  - "Updated {date}" timestamp.
  - A chevron-right icon indicating the card is clickable.
- Clicking a card navigates to `/productions/view?id={productionId}`.

### FR-2: Loading State

- While `loading` is `true`, three `Skeleton` placeholders render in the grid.

### FR-3: Empty State

- When the user has no productions, a centered empty state is displayed with a
  theater mask emoji, "No productions yet" heading, descriptive text, and a
  "New Production" button.
- When the user is in the "My Investments" view and has no personal investments,
  a different empty state with a briefcase emoji and instructions is shown.

### FR-4: View Toggle (Productions vs Investments)

- A segmented toggle ("My Productions" / "My Investments") controls which
  productions are displayed.
- The investments view filters to productions where `hasPersonalInvestment` is
  `true`.
- The `?view=investments` query parameter is synced bidirectionally with the
  active view.

### FR-5: Create Production

- A "New Production" button opens a dialog with fields: Production Name
  (required), Subtitle/Tagline, Venue/Theatre, and Status (select: development,
  preview, open, closed).
- On submit, `createProduction` is called with the user's UID.
- On success: a toast confirms creation, the dialog closes, form state resets,
  and the user is redirected to `/productions/view?id={newId}&new=1`.
- On failure: a toast error is shown.

### FR-6: Delete Production

- Each card has a three-dot overflow menu (visible on hover) with a "Delete
  production" item.
- Clicking it opens a confirmation dialog stating the action is permanent.
- On confirm, `deleteProduction` is called and a success toast fires.
- On failure, an error toast is shown.

### FR-7: Real-Time Updates

- The `useProductions` hook uses `onSnapshot` to subscribe to the user's
  productions collection. Any Firestore change (add, update, delete) is
  reflected immediately without a page reload.

## Acceptance Criteria

- [ ] AC-1: Productions render as cards with name, status badge, and updated date.
- [ ] AC-2: Three skeleton placeholders appear during loading.
- [ ] AC-3: The empty state renders when no productions exist.
- [ ] AC-4: The investments empty state renders when no personal investments exist.
- [ ] AC-5: Clicking a production card navigates to its detail page.
- [ ] AC-6: The "New Production" dialog creates a production and redirects.
- [ ] AC-7: The delete flow confirms and removes the production.
- [ ] AC-8: The header shows a production count ("N productions in your portfolio").
