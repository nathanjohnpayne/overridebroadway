# Override — Product Requirements Document

**Version:** 1.0
**Date:** 2026-03-31
**Author:** Nathan Payne
**Status:** Living document

---

## 1. Product Overview

### 1.1 What Override Is

Override is the financial operating platform for Broadway producers. It provides a vertically integrated workspace that handles the full lifecycle of a Broadway production's financial operations—from structuring a capitalization, modeling deal economics, managing an investor cap table, tracking recoupment, and sharing deal terms with prospective backers through a secure, public-facing deal room.

The product's name refers to the producer's percentage taken off the top before investor distributions—an industry term that signals insider knowledge and producer-centric authority.

### 1.2 Tagline

"You run the show. Override runs the money."

### 1.3 Descriptive Subtitle

Override is the financial operating platform for Broadway producers—from modeling your capitalization to managing investors, tracking recoupment, and distributing returns.

### 1.4 Target Users

The primary user is a Broadway producer (general partner) who is capitalizing a new production and needs to model deal economics, manage investors, and communicate deal terms to prospective backers. Secondary users include co-producers managing their own investor pools and prospective investors who view deal rooms (read-only, no account required).

### 1.5 Go-to-Market Strategy

Override uses a focused wedge strategy: the financial modeling engine is the entry point to establish product-market fit. Once a producer is modeling deals inside Override, the platform expands into capitalization management, investor CRM, document workflows, and investor reporting. The wedge—real-time scenario modeling with industry-standard defaults—delivers immediate value and differentiates Override from spreadsheets.

---

## 2. Product Architecture

### 2.1 Technology Stack

Override is a statically exported Next.js 16 application (App Router, `output: 'export'`) hosted on Firebase Hosting at **overridebroadway.com**. There is no backend server and no Cloud Functions. All business logic runs client-side; Firebase provides authentication, database, file storage, and analytics.

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, static export) |
| Language | TypeScript 5 (strict mode) |
| UI | Tailwind CSS v4, shadcn/ui (Radix primitives), Lucide icons |
| Charts | Recharts 3 |
| Forms | react-hook-form (single `useForm<DealInputs>()` instance per production) |
| Client state | Zustand with persist middleware (UI state only; deal data lives in Firestore) |
| Notifications | Sonner (toast system) |
| Backend services | Firebase 12—Authentication, Cloud Firestore, Firebase Storage, Firebase Analytics |
| Hosting | Firebase Hosting (custom domain: overridebroadway.com) |
| Deploy auth | 1Password CLI → short-lived impersonated credentials → `firebase-deployer` service account |

### 2.2 Route Architecture

Override uses Next.js route groups to separate authenticated and public routes:

**Public routes (no auth required):**

- `/` — Marketing landing page
- `/login` — Email/password + Google OAuth sign-in (route group `(auth)`)
- `/signup` — Registration with display name, email, password, Google OAuth (route group `(auth)`)
- `/deal-room?token=<id>` — Investor-facing deal room (outside `(app)/` group, intentionally unauthenticated)

**Authenticated routes (auth guard in layout):**

- `/dashboard` — Production portfolio grid; `?view=investments` toggles to "My Investments" mode
- `/productions/view?id=<productionId>` — Production Hub (the core workspace)

### 2.3 Firestore Data Model

```
users/{uid}                               # User profile (email, displayName, photoURL)
productions/{productionId}                # Production metadata (name, subtitle, venue, status, artwork, docs)
  dealInputs/primary                      # Single deal-inputs document per production (fixed ID "primary")
  investors/{investorId}                  # CapitalizationInvestor records
  producerPools/{poolId}                  # ProducerPool records (groups of investors)
  scenarios/{scenarioId}                  # Saved custom scenarios
dealRooms/{token}                         # Top-level collection; document ID = share token (UUID v4)
```

**Security model:** Productions and all subcollections are scoped to `request.auth.uid == resource.data.userId`. Deal rooms are publicly readable when `isActive == true`; writes require ownership. The share token (Firestore document ID) is the sole credential for investor access—knowing the token grants read access. No individual investor data is stored in deal room documents.

