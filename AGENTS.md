# AGENTS.md

## 1. Repository Overview

Override is the financial operating platform for Broadway producers — from modeling capitalization to managing investors, tracking recoupment, and distributing returns.

**Project type:** Next.js 16 App Router, `output: 'export'` (static export) + Firebase Hosting/Auth/Firestore/Storage. No backend server, no Cloud Functions.

**Stack:**
- Next.js 16.1.6 (App Router, static export)
- TypeScript 5 (strict)
- Tailwind CSS v4 + shadcn/ui (Radix primitives) + Lucide icons
- Recharts 3 (charts)
- react-hook-form (values managed via Controller + watch; zod installed but not used for form validation)
- Zustand with persist middleware (guided mode UI state across page refreshes)
- Sonner (toasts for auth, save, upload, and deal room flows)
- Firebase 12 — Auth, Firestore, Storage, Analytics
- Firebase Hosting (static export, custom domain: overridebroadway.com)

**Common commands:**
```bash
npm run dev              # Local development server (http://localhost:3000)
npm run build            # Static export → out/ (runs prebuild + postbuild scripts)
npm run lint             # ESLint (flat config)
npm run deploy           # Full deploy (hosting + rules + storage) via keyless impersonation
npm run deploy:hosting   # Hosting only
op-firebase-deploy --only firestore:rules   # Any target combo
```

### Project Structure

```
src/
├── app/
│   ├── layout.tsx             # Root layout: Geist font, AuthProvider, TooltipProvider, Toaster, SEO meta
│   ├── globals.css            # Tailwind v4 imports + CSS custom properties (theme tokens, dark mode)
│   ├── (auth)/login/          # Email + Google sign-in
│   ├── (auth)/signup/         # Registration (display name, email, password, Google OAuth)
│   ├── (app)/layout.tsx       # App shell: sticky nav, auth guard, skeleton
│   ├── (app)/dashboard/       # Portfolio grid (?view=investments for My Investments mode)
│   ├── (app)/productions/new/ # Legacy redirect stub → /dashboard
│   ├── (app)/productions/view/ # Production hub—uses ?id= query param
│   │   ├── page.tsx                    # Server wrapper: generateStaticParams
│   │   ├── ProductionDynamicLoader.tsx  # Client: next/dynamic ssr:false
│   │   ├── ProductionHubClient.tsx      # Main client component (owns useForm)
│   │   ├── DealBuilder.tsx              # Two-pane deal workspace
│   │   ├── DealBuilderNav.tsx           # Section nav (guided stepper / direct tabs)
│   │   ├── LiveOutcomePanel.tsx         # Sticky real-time outcome card
│   │   ├── WaterfallFlow.tsx            # Waterfall distribution visualization
│   │   ├── InvestorSheet.tsx            # Investor CRUD sheet
│   │   ├── InvestorStatusBadge.tsx      # Status chip for investor lifecycle
│   │   ├── PoolDialog.tsx               # Producer pool create/edit dialog
│   │   ├── ProducerLedger.tsx           # Investor distribution ledger view
│   │   ├── DealRoomSetup.tsx            # Producer-facing deal room configuration panel (6th tab)
│   │   ├── sections/                    # Section form components
│   │   │   ├── CapitalizationSection.tsx
│   │   │   ├── WeeklyEconomicsSection.tsx
│   │   │   ├── RevenueSection.tsx
│   │   │   ├── RoyaltiesSection.tsx
│   │   │   ├── WaterfallSection.tsx
│   │   │   └── sectionCompletion.ts     # Section contracts + isComplete() logic
│   │   └── shared/
│   │       └── FormFields.tsx           # Shared form field primitives
│   ├── deal-room/             # Public investor-facing deal room (no auth required)
│   │   ├── page.tsx                    # Thin server wrapper
│   │   ├── DealRoomDynamicLoader.tsx   # Client: next/dynamic ssr:false
│   │   ├── DealRoomClient.tsx          # Reads ?token=, fetches deal room, handles error states
│   │   └── DealRoomView.tsx            # Full investor-facing display (scenarios, waterfall, docs)
│   └── page.tsx               # Marketing landing page
├── components/
│   ├── AnalyticsInit.tsx      # Fires Firebase Analytics on mount
│   ├── UpdateChecker.tsx      # Build-ID polling for live update detection
│   └── ui/                    # shadcn/ui primitives (20 components)
├── contexts/
│   └── AuthContext.tsx        # Auth state, signIn/signUp/signOut
├── hooks/
│   ├── useProductions.ts      # Real-time onSnapshot listener for production list
│   ├── useDealInputs.ts       # Load/save deal inputs to Firestore
│   ├── useInvestors.ts        # CRUD + real-time listener for cap table investors
│   ├── useProducerPools.ts    # CRUD + real-time listener for producer pools
│   └── useDebounce.ts         # Generic debounce hook (used for autosave)
├── lib/
│   ├── firebase.ts            # Firebase app init (browser guard)
│   ├── analytics.ts           # Typed analytics event helpers
│   ├── firestore.ts           # All Firestore CRUD operations
│   ├── storage.ts             # Artwork + PDF upload helpers
│   ├── utils.ts               # Tailwind cn() utility
│   └── model/
│       ├── calculations.ts    # Core financial engine (per-week calculations)
│       ├── scenarios.ts       # runScenario(), Bear/Base/Bull, sensitivity grid
│       ├── waterfallPhase.ts  # Waterfall phase derivation (4-state enum)
│       ├── formatters.ts      # Currency, percent, multiple, IRR formatters
│       └── ownershipRollup.ts # Investor + pool ownership aggregation
├── stores/
│   └── dealStore.ts           # Zustand: guided mode UI state (NOT deal data)
└── types/
    ├── production.ts          # Production, ProductionStatus
    ├── deal.ts                # DealInputs, Investor, Royalties, DEFAULT_DEAL_INPUTS
    ├── capitalization.ts      # CapitalizationInvestor, ProducerPool, InvestorStatus
    ├── dealRoom.ts            # DealRoom, DealRoomConfig, DEFAULT_DEAL_ROOM_CONFIG
    └── model.ts               # WeeklyResult, ModelOutput, Scenario, InvestorReturn, SensitivityCell
```

