---
spec_id: deal-rooms
title: Deal Rooms
status: active
last_updated: 2026-09-29
---

# Deal Rooms

## Overview

Deal Rooms provide a secure, read-only, no-auth investor view of a production's
deal structure. A producer creates a deal room from their production hub, which
snapshots the current deal inputs and production metadata into a standalone
Firestore document. The resulting share URL (`/deal-room?token={id}`) is
publicly accessible -- the token IS the access credential.

## Functional Requirements

### FR-1: Deal Room Creation (Producer Side)

- The `DealRoomSetup` component lives in the "Deal Room" tab of the production
  hub.
- Before creating, the producer must have a valid deal (capitalization > 0 and
  capacity > 0). If not, a warning banner is shown and the create button is
  disabled.
- Clicking "Create Deal Room" calls `createDealRoom` which writes a new document
  to the `dealRooms` Firestore collection with:
  - Snapshotted production metadata (name, subtitle, venue, status, artwork). Document URLs and names are included only when `showDocuments` is enabled.
  - Snapshotted `DealInputs` model parameters, built through an allowlist in `src/lib/dealRoomSnapshot.ts`; `investors` is always published as `[]`.
  - A `DealRoomConfig` controlling which sections are visible.
  - `isActive: true`.
- The deal room document is publicly readable by token, so it contains only what the producer opted into; visibility toggles control what is written, not just what is rendered.
- The resulting document ID (token) is saved back to the production record
  (`dealRoomToken`, `dealRoomEnabled`).
- The share URL is displayed and can be copied to clipboard.

### FR-2: Share Link Generation

- The share URL format is `{origin}/deal-room?token={documentId}`.
- A "Copy Link" button writes the URL to the clipboard and fires an analytics
  event.
- An external-link button opens the deal room in a new tab.

### FR-3: Deal Room Configuration

- The producer can toggle visibility of these sections:
  - Financial Scenarios (Bear / Base / Bull).
  - Revenue Waterfall visualization.
  - Week-by-Week Breakdown table.
  - Capitalization Structure (aggregate only -- no individual investor data).
  - Documents (links to uploaded investor docs).
- An optional "Producer Note" (max 500 characters) is included.
- A "Save Settings" button persists config changes to the deal room document and re-snapshots the published production metadata so document URLs follow the `showDocuments` toggle. Deal input values are not refreshed by Save Settings.

### FR-4: Snapshot Management

- The deal room captures data at creation time. Edits to deal inputs after
  sharing do NOT automatically propagate.
- "Update Snapshot" re-snapshots the current deal inputs and production metadata.
- "Deactivate Link" sets `isActive: false`, making the URL return a "no longer
  active" message.
- "Reactivate Link" restores access. The owner can always read their own room (active or not), so an inactive room stays manageable from the production hub.
- Deleting a production fences writes, retires and scrubs its deal rooms, removes its subcollections, and retains a minimal permanent production reservation. Uploaded files are removed by the same backend operation; failures leave the fenced production available for deletion retry. Retired room tokens cannot be reactivated or reassigned.

### FR-5: No-Auth Investor Access

- The `/deal-room` route is outside the `(app)` layout -- no `AuthProvider`
  wrapping is required.
- `DealRoomClient` reads `?token=` from the URL and calls `getDealRoom(token)`.
- Load states: `loading`, `not_found` (no doc / no token), `inactive`
  (`isActive === false`, or the read is denied with `permission-denied` because the room was deactivated), `error`, `ready`.
- Security rules allow a direct get of an active room whose snapshot honors the documents opt-in (or of a token that does not exist); queries over `dealRooms` are owner-only. Rooms saved before the opt-in was enforced read as inactive for investors until the producer saves settings, updates the snapshot, or reactivates (reactivation re-publishes a sanitized snapshot).
- The share token is never sent to analytics: `deal_room_viewed` logs the production id, and Analytics on `/deal-room` reports `page_location` without the query string and skips the automatic page_view.
- Each non-ready state renders a branded error card with appropriate messaging.

### FR-6: Deal Room Content Display

- `DealRoomView` receives the hydrated `DealRoom` and renders:
  - Production header: name, status badge, subtitle, venue, shared date, artwork.
  - Producer note (if present).
  - Deal structure: total cap, unit price, weekly nut, capacity, ticket price,
    waterfall type, post-recoup split, breakeven occupancy.
  - Financial Scenarios: three `ScenarioCard` components (Bear / Base / Bull)
    computed client-side via `runScenario`.
  - Revenue Waterfall (Base case) -- `WaterfallFlow` component.
  - Weekly Breakdown table (first 20 open weeks of Base case).
  - Capitalization Structure (aggregate only; individual investor details are
    never exposed).
  - Documents section with linked file cards.
  - Legal disclaimer footer.
- A sticky top bar shows "Override" branding and a "Secure investor view -
  Read-only" badge.

## Acceptance Criteria

- [ ] AC-1: `createDealRoom` snapshots current deal inputs and saves the token
  to the production.
- [ ] AC-2: The share URL is correctly formatted and can be copied to clipboard.
- [ ] AC-3: Visiting `/deal-room?token={valid}` renders the deal room without
  authentication.
- [ ] AC-4: Visiting with a missing token shows "Deal room not found".
- [ ] AC-5: Visiting an inactive deal room shows "This deal room is no longer
  active".
- [ ] AC-6: Financial scenarios are computed client-side with Bear / Base / Bull
  parameters.
- [ ] AC-7: Sections are conditionally rendered based on `DealRoomConfig` toggles.
- [ ] AC-8: Individual investor data is never exposed in the deal room.
- [ ] AC-9: Document URLs are absent from the deal room document unless `showDocuments` is enabled.
- [ ] AC-10: Unauthenticated clients cannot query or list deal rooms (covered by `tests/rules/firestore.rules.test.ts`).