---

## 3. Feature Specifications

### 3.1 Authentication

**Providers:** Email/password and Google OAuth (via Firebase Authentication).

**User lifecycle:** On sign-in or sign-up, an `ensureUserDoc()` function creates or merges a `users/{uid}` document in Firestore with the user's email, display name, photo URL, and a server timestamp. The `AuthContext` React context provides `user`, `loading`, `signIn`, `signUp`, `signInWithGoogle`, and `signOut` to all authenticated routes. The `(app)/layout.tsx` acts as an auth guard—unauthenticated users are redirected to `/login`.

### 3.2 Dashboard

The dashboard is the home screen after login. It displays a grid of the user's productions, each rendered as a card with artwork (blurred letterbox banner), name, subtitle, venue, status badge, and last-updated timestamp.

**Production statuses:** `development`, `preview`, `open`, `closed`. Each has a distinct color-coded badge.

**Create production:** A dialog collects name (required), subtitle, venue, and status, then creates a Firestore document and navigates to the Production Hub.

**Delete production:** Confirmation dialog; deletes the Firestore document.

**My Investments view:** Toggled via `?view=investments` query parameter. Filters the production list to show only productions where the current user has flagged an investor record as `isPersonalInvestment: true`.

### 3.3 Production Hub

The Production Hub is the core workspace for a single production. It is accessed at `/productions/view?id=<productionId>` and is organized into tabbed sections.

**Tabs:**

1. **Overview** — Production metadata, artwork upload, document uploads (instruction letter, member signature page, subscription agreement, operating agreement), show URL, status management.
2. **Capitalization** — Investor cap table, producer pools, and ownership rollup (see §3.7).
3. **Deal Inputs** — The deal-structuring workspace, internally called "Deal Builder" (see §3.4).
4. **Financial Model** — Live model output with nested sub-tabs: Cash Flow chart, Weekly Table, Investor Returns, and Waterfall visualization (see §3.5, §3.6).
5. **Scenarios** — Editable Bear/Base/Bull scenario parameters, scenario comparison table, multi-scenario cumulative P&L chart, and sensitivity grid (see §3.5.6).
6. **Deal Room** — Producer-facing configuration for the investor-facing deal room (see §3.8).

The Production Hub owns the single `useForm<DealInputs>()` instance. No section component may create a second form instance—this is a structural invariant enforced by repo rules.

### 3.4 Deal Inputs (Deal Builder)

The Deal Inputs tab (internally named "Deal Builder" in the codebase) is a two-pane workspace for configuring a production's deal structure.

**Left pane:** Section navigation (guided stepper or direct tab bar) plus the active section form.

**Right pane:** Live Outcome Panel (sticky, desktop only). On mobile (<lg breakpoint), it collapses to a horizontal strip above the inputs.

**Navigation modes:**

- **Guided mode** — A linear stepper that advances through sections in order. Sections are gated by completion checks. Guided mode state is persisted in Zustand (`dealStore.ts`) across page refreshes.
- **Direct mode** — Tab-based navigation; any section can be accessed in any order.

**Sections (five total):**

1. **Capitalization** — Total capitalization, units, unit price. Completion requires `totalCapitalization > 0` and `unitPrice > 0`.
2. **Weekly Economics** — Weekly nut (operating costs), performances per week, estimated run length, preview weeks, opening week. Completion requires `weeklyNut > 0`, `performances > 0`, `estimatedWeeks > 0`.
3. **Revenue Drivers** — Seat capacity, average ticket price, discount rate, discounted ticket price, credit card fee rate, house percentage, optional house profits threshold and split above. Completion requires `capacity > 0` and `avgTicketPrice > 0`.
4. **Royalties & Fees** — Individual royalty rates for 11 creative participants (author, music, lyricist, director, choreographer, set designer, costume designer, lighting designer, sound designer, star participation, production company). Royalty base (adjusted gross or net). Royalty pool type (fixed percentages or pooled). Optional royalty pool percentage. Weekly office charge. GP management fee rate. GP share of investor pool. Optional GP flat weekly payment and GP flat profit percentage. Completion requires at least one royalty rate > 0.
5. **Waterfall & Fees** — Waterfall type (recoup-first or share-from-dollar-one). Profit sharing toggle (`hasProfitSharing`). Post-recoup investor split percentage. Running royalty offset toggle and optional fixed weekly offset amount. Completion requires `waterfallType` defined and `postRecoupInvestorSplit > 0`.