### Firestore Data Model

```
users/{uid}
productions/{productionId}        # owned by userId field
  dealInputs/primary              # single document per production (fixed ID "primary")
  investors/{investorId}          # CapitalizationInvestor documents
  producerPools/{poolId}          # ProducerPool documents
  scenarios/{scenarioId}          # saved Scenario documents
dealRooms/{token}                 # top-level collection; token = document ID = share credential
```

**Security rules:**
- Productions and subcollections: `request.auth.uid == resource.data.userId`
- Deal rooms: public read when `isActive == true`; writes require ownership

**Composite indexes** (`firestore.indexes.json`):
- `productions`: userId ASC + updatedAt DESC; userId ASC + createdAt DESC; userId ASC + status ASC + createdAt DESC
- `scenarios`: productionId ASC + createdAt DESC

### Firebase Project

- **Project ID:** `soyouthinkyouwant`
- **Project Number:** 777571271688
- **Org:** nathanpayne.com
- **Auth providers:** Email/Password, Google
- **Custom domain:** overridebroadway.com

### Build Pipeline

```
1. prebuild (scripts/prebuild.mjs)   → generates timestamp-based build ID, writes to .build_id
2. build (next build)                → static export to out/; injects NEXT_PUBLIC_BUILD_ID
3. postbuild (scripts/postbuild.mjs) → copies .build_id to out/_build_id.txt
```

`UpdateChecker` polls `/_build_id.txt` in production to detect new deployments and prompts users to refresh.

---

## 2. Agent Operating Rules

