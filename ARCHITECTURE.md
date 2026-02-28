# Override Architecture

This document is the practical onboarding map for the codebase as it exists today.

## 1) What This System Is

Override is a Broadway production finance platform with three primary surfaces:

- Producer dashboard and production workspace (authenticated)
- Financial modeling and capitalization operations
- Public investor-facing Deal Room (tokenized URL, no login)

## 2) Tech Stack

- Framework: Next.js 16.1.6 App Router with static export (`output: "export"`)
- Language: TypeScript 5 (strict)
- UI: Tailwind CSS v4 + shadcn/ui + Radix primitives + Lucide icons
- Charts: Recharts 3
- Forms: react-hook-form (Controller + watch pattern; zod installed but unused for validation)
- State: Zustand with persist middleware (UI state only)
- Toasts: Sonner
- Backend: Firebase 12—Auth, Firestore, Storage, Analytics
- Hosting: Firebase Hosting serving `out/`

Key files:

- `next.config.ts`—static export, build ID injection, image unoptimization
- `src/lib/firebase.ts`—singleton Firebase init with browser guard
- `src/lib/firestore.ts`—all Firestore CRUD + `stripUndefined()` helper
- `src/lib/storage.ts`—artwork + PDF upload helpers
- `firebase.json`—hosting config, cache headers, SPA rewrite
- `firestore.rules`—owner-only production access, public deal rooms
- `storage.rules`—owner-only file access

## 3) Runtime and Routing Model

The app is built as static files (`output: "export"`), so dynamic Firestore IDs are handled via query params rather than dynamic server routes.

- Production workspace: `/productions/view?id=<productionId>`
- Deal room: `/deal-room?token=<dealRoomDocId>`

To keep browser-only dependencies safe with static export:

- `ProductionHubClient` and `DealRoomClient` load through `next/dynamic` with `ssr: false`
- Firebase init is browser-guarded and falls back to a placeholder `apiKey` during prerender

## 4) Route Structure

| Route | Auth | Component |
|-------|------|-----------|
| `/` | No | `src/app/page.tsx`—marketing landing page |
| `/login` | No | `src/app/(auth)/login/page.tsx`—email + Google sign-in |
| `/signup` | No | `src/app/(auth)/signup/page.tsx`—registration |
| `/dashboard` | Yes | `src/app/(app)/dashboard/page.tsx`—productions grid (`?view=investments` for investor view) |
| `/productions/view?id=<uuid>` | Yes | `src/app/(app)/productions/view/page.tsx` → `ProductionDynamicLoader` → `ProductionHubClient` |
| `/productions/new` | Yes | `src/app/(app)/productions/new/page.tsx`—redirect stub → `/dashboard` |
| `/deal-room?token=<uuid>` | No | `src/app/deal-room/page.tsx` → `DealRoomDynamicLoader` → `DealRoomClient` → `DealRoomView` |

Auth boundary:

- `(app)` routes require auth via `src/app/(app)/layout.tsx` (redirects to `/login`, shows skeleton while restoring session)
- `/deal-room` intentionally sits outside `(app)` and is public-by-token
- The app layout nav bar has "Productions" and "My Investments" buttons for view mode toggling

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

Production-level files at `productions/{userId}/{productionId}/`:

- `artwork`—production artwork image (max 5MB)
- `operating-agreement.pdf`—operating agreement (max 20MB)
- `instruction-letter.pdf`—investor instruction letter
- `member-signature-page.pdf`—member signature page
- `subscription-agreement.pdf`—subscription agreement

Investor files at `productions/{userId}/{productionId}/investors/{investorId}/`:

- `distributed/instruction-letter.pdf`
- `distributed/signature-page.pdf`
- `distributed/subscription-agreement.pdf`
- `signed/signature-page.pdf`
- `signed/subscription-agreement.pdf`
- `executed/signature-page.pdf`
- `executed/subscription-agreement.pdf`

Storage access is owner-restricted: auth UID must match the `userId` path segment.

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
- `DEFAULT_SCENARIOS`: Bear (60% occ, $100 ATP, 20 weeks), Base (75% occ, $115 ATP, 36 weeks), Bull (90% occ, $135 ATP, 52 weeks)

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

## 13) Build, Deploy, and Observability

### Build Pipeline

1. `npm run prebuild` → `scripts/prebuild.mjs` writes a timestamp to `.build_id`
2. `npm run build` → Next.js static export; `next.config.ts` reads `.build_id` and injects as `NEXT_PUBLIC_BUILD_ID`
3. `npm run postbuild` → `scripts/postbuild.mjs` copies `.build_id` to `out/_build_id.txt`

### Deployment

```bash
firebase deploy                    # Full deploy (hosting + Firestore rules + Storage rules)
firebase deploy --only hosting     # Hosting only
```

Firebase Hosting serves from `out/` with:
- 1-year immutable cache for `/_next/static/**`
- No-cache for HTML files
- No-store for `/_build_id.txt`
- SPA catch-all rewrite: all routes → `/index.html`

### Live Update Detection

`UpdateChecker` component polls `/_build_id.txt` in production and displays a toast (via Sonner) prompting the user to refresh when a new deployment is detected.

### Analytics

Firebase Analytics is initialized in `AnalyticsInit` component (browser-only). Typed event helpers in `src/lib/analytics.ts` track user actions across auth, deal building, investor management, and deal room flows. All events are fire-and-forget.

## 14) Current Risks / Mismatches To Be Aware Of

1. **Waterfall toggle inconsistency**—`calculateWeeklyResult` in `calculations.ts` gates the effective investor split using `hasProfitSharing` (when false, `effectiveInvestorSplit` is forced to 0%). However, `deriveWaterfallPhaseState` in `waterfallPhase.ts` derives phase state from `postRecoupInvestorSplit < 1.0` regardless of the toggle. This means the waterfall phase badge can display "Profit Sharing" while the actual financial calculations give investors 0% post-recoup if `hasProfitSharing` is false.

2. **Production deletion does not cascade**—`deleteProduction()` in `firestore.ts` only deletes the root production document. Subcollections (`dealInputs/primary`, `investors/*`, `producerPools/*`, `scenarios/*`) and associated Storage files are not cleaned up, resulting in orphaned data.

3. **Unused dependencies**—`zod`, `date-fns`, `@hookform/resolvers`, and `next-themes` are installed but have no direct imports in application code (some may be transitive requirements of shadcn/ui components).

## 15) Where To Edit For Common Changes

- Deal math changes: `src/lib/model/calculations.ts`
- Scenario defaults/grid logic: `src/lib/model/scenarios.ts`
- Waterfall phase labels/logic: `src/lib/model/waterfallPhase.ts`
- Deal form structure/UX: `src/app/(app)/productions/view/DealBuilder*.tsx` and `sections/*`
- Cap table workflows: `src/app/(app)/productions/view/InvestorSheet.tsx`, `ProducerLedger.tsx`, `PoolDialog.tsx`
- Deal room presentation/config: `src/app/(app)/productions/view/DealRoomSetup.tsx`, `src/app/deal-room/*`
- Firestore operations: `src/lib/firestore.ts`
- Access rules: `firestore.rules`, `storage.rules`