**Section completion status:** Each section reports `complete`, `partial`, or `empty` based on its `isComplete()` function and required-field checks, visualized as status dots in the navigation.

**Autosave:** Form values are debounced at 1.5 seconds and auto-saved to Firestore. A manual "Save Deal Inputs" button is also available.

**Default values:** `DEFAULT_DEAL_INPUTS` provides industry-standard Broadway defaults: $2M capitalization, 100 units at $20K each, $450K weekly nut, 1,200-seat capacity, 8 performances/week, $125 average ticket price, 20% discount rate, 3% credit card fees, 6% house percentage, standard APC royalty rates (4.5% author, 3% composer, 2.25% lyricist, 2% director, 1.5% choreographer, 0.5% each for four designers, 1% production company), adjusted gross royalty base, fixed royalty pool type, 50/50 post-recoup investor/creative split, and a 52-week estimated run with 4 preview weeks.

### 3.5 Financial Model Engine

The financial model is a pure TypeScript calculation engine (`src/lib/model/`) with zero React or Firebase dependencies. It is deterministic and runs entirely client-side.

#### 3.5.0 Financial Model Tab Structure

The Financial Model tab contains nested sub-tabs for different views of the model output:

- **Cash Flow** — Cumulative profit chart with a recoupment reference line.
- **Weekly Table** — Per-week table of gross, deductions, operating profit, and distributions.
- **Investor Returns** — Per-investor return calculations (ROI, multiple, recoup week) based on cap table entries.
- **Waterfall** — Revenue flow visualization and recoupment tracking (see §3.6).

Producers can adjust occupancy rate directly within the Financial Model tab to see live model recalculation.

#### 3.5.1 Weekly Calculation Pipeline

For each week, the engine computes a `WeeklyResult` through this pipeline:

1. **Gross Box Office** = capacity × performances × occupancy rate × blended ticket price (full-price and discounted mix).
2. **Credit Card Fees** = gross × credit card fee rate.
3. **House Deduction** = gross × house percentage + optional above-threshold split.
4. **Adjusted Gross** = gross − credit card fees − house deduction.
5. **Royalties** = computed against adjusted gross (or net, depending on `royaltyBase`). In pool mode, total pool = adjusted gross × pool percentage, distributed proportionally by rate weights. In fixed mode, each participant receives their rate × base. A running royalty offset reduces the total royalty obligation by a fixed weekly dollar amount during recoupment only.
6. **Net Box Office** = adjusted gross − royalties.
7. **Profit Before Fees** = net box office − weekly nut.
8. **GP Management Fee** = profit before fees × GP fee rate (only on positive profit).
9. **GP Flat Overrides** = optional fixed weekly payment + optional % of net profit, applied before waterfall.
10. **Operating Profit** = profit after all GP deductions. This is the distributable amount entering the waterfall.
11. **Waterfall Allocation** (see §3.5.2).
12. **Cumulative Profit** tracking and recoupment percentage.

#### 3.5.2 Waterfall Types

**Recoup-First:** 100% of weekly operating profit goes to investor recoupment until full capitalization is returned. After the recoupment threshold is crossed (which may happen mid-week), post-recoup profit sharing activates: the investor pool receives `postRecoupInvestorSplit` of distributable profit (minus the GP carve), and creatives receive the remainder.

**Share From Dollar One:** Post-recoup profit sharing applies from week one. Investor distributions count simultaneously toward recoupment tracking.