1. **Read before editing.** Read every file you will touch before proposing changes. Understand existing code first.
2. **Static export rules.** Never add `"use client"` to `app/(app)/productions/view/page.tsx` — it will break `generateStaticParams`. Use the `*DynamicLoader` client pattern.
3. **One form instance.** There is exactly one `useForm<DealInputs>()` in `ProductionHubClient`. Never create a new `useForm()` in a section component or in `DealBuilder`. Use `<Controller>` with the `control` prop passed from the parent.
4. **`DealInputs.investors` is always `[]` in Firestore.** Do not read investors from the deal form or saved deal to drive investor returns — always bridge from `useInvestors()` at the `modelOutput` useMemo call site.
5. **`stripUndefined()` before every Firestore write.** Firestore rejects documents with `undefined` values. All saves in `firestore.ts` go through `stripUndefined<T>()`.
6. **`/deal-room` is outside `(app)/` by design.** No auth requirement. Investors access it via a private token URL. Do not move it inside `(app)/`.
7. **Zustand is UI state only.** `useDealStore` tracks guided mode UI state across page refreshes. Deal data lives in Firestore via `useDealInputs` + react-hook-form. Do not store deal data in Zustand.
8. **Do not add Firebase imports in server components.** Always guard with `typeof window` or use client components.
9. **No secrets in tracked files.** `NEXT_PUBLIC_FIREBASE_*` stays in `.env.local` (gitignored). Run `npm run build` before every PR.
10. **Never edit `out/` directly.** Run `npm run build` to regenerate.
11. **Do not delete tests or CI scripts to force a build to pass.**

### Key Architectural Decisions

**Static Export + Dynamic Routes:** Firebase Hosting serves static files, but production IDs are Firestore UUIDs unknown at build time. The production hub lives at `/productions/view` (not `/productions/[id]`). The production ID is passed via `?id=` query param and read at runtime with `useSearchParams()`. Same pattern for Deal Room: `/deal-room?token=<uuid>`.

**Firebase Initialization:** The Firebase app is initialized with a placeholder `apiKey` during SSR/prerender (`typeof window === 'undefined'`) to prevent build failures. Real keys come from `.env.local` at runtime.

**Auth Persistence:** `browserLocalPersistence` is set on the Firebase Auth instance to prevent logout on navigation in the static export context. The `(app)` layout shows a skeleton while `loading || !user`.

**Firestore `undefined` Safety:** All saves go through `stripUndefined<T>()` in `firestore.ts`, which recursively removes `undefined` fields while preserving Firestore sentinel values (detected via `_methodName` duck-typing).

**Form State Ownership:** One `useForm<DealInputs>()` instance lives in `ProductionHubClient`. All section components and `DealBuilder` receive `control`, `watch`, `setValue`, `getValues`, `handleSubmit` as props.

**Live Model Updates:** `ProductionHubClient` calls `watch()` on all form values. The model is recomputed as `runScenario({ ...dealInputs, ...liveFormValues }, scenario)` so any edit reflects immediately in the Financial Model tab and LiveOutcomePanel.

**Autosave:** `DealBuilder` debounces form values with 1.5s delay. Race prevention: autosave only fires when `isDirty === true`. Explicit Save button resets dirty state, stopping pending debounced autosave.

**Investor Bridge:** `CapitalizationInvestor[]` records are bridged into `Investor[]` before `runScenario()`. `DealInputs.investors` is always `[]` in Firestore — overridden at computation time:
```typescript
const bridgedInvestors = investors
  .filter((inv) => inv.amountCommitted > 0)
  .map((inv) => ({ id: inv.id, name: inv.name, amount: inv.amountCommitted, units: inv.shares }));
const liveDeal = { ...dealInputs, ...liveFormValues, investors: bridgedInvestors };
```

**Zustand Store:** `useDealStore` (persist key: `"deal-builder-ui"`) tracks guided mode UI state only. Old `"broadway-deal-draft"` localStorage key is obsolete.

### Dashboard

`/dashboard` — authenticated home screen with two view modes:
- **My Productions** (default): Grid of production cards the user owns
- **My Investments** (`?view=investments`): Placeholder for investor view (feature stub)

**Production CRUD:** Create dialog with name, status, optional subtitle/venue. Delete confirmation dialog — currently deletes only the root production document; subcollections and Storage files are **not cascade-deleted** (known gap).

### Deal Builder Architecture

Two-pane workspace (Deal Inputs tab inside `ProductionHubClient`):

```
┌─────────────────────────────────────┬────────────────┐
│  Left pane (flex-1)                 │  Right pane    │
│  ─ DealBuilderNav (section nav)     │  (w-72, sticky)│
│  ─ Active section form component    │                │
│  ─ Sticky save bar                  │  LiveOutcome   │
│                                     │  Panel         │
└─────────────────────────────────────┴────────────────┘
```

