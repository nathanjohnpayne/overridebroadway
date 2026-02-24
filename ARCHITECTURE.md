# Override Architecture

This document is the practical onboarding map for the codebase as it exists today.

## 1) What This System Is

Override is a Broadway production finance platform with three primary surfaces:

- Producer dashboard and production workspace (authenticated)
- Financial modeling and capitalization operations
- Public investor-facing Deal Room (tokenized URL, no login)

## 2) Tech Stack

- Framework: Next.js App Router (`next@16`) with static export
- Language: TypeScript (strict)
- UI: Tailwind v4 + shadcn/ui + Radix primitives
- State: React Hook Form + Zustand (UI-only persistence)
- Backend: Firebase Auth, Firestore, Storage, Analytics
- Hosting: Firebase Hosting serving `out/`

Key files:

- `next.config.ts`
- `src/lib/firebase.ts`
- `src/lib/firestore.ts`
- `firebase.json`
- `firestore.rules`
- `storage.rules`

## 3) Runtime and Routing Model

The app is built as static files (`output: "export"`), so dynamic Firestore IDs are handled via query params rather than dynamic server routes.

- Production workspace: `/productions/view?id=<productionId>`
- Deal room: `/deal-room?token=<dealRoomDocId>`

To keep browser-only dependencies safe with static export:

- `ProductionHubClient` and `DealRoomClient` load through `next/dynamic` with `ssr: false`
- Firebase init is browser-guarded and falls back to a placeholder `apiKey` during prerender

## 4) Route Structure

- `src/app/page.tsx`: marketing landing page
- `src/app/(auth)/login/page.tsx`: sign-in
- `src/app/(auth)/signup/page.tsx`: sign-up
- `src/app/(app)/dashboard/page.tsx`: productions + investments list
- `src/app/(app)/productions/view/page.tsx`: wrapper for production workspace
- `src/app/deal-room/page.tsx`: wrapper for public deal room

Auth boundary:

- `(app)` routes require auth via `src/app/(app)/layout.tsx`
- `/deal-room` intentionally sits outside `(app)` and is public-by-token

## 5) Data Model (Firestore)

Top-level collections:

- `users/{uid}`
- `productions/{productionId}`
- `dealRooms/{token}`

Production subcollections:

- `dealInputs/primary` (single canonical deal doc)
- `investors/{investorId}`
- `producerPools/{poolId}`
- `scenarios/{scenarioId}`

Important behavioral rules:

- `DealInputs` persist under fixed doc ID `"primary"`
- Firestore writes go through `stripUndefined` to avoid rejected `undefined` values
- Deal room is a snapshot model, not a live reference model

## 6) Storage Layout

Production-level files:

- `productions/{userId}/{productionId}/artwork`
- `productions/{userId}/{productionId}/agreement.pdf`
- `productions/{userId}/{productionId}/{docType}.pdf`

Investor files:

- `productions/{userId}/{productionId}/investors/{investorId}/{docType}.pdf`

Storage access is owner-restricted by `userId` in path + auth UID match.

## 7) Core UI Architecture

### 7.1 Production Workspace Orchestrator

`src/app/(app)/productions/view/ProductionHubClient.tsx` owns:

- Production load and tab navigation
- One `useForm<DealInputs>` instance for all deal inputs
- Model recomputation and scenario state
- Cap table + pools + investor sheet/dialog flows
- File uploads and production metadata edits
- Deal room setup integration

### 7.2 Deal Inputs (Two-Pane Builder)

`DealBuilder` + `DealBuilderNav` + section components:

- Left pane: guided/direct section editing
- Right pane: `LiveOutcomePanel`
- Autosave: 1.5s debounce, plus explicit Save
- Section completion contract in `sections/sectionCompletion.ts`

### 7.3 Capitalization

- Investors are managed in `InvestorSheet`
- Pools are managed with `PoolDialog`
- Rollups are computed via `computeOwnershipRollup`
- Grouped ledger UI is `ProducerLedger`

## 8) Financial Engine

Primary engine files:

- `src/lib/model/calculations.ts`
- `src/lib/model/scenarios.ts`
- `src/lib/model/waterfallPhase.ts`

Pipeline per week:

1. Gross box office from capacity/perfs/occupancy/pricing mix
2. Credit card + house deductions to adjusted gross
3. Royalties (fixed or pooled, with optional running offset pre-recoup)
4. Weekly nut and GP fees/overrides to operating profit
5. Waterfall allocation (recoup-first or share-from-dollar-one)

Scenario engine:

- `runScenario(deal, scenario)` generates full `ModelOutput`
- `generateSensitivityGrid(...)` precomputes ROI/multiple cells for UI

## 9) Investor Bridge Pattern

`DealInputs.investors` is treated as legacy/empty in practice.

Model calculations use a bridged investor list from capitalization records:

- Source: `investors` subcollection (`CapitalizationInvestor[]`)
- Bridge to engine type (`Investor[]`) at `ProductionHubClient` useMemo

This is the reason per-investor model outputs reflect cap table state, not a form field.

## 10) Deal Room Lifecycle

Producer flow (`DealRoomSetup`):

1. Create room: snapshot production metadata + deal inputs + config
2. Copy share URL
3. Update config toggles/note
4. Refresh snapshot when deal changes
5. Deactivate/reactivate access

Investor flow (`DealRoomClient` + `DealRoomView`):

- Resolve token from query param
- Read `dealRooms/{token}` (public if active)
- Run scenarios client-side against snapshotted deal inputs
- Render sections according to producer config

## 11) State Ownership Rules

Keep these intact:

- One deal form owner: `ProductionHubClient`
- Section components consume props; do not create nested `useForm`
- Zustand store (`dealStore`) is UI state only (guided mode/progress), not deal data
- Firestore is source of truth for persisted domain data

## 12) Security Model

Firestore:

- Production docs/subcollections writable only by owner UID
- Deal rooms readable only when `isActive == true`
- Deal room writes restricted to `ownedByUserId`

Storage:

- Read/write allowed only when auth UID matches path `userId`

## 13) Build and Deploy Notes

- `prebuild.mjs` writes `.build_id`
- `next.config.ts` injects `NEXT_PUBLIC_BUILD_ID`
- `postbuild.mjs` writes `out/_build_id.txt`
- `UpdateChecker` polls `_build_id.txt` in production and prompts refresh

## 14) Current Risks / Mismatches To Be Aware Of

1. Waterfall toggle semantics are partly inconsistent:

- `calculateWeeklyResult` currently gates effective investor split with `hasProfitSharing`
- `waterfallPhase` derives state from `postRecoupInvestorSplit` regardless of toggle

2. Production deletion behavior may not match UI warning:

- `deleteProduction` currently deletes only the root production document
- subcollections/files are not explicitly cascade-deleted in app code

3. Lint currently reports errors/warnings in this repository state (including React hook rule errors and unused imports/vars).

## 15) Where To Edit For Common Changes

- Deal math changes: `src/lib/model/calculations.ts`
- Scenario defaults/grid logic: `src/lib/model/scenarios.ts`
- Waterfall phase labels/logic: `src/lib/model/waterfallPhase.ts`
- Deal form structure/UX: `src/app/(app)/productions/view/DealBuilder*.tsx` and `sections/*`
- Cap table workflows: `src/app/(app)/productions/view/InvestorSheet.tsx`, `ProducerLedger.tsx`, `PoolDialog.tsx`
- Deal room presentation/config: `src/app/(app)/productions/view/DealRoomSetup.tsx`, `src/app/deal-room/*`
- Firestore operations: `src/lib/firestore.ts`
- Access rules: `firestore.rules`, `storage.rules`