In both types, the GP carve is extracted from the investor pool (not the creative pool). The effective split is: investor pool × (1 − GP carve) goes to LP investors; investor pool × GP carve goes to the GP; the remainder (1 − investor pool) goes to creative participants.

#### 3.5.3 Investor Returns

For each investor in `DealInputs.investors[]`, the engine computes per-investor returns: pool percentage (amount / total capitalization), recoupment allocation, post-recoup distributions, total received, ROI, cash-on-cash multiple, and individual recoup week.

**Important invariant:** `DealInputs.investors` is always `[]` in Firestore. Investors for the model are bridged from the `useInvestors()` hook (the cap table) at the model computation site. This prevents stale investor data in the deal form.

#### 3.5.4 IRR Calculation

The engine computes an approximate annualized IRR using Newton-Raphson iteration on weekly cash flows, converting the weekly internal rate to an annual rate via `(1 + weeklyRate)^52 − 1`.

#### 3.5.5 Breakeven Occupancy

A binary search between 0% and 150% occupancy finds the rate at which weekly operating profit equals zero.

#### 3.5.6 Scenarios

Three default scenarios are provided:

| Scenario | Occupancy | Avg Ticket Price | Estimated Weeks |
|---|---|---|---|
| Bear | 60% | $100 | 20 |
| Base | 75% | $115 | 36 |
| Bull | 90% | $135 | 52 |

`runScenario()` overrides the deal's average ticket price and estimated weeks with the scenario's values, then runs the full weekly calculation pipeline.

**Scenarios tab UI:** The Scenarios tab provides a dedicated workspace where producers can modify the Bear, Base, and Bull scenario parameters (occupancy rate, average ticket price, estimated weeks) and immediately see the impact. The tab includes:

- **Editable scenario parameters** — Producers can adjust each scenario's occupancy, ATP, and run length. Changes re-run the model in real time.
- **Scenario comparison table** — A side-by-side table showing key metrics across all three scenarios: occupancy, weeks to recoup, total gross box office, total operating profit, investor distributions, investor pool ROI, and cash-on-cash multiple.
- **Multi-scenario cumulative P&L chart** — A line chart overlaying the cumulative profit curves of Bear, Base, and Bull scenarios.

**Custom scenario persistence:** The Firestore layer includes `saveScenario()`, `getScenarios()`, and `deleteScenario()` operations, but custom scenario creation and management is not currently exposed in the UI. Producers can modify the three default scenarios but cannot save additional custom scenarios.

#### 3.5.7 Sensitivity Grid

`generateSensitivityGrid()` runs `runScenario()` across a matrix of occupancy rates × week counts. Each cell contains recoup week, recoup achieved status, investor distributions, investor multiple (distributions / capitalization), investor ROI, total gross, and total operating profit. All values are computed in the engine—never derived in the UI layer.

### 3.6 Waterfall Visualization

The Waterfall is a sub-tab within the Financial Model tab (not a top-level primary tab). It provides three visualization sections:

**Section A — Weekly Revenue Flow:** A vertical flow diagram showing the revenue cascade from gross box office through each deduction (CC fees + house, royalties, weekly nut) to operating profit, then through GP fees and into investor/creative distributions. Users toggle between "Pre-Recoup" and "Post-Recoup" views, each showing a representative week. Every row includes an info tooltip explaining the deduction in Broadway-specific terms.

**Section B — Recoupment Progress:** A progress bar showing cumulative profit against the capitalization target. Stat chips display the capitalization target, recoup week, capital returned (capped at capitalization), and profit distributions (excess beyond capitalization). If recoupment is not achieved, a remaining capital balance callout appears.

**Section C — Post-Recoup Profit Distribution:** A segmented bar chart showing the per-dollar split of post-recoup profit among LP investors, GP carve, and creative participants. Run-total distribution amounts are shown below each segment. Context notes explain when the show does not recoup or when all distributions represent return of capital.