On mobile (`< lg`), right pane collapses to a horizontal summary strip.

**Navigation Modes:**
- **Guided Mode** (vertical stepper): One section at a time; Back/Next buttons; Next disabled until `isComplete()` returns true
- **Direct Mode** (horizontal tabs): All sections accessible; click to jump to any

**Section Completion Contract** (`sections/sectionCompletion.ts`):

| Section ID | Complete When |
|-----------|--------------|
| `capitalization` | totalCapitalization > 0 AND unitPrice > 0 |
| `weekly-economics` | weeklyNut > 0 AND performances > 0 AND estimatedWeeks > 0 |
| `revenue` | capacity > 0 AND avgTicketPrice > 0 |
| `royalties` | sum of all royalties.* values > 0 |
| `waterfall` | waterfallType defined AND postRecoupInvestorSplit > 0 |

**Section Component Props** — every section accepts the same interface:
```typescript
interface SectionProps {
  control: Control<DealInputs>;
  watch: UseFormWatch<DealInputs>;
  setValue: UseFormSetValue<DealInputs>;
  modelOutput: ModelOutput | null;
  dealInputs: DealInputs | null;
}
```

### Deal Room

`/deal-room?token=<uuid>` — public, read-only investor workspace. No login required.

- **Token = Document ID**: The UUID token is the `dealRooms/{token}` document ID. Knowing the URL is the access credential.
- **Snapshot model**: `DealInputs` are copied at share time. Edits after sharing don't update automatically — producer must click "Update Snapshot".
- **No individual investor data**: Only aggregate deal economics are exposed.

**Producer Workflow** (DealRoomSetup.tsx — 6th tab):
1. Click "Create Deal Room" → generates UUID, snapshots current DealInputs + metadata → saves to `dealRooms/{token}`
2. Toggle sections on/off; add optional producer note (max 500 chars)
3. Copy share link → `https://overridebroadway.com/deal-room?token=<uuid>`
4. "Update Snapshot" re-saves current deal inputs
5. Deactivate / Reactivate to control access without deleting

**Investor View** (DealRoomView.tsx): Runs `runScenario()` client-side against snapshotted `dealInputs`. Three built-in scenarios (from `DEFAULT_SCENARIOS`): Bear (60% occ, $100 ATP, 20-week), Base (75% occ, $115 ATP, 36-week), Bull (90% occ, $135 ATP, 52-week).

### LiveOutcomePanel

Read-only card. Zero business logic — all computation is upstream in `runScenario()`.

Displayed metrics (from first open, non-preview week):
- Weekly Gross, Weekly Profit, Breakeven Occupancy, Recoup Week, Investor Multiple, Risk Band, Waterfall Phase badge

Three-case capital recovery display:
1. Full recoup → Recoup Week + Investor Multiple
2. Partial recoup → "Full Recoup Not Reached" + "Capital Returned: $X (YY%)"
3. No recovery → "No Capital Recovery Modeled" + "$0 (0%)"

---

## 3. Code Modification Rules

- **TypeScript:** Strict mode. All new code must be fully typed — no `any` unless unavoidable.
- **Framework:** Next.js 16 App Router. Follow existing patterns in `src/app/`.
- **UI:** Tailwind CSS v4 + shadcn/ui. No custom CSS modules or styled-components.
- **Charts:** `recharts` only.
- **Forms:** `react-hook-form` with `Controller`. One `useForm<DealInputs>()` instance in `ProductionHubClient` — never create a new form instance elsewhere.
- **State:** Zustand for UI state only. Deal data lives in Firestore via `useDealInputs`.
- **Firestore writes:** `setDoc` with `stripUndefined()` applied before every write.
- **Static export:** Never use `useSearchParams()` directly in a server component. Use `*DynamicLoader` pattern.

### Financial Model

**Do not modify the financial engine without understanding the full calculation chain:**
- `src/lib/model/calculations.ts` — core per-week calculations
- `src/lib/model/scenarios.ts` — `runScenario()`, sensitivity grid
- `src/lib/model/waterfallPhase.ts` — waterfall phase derivation (pure functions)

#### Calculation Pipeline (per week)

```
Gross Box Office
  = capacity × performances × occupancyRate × blended_ticket_price

Credit Card Fees = grossBoxOffice × creditCardFeeRate  (default 3%)
House Deduction  = grossBoxOffice × housePercentage    (default 6%)
  + optional: aboveThreshold × houseProfitsSplitAbove

Adjusted Gross = Gross − CC Fees − House Deduction

Royalties:
  Mode A (fixed %): each participant's rate × adjustedGross, summed
  Mode B (pool):    adjustedGross × royaltyPoolPercentage
  Running Royalty Offset: if pre-recoupment and enabled,
    subtract royaltyOffsetAmount (fixed $) from gross royalty bill, floor at $0.

Net Box Office = Adjusted Gross − Total Royalties

Operating Profit = Net Box Office − Weekly Nut − GP Fee − GP Flat Overrides
  GP Fee       = max(0, operatingProfit_before_gp_fee) × gpFeeRate
  GP Flat      = gpFlatWeekly (fixed $) + remaining_profit × gpFlatProfitPercent

Waterfall (Recoup First):
  Pre-recoupment:  100% of operating profit → recoupment pool
  Boundary week:   profit split proportionally at the recoupment threshold
  Post-recoupment: investorPool = operatingProfit × postRecoupInvestorSplit
                   GP carve = investorPool × gpShareOfInvestorPool
                   LP investors receive: investorPool − GP carve (pro-rata by poolPercent)
                   creatives receive: operatingProfit × (1 − postRecoupInvestorSplit)

Waterfall (Share From Dollar One):
  Every week: investorPool = operatingProfit × postRecoupInvestorSplit
  investorPool counts toward both distribution AND recoupment tracking
```

#### IRR Calculation
Newton-Raphson iteration on weekly investor cash flows (`investorDistribution` values), annualized as `(1 + weeklyRate)^52 − 1`. Returns `null` if no distributions occur.

#### Weekly Breakeven
Binary search (100 iterations) for the occupancy rate at which `operatingProfit = 0`. Searches 0%–150% occupancy. `null` means even 150% occupancy doesn't generate positive profit.

### Waterfall Phase Engine

`src/lib/model/waterfallPhase.ts` — pure functions, no React, no side effects.

**WaterfallPhase enum:**
```typescript
enum WaterfallPhase {
  PRE_REVENUE,                 // No week generates positive operating profit
  RECOUPMENT,                  // Profit exists but cumulative < totalCapitalization
  POST_RECOUP_PROFIT_SHARING,  // Recouped AND postRecoupInvestorSplit < 1.0
  CLOSED,                      // Recouped AND postRecoupInvestorSplit === 1.0
}
```

**Critical rule:** `profitSharingEnabled` is derived from `postRecoupInvestorSplit < 1.0` — never from the `hasProfitSharing` boolean toggle. The toggle only controls form field editability; it does not gate financial phase derivation.

**Phase derivation:**
```
if no week has operatingProfit > 0  → PRE_REVENUE
else if not yet recouped            → RECOUPMENT
else if postRecoupInvestorSplit < 1 → POST_RECOUP_PROFIT_SHARING
else                                → CLOSED
```

### Investor Outcome Sensitivity Grid

`generateSensitivityGrid()` in `scenarios.ts` — all investor outcome math computed here, never re-derived in the React layer.

**Color system** (ROI-driven, not recoup-timing-driven):
```typescript
if (!recoupAchieved || roi < 0)  → bg-red-100    (Loss)
if (roi <= 0.05)                 → bg-yellow-100  (Break-even)
if (multiple <= 1.5)             → bg-green-100   (1.0–1.5× return)
else                             → bg-green-200   (>1.5× return)
```

**Hover tooltip reflow prevention:** The tooltip strip is always rendered at fixed `h-9`. Never conditionally mount/unmount — toggle its content instead.

### Shared Form Field Components

`src/app/(app)/productions/view/shared/FormFields.tsx`:
- `InfoTip({ children })` — wraps own `TooltipProvider`
- `PercentInput({ value, onChange })` — displays 0–1 as percentage; fires onChange as decimal
- `CurrencyInput({ value, onChange, placeholder? })` — displays with $ prefix + commas; fires onChange as raw number