**Waterfall Phase State:** A pure function (`deriveWaterfallPhaseState`) derives the current phase from model output and deal configuration. The four phases are:

1. **PRE_REVENUE** — No week generates positive operating profit.
2. **RECOUPMENT** — Profit exists but cumulative < capitalization.
3. **POST_RECOUP_PROFIT_SHARING** — Recouped and `postRecoupInvestorSplit < 1.0`.
4. **CLOSED** — Recouped and `postRecoupInvestorSplit === 1.0` (no creative pool).

Phase derivation uses config ratios, never the `hasProfitSharing` toggle—the toggle controls whether `postRecoupInvestorSplit` is applied, but the phase state reads the economic condition directly.

### 3.7 Capitalization Management

#### 3.7.1 Cap Table (Investors)

Each production maintains a list of `CapitalizationInvestor` records in a Firestore subcollection with real-time `onSnapshot` listeners. Each investor record contains:

- **Identity:** Name, email, phone, address.
- **Investment:** Shares, amount committed, amount funded, ownership percentage (computed as committed / total capitalization on save).
- **Status lifecycle:** `invited` → `docs_sent` → `signed` → `funded` → `admitted`. Color-coded status badges reflect each stage.
- **Personal investment flag:** `isPersonalInvestment` lets a producer mark their own investment for dashboard filtering.
- **Producer pool assignment:** Each investor belongs to a producer pool.
- **Per-investor documents (7 slots):** Distributed instruction letter, distributed signature page, distributed subscription agreement, signed signature page, signed subscription agreement, executed (countersigned) signature page, executed subscription agreement. All PDFs, uploaded to Firebase Storage with progress tracking.

The **InvestorSheet** is a slide-out panel for creating and editing investor records. Ownership percentage is auto-computed from amount committed and displayed as a read-only field.

#### 3.7.2 Producer Pools

Producer pools group investors under named allocations (e.g., "Direct Investors," "Lead Producer Pool"). Each pool has an optional allocation limit. The system auto-creates a "Direct Investors" default pool via a lazy migration (`ensureDefaultPool`), and legacy investors without a pool assignment are auto-migrated to it (`assignInvestorsToDefaultPool`).

#### 3.7.3 Ownership Rollup

`computeOwnershipRollup()` aggregates investors by pool, computing per-pool totals (committed, funded, ownership percentage, investor count), plus global totals and remaining raise amount.

#### 3.7.4 Producer Ledger

The **ProducerLedger** is a hierarchical table view: expandable pool rows with nested investor rows. Each row shows name, status badge, committed amount, funded amount, and ownership percentage. Actions include add/edit/delete for both pools and investors.

### 3.8 Deal Room

The Deal Room is Override's investor-facing feature—a public, read-only page where prospective investors can review a production's financial model and deal terms without creating an account.

#### 3.8.1 Producer-Side Configuration (DealRoomSetup)

Producers access the Deal Room tab in the Production Hub to:

1. **Create a deal room** — Snapshots the current `DealInputs` and production metadata into a `dealRooms/{token}` document. The Firestore document ID serves as the share token.
2. **Configure visibility** — Toggle which sections investors can see: financial scenarios, revenue waterfall, week-by-week breakdown, capitalization structure, and documents. All default to off except financial scenarios and waterfall.
3. **Add a producer note** — Free-form text (max 500 characters) displayed to investors.
4. **Copy the share link** — The URL format is `overridebroadway.com/deal-room?token=<id>`.
5. **Update snapshot** — Re-snapshots current deal inputs and production metadata without changing the token. Prevents accidental disclosure of draft changes.
6. **Deactivate/reactivate** — Deactivation sets `isActive: false`, immediately blocking read access via Firestore security rules.

**Validation gate:** Capitalization and capacity must both be > 0 before a deal room can be created.

#### 3.8.2 Investor-Side View (DealRoomView)

The investor-facing page at `/deal-room?token=<id>` renders a professional, branded view:

- **Header:** Production name, subtitle, venue, status badge, artwork, share date, and link to production website.
- **Producer note** (if provided).
- **Deal Structure:** Eight key-term cards—total capitalization, unit price, weekly nut, house capacity, average ticket price, waterfall type, post-recoup investor pool, and breakeven occupancy.
- **Financial Scenarios** (if enabled): Bear/Base/Bull scenario cards, each showing total gross, investor multiple, recoup week, breakeven occupancy, total investor distributions, and approximate IRR.
- **Revenue Waterfall** (if enabled): The same `WaterfallFlow` component used in the producer view, running against the snapshotted deal inputs.
- **Week-by-Week Breakdown** (if enabled): Per-week table showing occupancy, gross, operating profit, investor distributions, and recoupment percentage (first 20 open weeks of base scenario).
- **Capitalization Structure** (if enabled): Total cap, unit price, and unit count—aggregate only, no individual investor data.
- **Documents** (if enabled): Links to uploaded PDFs (instruction letter, signature page, subscription agreement, operating agreement).
- **Disclaimer:** Standard investment risk disclosures, including the statistic that only 20–25% of Broadway musicals fully recoup their capitalization.

The financial model is computed client-side by running `runScenario()` against the snapshotted `DealInputs`—identical to the producer's own model. No individual investor data is ever stored in or exposed through the deal room.

### 3.9 Live Outcome Panel

The Live Outcome Panel is a sticky sidebar card (desktop) or horizontal strip (mobile) that updates in real time as the producer types in the Deal Builder. It displays:

- Weekly gross and weekly profit for the first open (non-preview) week.
- Breakeven occupancy.
- Recoup status—three cases: (1) full recoup with week number and investor multiple, (2) partial recoup with capital returned and recovery percentage, (3) no capital recovery.
- Risk band: Low (breakeven < 70%), Medium (70–90%), High (> 90%), No Breakeven.
- Waterfall phase badge.

The panel is purely presentational—all values come from `modelOutput`, with zero business logic in the component.

### 3.10 Document Management

Override supports two tiers of document storage:

**Production-level documents (4 types):** Investor instruction letter, member signature page, subscription agreement, operating agreement. Uploaded as PDFs to Firebase Storage at `productions/{userId}/{productionId}/{docType}.pdf`. Displayed in the Overview tab and optionally shared via the deal room.

**Per-investor documents (7 slots across 3 categories):**

- Distributed to investor: instruction letter, signature page, subscription agreement.
- Signed by investor: signature page, subscription agreement.
- Fully executed (countersigned): signature page, subscription agreement.

Stored at `productions/{userId}/{productionId}/investors/{investorId}/{category}/{docType}.pdf`. Managed through the InvestorSheet.

All uploads enforce PDF-only (except artwork, which accepts any image type), with a 20MB limit for documents and 5MB for artwork. Upload progress is tracked and displayed.

### 3.11 Analytics

Firebase Analytics tracks typed events across the product lifecycle: page views, sign-ups and logins (by method), production creation, deal inputs saves, scenario runs, sensitivity grid views, artwork and document uploads, model views, investor additions, investor document uploads, capitalization views, producer pool creation, and all deal room lifecycle events (creation, viewing, link copying, updates, deactivation).

### 3.12 Update Checker

The `UpdateChecker` component polls `/_build_id.txt` in production to detect new deployments. When a new build ID is detected, it prompts the user to refresh—ensuring they always run the latest version of the financial engine.

---

## 4. Data Types Reference

### 4.1 DealInputs

The central data type for a production's deal structure. Fields are organized into seven groups:

- **Capitalization:** `totalCapitalization`, `units`, `unitPrice`, `investors[]` (always `[]` in Firestore).
- **Weekly operations:** `weeklyNut`, `capacity`, `performances`, `avgTicketPrice`, `discountRate`, `discountedTicketPrice`.
- **Revenue splits:** `creditCardFeeRate`, `housePercentage`, optional `houseProfitsThreshold` and `houseProfitsSplitAbove`.
- **Royalties:** `royalties` (11 participant rates), `royaltyBase`, `royaltyPoolType`, optional `royaltyPoolPercentage`.
- **Office & fees:** `weeklyOfficeCharge`, `gpFeeRate`, `gpShareOfInvestorPool`, optional `gpFlatWeekly` and `gpFlatProfitPercent`.
- **Waterfall:** `waterfallType`, `hasProfitSharing`, `postRecoupInvestorSplit`, `runningRoyaltyOffset`, optional `royaltyOffsetAmount`.
- **Run parameters:** `estimatedWeeks`, `previewWeeks`, `openingWeek`.

### 4.2 Production

Metadata for a production: `id`, `userId`, `name`, `subtitle`, `venue`, `status` (development/preview/open/closed), `showUrl`, `artworkUrl`, four document URLs with display names, `hasPersonalInvestment`, `dealRoomEnabled`, `dealRoomToken`, `createdAt`, `updatedAt`.

### 4.3 CapitalizationInvestor

An investor in the cap table: identity fields, investment amounts, ownership percentage, status lifecycle, personal investment flag, producer pool assignment, seven document URL slots, and timestamps.

### 4.4 ProducerPool

A named grouping of investors: `id`, `productionId`, `ownerUserId`, `name`, optional `allocationLimit`, timestamps.

### 4.5 DealRoom and DealRoomConfig

A snapshot of deal economics shared with investors. Contains production metadata snapshot, deal inputs snapshot, producer-controlled display configuration (six toggles plus a producer note), active/inactive state, and optional expiry date. The config controls visibility of financial scenarios, waterfall, weekly breakdown, capitalization structure, and documents.

### 4.6 ModelOutput

The output of `runScenario()`: deal inputs used, occupancy rate, array of `WeeklyResult`s, recoup week, aggregate totals (gross, royalties, operating profit, investor distributions), per-investor returns array, approximate IRR, and weekly breakeven occupancy.

### 4.7 SensitivityGrid

A 2D array of `SensitivityCell`s, each containing occupancy rate, weeks, recoup timing, investor distributions, investor multiple, investor ROI, total gross, and total operating profit. All values engine-computed.

---

## 5. Security Model

### 5.1 Authentication

Firebase Authentication with email/password and Google OAuth. All authenticated routes are guarded by the `(app)/layout.tsx` auth check.

### 5.2 Firestore Security Rules

- **Users:** Each user can only read/write their own `users/{uid}` document.
- **Productions:** All CRUD restricted to `request.auth.uid == resource.data.userId`.
- **Subcollections** (dealInputs, scenarios, investors, producerPools): Access requires the parent production's `userId` to match the requesting user's UID (verified via `get()` on the parent document).
- **Deal Rooms:** Publicly readable when `isActive == true`. Creates require the `ownedByUserId` to match the requesting user. Updates and deletes require ownership.

### 5.3 Storage Security

Firebase Storage rules (defined in `storage.rules`) restrict file access. Document uploads are scoped to `productions/{userId}/{productionId}/`.

### 5.4 Data Isolation

No individual investor data is ever stored in deal room documents. The deal room contains only aggregate deal economics (the `DealInputs` snapshot). The cap table, investor identities, investment amounts, and document URLs are never exposed to the public deal room route.

### 5.5 Firestore Write Hygiene

`stripUndefined()` is called before every Firestore write. Firestore rejects documents with `undefined` values, so this utility recursively strips them while preserving Firestore sentinel objects like `serverTimestamp()`.

---

## 6. Design Principles

### 6.1 Industry Authority

Override's UI, terminology, and defaults are calibrated for Broadway producers. Royalty categories match APC (Approved Production Contract) standard roles. Default rates reflect typical Broadway deal structures. The waterfall model implements the two dominant Broadway distribution patterns (recoup-first and share-from-dollar-one). Risk labels reference industry benchmarks (the 20–25% recoupment rate for Broadway musicals).

### 6.2 Real-Time Feedback