**Note:** `ProductionHubClient.tsx` has local copies of these components for tabs outside the Deal Builder. Do not remove those.

### Firestore Change Checklist

If you change Firestore fields or collection names:
1. Update the writing component
2. Update `src/lib/firestore.ts`
3. Update `firestore.rules` if security rules are affected
4. Document the collection in AGENTS.md

### New Route / Feature Checklist

When adding a new authenticated page:
1. Add route under `src/app/(app)/`
2. Wire navigation in `src/app/(app)/layout.tsx` if it needs a nav entry
3. Add analytics event in `src/lib/analytics.ts`

---

## 4. Documentation Rules

- **No duplicate documentation.** Do not redefine topics already covered in `AGENTS.md`, `DEPLOYMENT.md`, `CONTRIBUTING.md`, or `.ai_context.md`.
- **Code vs. docs disagreement:** Trust the implementation first, then update documentation to match or explicitly call out the gap.
- **`rules/repo_rules.md`** is the authoritative list of structure invariants and CI checks.
- **`.claude/` must not contain instruction files.** Only machine-generated config (`.claude/settings.local.json` is permitted).
- **`.cursor/rules/*.mdc`** files are valid Cursor AI rules config — not instruction prose. Do not flag or modify them.
- **New top-level directories** require explicit justification documented in `AGENTS.md` or a `plans/` entry.

---

## 5. Testing Requirements

- Run `npm run build` after code changes — static export must succeed.
- Run `npm run lint` — no ESLint errors.
- There is no automated unit test suite. When modifying financial calculations, test manually:
  1. Create a test production in the app
  2. Verify deal inputs save and reload correctly via Firestore
  3. Verify the financial model renders expected outputs for known inputs
  4. Test autosave (wait 1.5s after edit, verify Firestore is updated)
  5. Test deal room share flow end-to-end
- Leave clear notes in your final response about what was and was not manually verified.
- **Do not delete tests or CI scripts to force a build to pass.**

### CI Scripts

Run these before opening a PR:

```bash
scripts/ci/check_required_root_files
scripts/ci/check_no_tool_folder_instructions
scripts/ci/check_no_forbidden_top_level_dirs
scripts/ci/check_dist_not_modified
scripts/ci/check_spec_test_alignment
scripts/ci/check_duplicate_docs
```

---

## 6. Deployment Process

See `DEPLOYMENT.md` for full instructions.

Deploy requires `firebase-tools`, Google Cloud SDK (`gcloud`), the local `gcloud` wrapper, and access to impersonate `firebase-deployer@soyouthinkyouwant.iam.gserviceaccount.com`.

```bash
# Full deploy (hosting + Firestore rules + Storage rules)
npm run deploy

# Hosting only
npm run deploy:hosting
```

**First-time setup:**
```bash
gcloud auth application-default login
op-firebase-setup soyouthinkyouwant
```

**Environment variables** — required in `.env.local` (never commit real values):
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=soyouthinkyouwant.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=soyouthinkyouwant
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=soyouthinkyouwant.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=777571271688
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

---

## Reference: Types, Hooks, Analytics, and Benchmarks

### DealInputs Key Fields (deal.ts)

```typescript
// Capitalization
totalCapitalization: number
units: number              // auto-computed: Math.round(cap / unitPrice)
unitPrice: number
investors: Investor[]      // LEGACY — always [] in Firestore; overridden at compute time

// Weekly operations
weeklyNut: number
capacity: number           // seats
performances: number       // per week
avgTicketPrice: number
discountRate: number       // 0–1
discountedTicketPrice: number

// Revenue splits
creditCardFeeRate: number  // 0–1
housePercentage: number    // 0–1
houseProfitsThreshold?: number
houseProfitsSplitAbove?: number

// Royalties
royalties: Royalties       // { author, music, lyricist, director, choreographer,
                           //   setDesigner, costumeDesigner, lightingDesigner,
                           //   soundDesigner, starParticipation, productionCompany }
royaltyBase: "adjusted_gross" | "net"
royaltyPoolType: "fixed" | "pool"
royaltyPoolPercentage?: number

// GP compensation (applied pre-waterfall, every profitable week)
gpFeeRate: number
gpShareOfInvestorPool: number
gpFlatWeekly?: number
gpFlatProfitPercent?: number
weeklyOfficeCharge: number // Firestore compat only — NOT used in calculations

// Waterfall
waterfallType: "recoup_first" | "share_from_dollar_one"
hasProfitSharing: boolean  // Gates effective investor split (see Common Pitfalls)
postRecoupInvestorSplit: number
runningRoyaltyOffset: boolean
royaltyOffsetAmount?: number

// Run parameters
estimatedWeeks: number
previewWeeks: number
openingWeek: number
```

**DEFAULT_DEAL_INPUTS** — industry-calibrated starting values: $2M cap, $20K unit price, $450K weekly nut, 1,200 seats, 8 perfs/week, $125 ATP, 20% discount rate, 3% CC fee, 6% house %, ~16.25% royalties, 10% GP carve, 50% post-recoup investor split, 52-week run.

### CapitalizationInvestor vs. Investor

- `Investor` (deal.ts) — simplified `{ id, name, amount, units }` used in the financial model. **Never stored in Firestore** — always bridged from `CapitalizationInvestor` at compute time.
- `CapitalizationInvestor` (capitalization.ts) — full investor record in `investors/{investorId}` subcollection; drives Capitalization tab UI. Status: `"invited" | "docs_sent" | "signed" | "funded" | "admitted"`.

### ProducerPool

A "Direct Investors" default pool is lazily created by `ensureDefaultPool()` in `firestore.ts` when none exists. Legacy investors without a `producerPoolId` are assigned to this pool via `assignInvestorsToDefaultPool()`.

### Hooks Reference

| Hook | Returns | Purpose |
|------|---------|---------|
| `useDealInputs(productionId)` | `{ dealInputs, loading, saving, save }` | Loads deal from Firestore; `save()` calls `stripUndefined` before `setDoc` |
| `useDebounce<T>(value, delay)` | `T` (debounced) | Generic debounce — 1.5s autosave in DealBuilder |
| `useInvestors(productionId)` | `{ investors, loading, add, update, remove }` | Real-time onSnapshot for `investors` subcollection |
| `useProducerPools(productionId, ownerUserId)` | `{ pools, loading, defaultPoolId, add, update, remove }` | Real-time listener for producer pools; lazy-migrates legacy investors to default pool |
| `useProductions()` | `{ productions, loading }` | Real-time listener for all productions owned by current user |

### Analytics Events (src/lib/analytics.ts)

| Event | Trigger |
|-------|---------|
| `pageView` | Page mount |
| `signUp` / `login` | Registration / sign-in |
| `productionCreated` | New production dialog |
| `dealInputsSaved` | Deal save (manual or autosave) |
| `scenarioRun` | Scenario execution |
| `sensitivityGridViewed` | Scenarios tab loaded |
| `artworkUploaded` / `agreementUploaded` | Upload complete |
| `modelViewed` | Financial Model tab opened |
| `investorAdded` / `investorDocUploaded` | Investor created / document uploaded |
| `capitalizationViewed` | Capitalization tab opened |
| `producerPoolCreated` | Pool created |
| `dealRoomCreated` / `dealRoomViewed` / `dealRoomLinkCopied` / `dealRoomDeactivated` / `dealRoomUpdated` | Deal room lifecycle |

### Storage Layout

```
productions/{userId}/{productionId}/
  artwork
  operating-agreement.pdf
  instruction-letter.pdf
  member-signature-page.pdf
  subscription-agreement.pdf
  investors/{investorId}/
    distributed/instruction-letter.pdf
    distributed/signature-page.pdf
    distributed/subscription-agreement.pdf
    signed/signature-page.pdf
    signed/subscription-agreement.pdf
    executed/signature-page.pdf
    executed/subscription-agreement.pdf
```

### Industry Benchmarks

**Capitalization:** Small straight play $2–5M; Mid-size musical $8–12M; Large musical $12–18M; Mega-musical $18M+. Hadestown: $11.5M.

**Weekly Nut:** Small show $300–450K; Mid-size musical $500–700K; Large musical (post-2022) $700K–$1.2M. Theater rent is in the nut — do not add a separate house % for the flat component.