The Live Outcome Panel and autosave system ensure producers see the financial impact of every input change immediately. The model recomputes on every keystroke (debounced for saves), providing a "what-if" experience that replaces static spreadsheets.

### 6.3 Separation of Concerns

The financial engine (`src/lib/model/`) is pure TypeScript with no React or Firebase dependencies. It can be tested, reused, and reasoned about independently. The UI layer is purely presentational—it reads from `ModelOutput` and never re-derives financial calculations. This separation is enforced by structural conventions: the model directory contains only pure functions, and the UI never duplicates engine logic.

### 6.4 Progressive Disclosure

The guided mode in the Deal Builder lets first-time users walk through deal configuration step by step, while direct mode gives experienced users immediate access to any section. Section completion indicators provide at-a-glance status without requiring the user to navigate to each section.

### 6.5 Snapshot-Based Sharing

Deal rooms use a snapshot model: the deal inputs and production metadata are captured at creation time. Changes to the producer's deal inputs do not automatically propagate—the producer must explicitly click "Update Snapshot." This prevents accidental disclosure of draft changes and gives producers full control over what investors see.

---

## 7. Structural Invariants

These constraints are enforced by CI scripts and repo rules:

1. **One `useForm()` instance.** The `useForm<DealInputs>()` call lives in `ProductionHubClient`. No section component may create a second form instance.
2. **`DealInputs.investors` is always `[]` in Firestore.** Investors are bridged from `useInvestors()` at the model computation site.
3. **`stripUndefined()` before every Firestore write.**
4. **No `"use client"` on server wrappers.** `app/(app)/productions/view/page.tsx` remains a server component. Client rendering uses the `*DynamicLoader` pattern.
5. **No Cloud Functions.** The app is a pure static export. Firestore security rules handle access control.
6. **Build output goes to `out/`, never `dist/`.** Never edit `out/` directly; run `npm run build` to regenerate.
7. **No committed secrets.** Firebase config and credentials use `.env.local` (gitignored) and 1Password-backed `op://` references.

---

## 8. Future Roadmap (Planned)

Based on the product's stated scope and the memory context, the following capabilities are planned but not yet implemented:

- **Lead CRM** — Investor pipeline management and outreach tracking.
- **Signing workflow** — Digital signature collection integrated with the document management system.
- **Investor reporting** — Post-investment reporting dashboards for active productions.
- **Payments and distributions** — Actual distribution tracking and payment processing.
- **Multi-production portfolio views** — Cross-production analytics for producers managing multiple shows.

---

## 9. Environment and Deployment

### 9.1 Environments

| Environment | Firebase Project | URL |
|---|---|---|
| Production | `soyouthinkyouwant` | overridebroadway.com |

There is no staging environment. All deploys go directly to production.

### 9.2 Build Pipeline

1. **Prebuild** (`scripts/prebuild.mjs`) — Generates a timestamp-based build ID, writes to `.build_id`.
2. **Build** (`next build`) — Static export to `out/`; injects `NEXT_PUBLIC_BUILD_ID`.
3. **Postbuild** (`scripts/postbuild.mjs`) — Copies `.build_id` to `out/_build_id.txt`.

### 9.3 Deployment

All deploys use `op-firebase-deploy` for keyless, non-interactive service account impersonation via 1Password CLI. The `firebase-deployer@soyouthinkyouwant.iam.gserviceaccount.com` service account is the deploy identity. Source credentials are resolved in order: `GOOGLE_APPLICATION_CREDENTIALS`, Firebase vault SA key, shared 1Password GCP ADC credential, then local ADC file.

### 9.4 Post-Deployment Verification

1. Open overridebroadway.com in an incognito window.
2. Sign in with email or Google OAuth—confirm authentication works.
3. Navigate to Dashboard—confirm productions load.
4. Open a production and load the Deal Builder—confirm deal inputs and model render.
5. Open a Deal Room via share link—confirm public access with no login.
6. Check browser console for errors.
7. Confirm `UpdateChecker` polling detects the new deploy.