**Royalties (fixed %):** Author 4.5%, Composer 3.0%, Lyricist 2.25%, Director 2.0%, Choreographer 1.5%, each designer 0.5%, Production company 1.0%. Total: ~15–18%.

**Royalty Pool method:** `royaltyPoolPercentage` is % of **adjusted gross** (14–18% realistic). The "40% royalty pool" in industry literature = 40% of **weekly net operating profit** — a different calculation not implemented here.

**Post-recoup split standard:** 50% investors (LP), 50% producers (GP). GP carve (typically 10%) comes out of the investor pool.

**Recoupment statistics:** Only 20–25% of Broadway musicals fully recoup. Successful recoupment: typically 7–18 months. Hamilton, Book of Mormon, Hadestown: exceptional outliers with 500–1000%+ returns.

**Hadestown validation (calibrated model):** 947 seats, 93% occ, $155 ATP, 10% discount at $90, 2.5% CC, 6% house, 14% royalties, $25K running offset, $530K nut, 1.5% GP fee → **$1.05M weekly gross** ✓, **57% breakeven** ✓, **~37 weeks to recoup** ✓.

### Common Pitfalls

**Routing / Build:**
- Do not add `"use client"` to `app/(app)/productions/view/page.tsx` — breaks static generation
- Do not import Firebase directly in server components — guard with `typeof window`
- `/deal-room` is outside `(app)/` by design — do not move it inside

**Forms:**
- Only one `useForm()` instance for deal inputs — it lives in `ProductionHubClient`
- Section components must use `<Controller>` with the `control` prop, not local state
- `totalCapitalization ÷ unitPrice` auto-computes `units` via `useEffect` + `setValue` in `ProductionHubClient` — do not replicate in section components
- Inline edit inputs use `onBlur` to cancel on focus loss. Save button must use `onMouseDown={e => e.preventDefault()}` to prevent blur before `onSubmit`

**Financial Model:**
- `calculateRoyalties()` returns `{ totalRoyalties, breakdown }` — destructure with alias if needed
- `weeklyOfficeCharge` is kept for Firestore compat but **not used in any calculation** — it is included in `weeklyNut`
- ATP on the Financial Model tab is read-only (locked to deal inputs). Only the Scenarios tab has independent ATP inputs
- `DealInputs.investors` is always `[]` in Firestore — do NOT read it from the form to drive investor returns

**Waterfall Phase:**
- **Known inconsistency:** `calculateWeeklyResult` gates effective investor split using `hasProfitSharing`, but `waterfallPhase.ts` derives phase from `postRecoupInvestorSplit < 1.0` regardless of the toggle. The phase badge can show "Profit Sharing" while calculations give investors nothing if the toggle is off. Preserve this behavior.
- `capitalReturned = MIN(totalInvestorDistributions, cap)` — never exceeds capitalization
- `profitDistributions = MAX(0, totalInvestorDistributions − cap)` — only non-zero post-recoupment

**Firestore:**
- Deal inputs saved under fixed document ID `"primary"` within `dealInputs` subcollection
- Always call `stripUndefined()` before `setDoc`
- Zustand persist key changed from `"broadway-deal-draft"` to `"deal-builder-ui"` — old key is defunct
- Deal room documents are in the **top-level** `dealRooms` collection, not a subcollection of productions
- `deleteProduction()` only deletes the root production document — subcollections and Storage files are not cascade-deleted (known gap)

**UI:**
- Recharts Tooltip `formatter` props use `unknown` types — cast with `Number(v)` and `String(name)`
- `InfoTip` in `shared/FormFields.tsx` wraps its own `TooltipProvider`; `InfoTip` in `ProductionHubClient.tsx` relies on parent provider
- JSX string literals do not interpret `\u` escape sequences — use actual Unicode characters (e.g., `—` not `\u2014`)
- Sensitivity grid hover tooltip: always render at fixed height — never conditionally mount/unmount

**Google OAuth / Custom Domain:**
- Both must be configured for Google sign-in on `overridebroadway.com`:
  1. Firebase Console → Authentication → Settings → Authorized domains: `overridebroadway.com`
  2. Google Cloud Console → OAuth 2.0 Client ID → Authorized JavaScript origins: `https://overridebroadway.com`
