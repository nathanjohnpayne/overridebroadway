# Override

Override is the financial operating platform for Broadway producers—from modeling your capitalization to managing investors, tracking recoupment, and distributing returns.

## Tech Stack

- **Framework**: Next.js 16.1.6 (App Router, `output: 'export'` for Firebase Hosting)
- **Language**: TypeScript 5 (strict)
- **UI**: Tailwind CSS v4 + shadcn/ui (Radix primitives) + Lucide icons
- **Charts**: Recharts 3
- **Forms**: react-hook-form (values managed via Controller + watch; zod is installed but not used for form validation)
- **State**: Zustand with persist middleware (guided mode UI state across page refreshes)
- **Toasts**: Sonner (used for success/error feedback across auth, save, upload, and deal room flows)
- **Backend**: Firebase 12—Auth, Firestore, Storage, Analytics
- **Hosting**: Firebase Hosting (static export)
- **Domain**: overridebroadway.com (custom domain via Firebase Hosting)

## Project Structure

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
│       ├── button, card, dialog, dropdown-menu, input, label
│       ├── select, sheet, skeleton, separator, switch, table
│       ├── tabs, textarea, tooltip, popover, progress, badge
│       ├── form, sonner                                     
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

---

## Key Architectural Decisions

### Static Export + Dynamic Routes
Firebase Hosting serves static files, but production IDs are Firestore UUIDs unknown at build time.

**Solution**: The production hub lives at `/productions/view` (not `/productions/[id]`). The production ID is passed via `?id=` query param and read at runtime with `useSearchParams()`. Firebase Hosting's catch-all rewrite sends all unmatched paths to `/index.html`.

The same pattern is used for the Deal Room: `/deal-room?token=<uuid>`. The token IS the Firestore document ID.

Never add `"use client"` to `app/(app)/productions/view/page.tsx`—that breaks `generateStaticParams`. Never use `next/dynamic` with `ssr: false` directly in a server component—use the `ProductionDynamicLoader` / `DealRoomDynamicLoader` client loader pattern.

### Firebase Initialization
The Firebase app is initialized with a placeholder `apiKey` during SSR/prerender (when `typeof window === 'undefined'`) to prevent build failures. Real keys come from `.env.local` at runtime.

### Auth Persistence
`browserLocalPersistence` is set on the Firebase Auth instance to prevent users from being logged out on navigation in the static export context. The `(app)` layout shows a skeleton while `loading || !user` to prevent flash redirects.

The `/deal-room` route lives **outside** the `(app)` route group intentionally—it has no auth requirement. Investors access it via a private token URL with no login.

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

Security rules:
- Productions and subcollections: `request.auth.uid == resource.data.userId`
- Deal rooms: public read when `isActive == true`; writes require ownership

Composite indexes (`firestore.indexes.json`):
- `productions`: userId ASC + updatedAt DESC; userId ASC + createdAt DESC; userId ASC + status ASC + createdAt DESC
- `scenarios`: productionId ASC + createdAt DESC

### Firestore `undefined` Safety
Firestore rejects documents containing `undefined` values. All saves go through `stripUndefined<T>()` in `firestore.ts`, which recursively removes `undefined` fields while preserving Firestore sentinel values (detected via `_methodName` duck-typing).

### Form State Ownership
There is **one** `useForm<DealInputs>()` instance—it lives in `ProductionHubClient`. All section components and `DealBuilder` receive `control`, `watch`, `setValue`, `getValues`, `handleSubmit` as props. No section component creates its own form instance. This prevents state sync issues and keeps Firestore as the single source of truth.

### Live Model Updates
`ProductionHubClient` calls `watch()` on all form values. The model is recomputed as `runScenario({ ...dealInputs, ...liveFormValues }, scenario)` so any edit reflects immediately in the Financial Model tab and LiveOutcomePanel without requiring a save.

**ATP is always locked to the deal input value** on the Financial Model tab—it is a read-only display, not an editable field. The Scenarios tab has independent ATP inputs for what-if comparison.

### Investor Bridge: CapitalizationInvestor → Financial Model
`CapitalizationInvestor[]` records (from `useInvestors`) are bridged into the simplified `Investor[]` type before `runScenario()` is called. `DealInputs.investors` is a legacy field that is always `[]` in Firestore—it is overridden at computation time:

```typescript
const bridgedInvestors = investors
  .filter((inv) => inv.amountCommitted > 0)
  .map((inv) => ({ id: inv.id, name: inv.name, amount: inv.amountCommitted, units: inv.shares }));
const liveDeal = { ...dealInputs, ...liveFormValues, investors: bridgedInvestors };
```

This means per-investor returns in the Financial Model → Investor Returns tab are always driven by cap table data, not the form field.

### Zustand Store—UI State Only
`useDealStore` (persist key: `"deal-builder-ui"`) tracks **guided mode UI state only**—not deal data. Deal data lives in Firestore via `useDealInputs` + react-hook-form.

```typescript
interface DealBuilderUIStore {
  guidedModeActive: boolean;
  currentSectionIndex: number;
  completedSections: string[];       // section IDs that have passed isComplete()
  activeProductionId: string | null;
}
```

The old `"broadway-deal-draft"` localStorage key is obsolete and can be cleared—the new key is `"deal-builder-ui"`.

---

## Dashboard

`/dashboard`—the authenticated home screen with two view modes controlled by query param.

### View Modes

- **My Productions** (default): Grid of production cards the user owns. Each card shows artwork banner (blurred background effect), title, subtitle, venue, status badge, and timestamps.
- **My Investments** (`?view=investments`): Placeholder view for productions where the user is an investor (feature stub).

The nav bar in `(app)/layout.tsx` has two persistent buttons—"Productions" and "My Investments"—that toggle between these views. The active view is highlighted with a `secondary` variant button.

### Production CRUD

- **Create**: Dialog with name, status, optional subtitle/venue. Creates Firestore document and navigates to production hub.
- **Delete**: Confirmation dialog. Currently deletes only the root production document—subcollections (dealInputs, investors, producerPools, scenarios) and Storage files are **not** cascade-deleted in app code.

### Production Type (production.ts)

```typescript
interface Production {
  id: string;
  userId: string;
  name: string;
  subtitle?: string;
  venue?: string;
  status: ProductionStatus;         // "development" | "preview" | "open" | "closed"
  showUrl?: string;
  artworkUrl?: string;
  // Production-level document URLs
  investorInstructionLetterUrl?: string;
  investorInstructionLetterName?: string;
  memberSignaturePageUrl?: string;
  memberSignaturePageName?: string;
  subscriptionAgreementUrl?: string;
  subscriptionAgreementName?: string;
  operatingAgreementUrl?: string;
  operatingAgreementName?: string;
  // Flags
  hasPersonalInvestment?: boolean;  // true when any investor has isPersonalInvestment=true
  dealRoomEnabled?: boolean;        // true when a deal room is active
  dealRoomToken?: string;           // deal room document ID / share token
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Deal Builder Architecture

The Deal Builder is the content of the **Deal Inputs tab** inside `ProductionHubClient`, rendered as a two-pane workspace.

### Two-Pane Layout

```
┌─────────────────────────────────────┬────────────────┐
│  Left pane (flex-1)                 │  Right pane    │
│  ─ DealBuilderNav (section nav)     │  (w-72, sticky)│
│  ─ Active section form component    │                │
│  ─ Sticky save bar                  │  LiveOutcome   │
│                                     │  Panel         │
└─────────────────────────────────────┴────────────────┘
```

On mobile (`< lg`), the right pane collapses to a horizontal summary strip above the inputs.

### Navigation Modes

**Guided Mode** (vertical stepper):
- One section shown at a time
- Back / Next buttons; Next is disabled until `isComplete()` returns true for active section
- Section status dots: gray = empty, amber = partial, green = complete
- Toggle via "Switch to Direct Edit →" button

**Direct Mode** (horizontal tabs):
- All sections accessible; click to jump to any
- Same status dots shown per tab
- Toggle via "← Switch to Guided Mode" button

Mode state persists in Zustand (`guidedModeActive`) across page refreshes.

### Section Completion Contract

`sections/sectionCompletion.ts` defines the completion contract for each section:

```typescript
interface SectionDef {
  id: string;
  label: string;
  description: string;
  isComplete: (inputs: Partial<DealInputs>) => boolean;  // pure function
  requiredFields: (keyof DealInputs)[];                  // for UI status hints
}
```

| Section ID | Complete When |
|-----------|--------------|
| `capitalization` | totalCapitalization > 0 AND unitPrice > 0 |
| `weekly-economics` | weeklyNut > 0 AND performances > 0 AND estimatedWeeks > 0 |
| `revenue` | capacity > 0 AND avgTicketPrice > 0 |
| `royalties` | sum of all royalties.* values > 0 |
| `waterfall` | waterfallType defined AND postRecoupInvestorSplit > 0 |

`getSectionStatus(section, inputs)` returns `"complete" | "partial" | "empty"` for UI dot rendering.

### Section Component Props

Every section component accepts the same interface—no new form instances:

```typescript
interface SectionProps {
  control: Control<DealInputs>;
  watch: UseFormWatch<DealInputs>;
  setValue: UseFormSetValue<DealInputs>;
  modelOutput: ModelOutput | null;   // for live hints inside sections
  dealInputs: DealInputs | null;     // current saved state
}
```

### Autosave

`DealBuilder` debounces all live form values with a 1.5s delay via `useDebounce()`. When debounced values change and `isDirty` is true, `onSave()` fires silently. The explicit Save button always remains available. Status feedback: idle → "Saving…" → "Saved ✓" (3s) → idle.

Race prevention: autosave only fires when `isDirty === true`. Clicking the explicit Save button resets dirty state, stopping any pending debounced autosave.

### LiveOutcomePanel

Read-only card. Zero business logic—all computation is upstream in `runScenario()`.

Displayed metrics (from first open, non-preview week):
- **Weekly Gross**—`openWeek.grossBoxOffice`
- **Weekly Profit**—`openWeek.operatingProfit`
- **Breakeven Occupancy**—`modelOutput.weeklyBreakeven` (null = can never profit)
- **Recoup Week**—`modelOutput.recoupWeek` (null = doesn't recoup in run)
- **Investor Multiple**—shown only when fully recouped; otherwise shows capital recovery %
- **Risk Band**—derived from breakeven: `> 0.9` → High Risk, `0.7–0.9` → Medium, `< 0.7` → Low
- **Waterfall Phase badge**—from `deriveWaterfallPhaseState()`

Three-case capital recovery display (not just "0.00×"):
1. Full recoup → Recoup Week + Investor Multiple
2. Partial recoup → "Full Recoup Not Reached" + "Capital Returned: $X (YY%)"
3. No recovery → "No Capital Recovery Modeled" + "$0 (0%)"

Shows skeleton placeholders when `modelOutput` is null.

---

## Deal Room

`/deal-room?token=<uuid>`—a public, read-only investor workspace. No login required.

### Architecture

- **Token = Document ID**: The UUID share token is the Firestore `dealRooms/{token}` document ID. Knowing the URL is the access credential.
- **Snapshot model**: `DealInputs` are copied at share time. Edits after sharing don't update the deal room automatically—producer must click "Update Snapshot".
- **No individual investor data**: Only aggregate deal economics are exposed. Cap table details never appear in the deal room.
- **Firestore security**: `dealRooms` collection is publicly readable when `isActive == true`. Writes require `request.auth.uid == resource.data.ownedByUserId`.

### Producer Workflow (DealRoomSetup.tsx—6th tab)

1. Click "Create Deal Room" → generates UUID token, snapshots current `DealInputs` + production metadata → saves to `dealRooms/{token}`
2. Toggle sections on/off (Financial Model, Waterfall, Capitalization Progress, Documents, Weekly Breakdown)
3. Add optional producer note (max 500 chars)
4. Copy share link → `https://overridebroadway.com/deal-room?token=<uuid>`
5. "Update Snapshot" re-saves current deal inputs to the existing deal room document
6. Deactivate / Reactivate to control access without deleting

### Investor View (DealRoomView.tsx)

Runs `runScenario()` client-side against snapshotted `dealInputs`. Three built-in scenarios (from `DEFAULT_SCENARIOS` in `scenarios.ts`):
- **Bear**: 60% occupancy, $100 ATP, 20-week run
- **Base**: 75% occupancy, $115 ATP, 36-week run
- **Bull**: 90% occupancy, $135 ATP, 52-week run

Sections rendered based on `config` toggles: production header, producer note, deal structure cards, scenario cards, WaterfallFlow (reused component), weekly breakdown table, capitalization progress bar, documents, legal disclaimer.

### DealRoom Types (types/dealRoom.ts)

```typescript
interface DealRoomConfig {
  showFinancialModel: boolean;
  showWaterfall: boolean;
  showCapitalizationProgress: boolean;
  showDocuments: boolean;
  showWeeklyBreakdown: boolean;
  producerNote?: string;
}

interface DealRoom {
  id: string;               // token = document ID
  productionId: string;
  ownedByUserId: string;
  production: { name, subtitle?, venue?, status, artworkUrl?, showUrl?, ...docUrls };
  dealInputs: DealInputs;   // snapshot
  config: DealRoomConfig;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}
```

---

## Investor Outcome Sensitivity Grid

The Scenarios tab contains an "Investor Outcome Sensitivity" grid—an occupancy × run-length decision surface.

### SensitivityCell (model.ts)

```typescript
interface SensitivityCell {
  occupancyRate: number;
  weeks: number;
  recoupWeek: number | null;
  recoupAchieved: boolean;
  investorDistributions: number;
  investorMultiple: number;    // totalInvestorDistributions / totalCapitalization
  investorROI: number;         // (distributions - cap) / cap—negative when partial
  totalGrossBoxOffice: number;
  totalOperatingProfit: number;
}
```

All investor outcome math is computed in `generateSensitivityGrid()` in `scenarios.ts`—never re-derived in the React layer.

### Color System (outcomeColor / outcomeDisplay)

```typescript
// outcomeColor: ROI-driven, not recoup-timing-driven
if (!recoupAchieved || roi < 0)  → bg-red-100    (Loss)
if (roi <= 0.05)                 → bg-yellow-100  (Break-even)
if (multiple <= 1.5)             → bg-green-100   (1.0–1.5× return)
else                             → bg-green-200   (>1.5× return)
```

### Hover Tooltip—Reflow Prevention

The tooltip strip is **always rendered** with a fixed `h-9` container. It switches between detail content (when `hoveredCell` is set) and a placeholder hint (when not). This prevents the table from reflowing when hover state changes, which would cause cascading mouseLeave/mouseEnter flicker.

```tsx
<div className="mx-4 mb-3 h-9 flex items-center">
  {hoveredCell ? <DetailStrip /> : <PlaceholderHint />}
</div>
```

---

## Waterfall Phase Engine

`src/lib/model/waterfallPhase.ts`—pure functions, no React, no side effects.

### WaterfallPhase Enum

```typescript
enum WaterfallPhase {
  PRE_REVENUE,               // No week generates positive operating profit
  RECOUPMENT,                // Profit exists but cumulative < totalCapitalization
  POST_RECOUP_PROFIT_SHARING, // Recouped AND postRecoupInvestorSplit < 1.0
  CLOSED,                    // Recouped AND postRecoupInvestorSplit === 1.0
}
```

### WaterfallPhaseState

```typescript
interface WaterfallPhaseState {
  phase: WaterfallPhase;
  profitSharingEnabled: boolean;  // postRecoupInvestorSplit < 1.0 (NOT the hasProfitSharing toggle)
  capitalReturned: number;         // MIN(totalInvestorDistributions, totalCapitalization)
  profitDistributions: number;     // MAX(0, totalInvestorDistributions − totalCapitalization)
  recoupWeek: number | null;
  totalWeeks: number;
}
```

**Critical rule:** `profitSharingEnabled` is derived from `postRecoupInvestorSplit < 1.0`—a config ratio—never from the `hasProfitSharing` boolean toggle. The toggle only controls whether a form field is editable; it does not gate financial phase derivation.

### Phase Derivation Rules

```
if no week has operatingProfit > 0  → PRE_REVENUE
else if not yet recouped            → RECOUPMENT
else if postRecoupInvestorSplit < 1 → POST_RECOUP_PROFIT_SHARING
else                                → CLOSED
```

Used by: `LiveOutcomePanel`, `WaterfallSection`, `WaterfallFlow`, `DealRoomView`.

---

## Shared Form Field Components

`src/app/(app)/productions/view/shared/FormFields.tsx`

```typescript
// Tooltip with Info icon—wraps TooltipProvider so it works without parent provider
InfoTip({ children: React.ReactNode })

// Displays 0–1 decimal as percentage (e.g. 0.045 → "4.50 %")
// Fires onChange as decimal; raw string maintained for editing
PercentInput({ value: number, onChange: (v: number) => void })

// Displays number with $ prefix + comma formatting (e.g. 125000 → "$125,000")
// Fires onChange as raw number; comma-stripped on focus, re-formatted on blur
CurrencyInput({ value: number, onChange: (v: number) => void, placeholder?: string })
```

**Note:** `ProductionHubClient.tsx` still has its own local copies of these components (used in tabs other than the Deal Builder). Do not remove those—they serve different rendering contexts (e.g., inside the Financial Model tab, which does not use section components).

---

## Financial Model

### Calculation Pipeline (per week)

```
Gross Box Office
  = capacity × performances × occupancyRate × blended_ticket_price
  (blended = fullPrice × (1 - discountRate) + discountedPrice × discountRate)

Credit Card Fees = grossBoxOffice × creditCardFeeRate  (default 3%)
House Deduction  = grossBoxOffice × housePercentage    (default 6%)
  + optional: aboveThreshold × houseProfitsSplitAbove

Adjusted Gross = Gross − CC Fees − House Deduction

Royalties:
  Mode A (fixed %): each participant's rate × adjustedGross, summed
  Mode B (pool):    adjustedGross × royaltyPoolPercentage (pool split proportionally)
  Running Royalty Offset: if pre-recoupment and enabled,
    subtract royaltyOffsetAmount (fixed $) from gross royalty bill, floor at $0.
    Individual breakdowns are scaled proportionally.

Net Box Office = Adjusted Gross − Total Royalties

Operating Profit = Net Box Office − Weekly Nut − GP Fee − GP Flat Overrides
  GP Fee       = max(0, operatingProfit_before_gp_fee) × gpFeeRate
  GP Flat      = gpFlatWeekly (fixed $) + remaining_profit × gpFlatProfitPercent
  (GP flat overrides applied in sequence before waterfall split)

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

### IRR Calculation
Newton-Raphson iteration on weekly investor cash flows (`investorDistribution` values), annualized as `(1 + weeklyRate)^52 − 1`. The full capitalization is the investment base. Returns `null` if no distributions occur.

### Weekly Breakeven
Binary search (100 iterations) for the occupancy rate at which `operatingProfit = 0`. Searches 0%–150% occupancy. Breakeven above 100% means the show cannot profit at any realistic occupancy with the current nut + royalty structure. `null` means even 150% occupancy doesn't generate positive profit.

### Investor Pool %
Each investor's `poolPercent = investor.amount / totalCapitalization`. This ensures partial investor lists (e.g., only your block entered) produce accurate pro-rata returns against the full capitalization, not against only the entered investors.

---

## Hooks Reference

| Hook | Returns | Purpose |
|------|---------|---------|
| `useDealInputs(productionId)` | `{ dealInputs, loading, saving, save }` | Loads deal from Firestore on mount, exposes `save()` which calls `stripUndefined` before `setDoc` |
| `useDebounce<T>(value, delay)` | `T` (debounced) | Generic debounce—used in DealBuilder for 1.5s autosave |
| `useInvestors(productionId)` | `{ investors, loading, add, update, remove }` | Real-time onSnapshot for `investors` subcollection |
| `useProducerPools(productionId, ownerUserId)` | `{ pools, loading, defaultPoolId, add, update, remove }` | Real-time listener for producer pools; lazy-migrates legacy investors to a "Direct Investors" default pool |
| `useProductions()` | `{ productions, loading }` | Real-time listener for all productions owned by current user |

---

## Types Reference

### DealInputs (deal.ts)

Key fields grouped by section:

```typescript
// Capitalization
totalCapitalization: number
units: number              // auto-computed: Math.round(cap / unitPrice), set via setValue
unitPrice: number
investors: Investor[]      // LEGACY—always [] in Firestore; overridden at compute time
                           // by bridging CapitalizationInvestor[] from useInvestors()

// Weekly operations
weeklyNut: number
capacity: number           // seats
performances: number       // per week
avgTicketPrice: number     // full-price blended
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
gpFeeRate: number          // % of operating profit
gpShareOfInvestorPool: number  // % carved from investor pool post-recoup
gpFlatWeekly?: number      // fixed $ before waterfall
gpFlatProfitPercent?: number   // fixed % of remaining profit before waterfall
weeklyOfficeCharge: number // kept for Firestore compat, NOT used in calculations

// Waterfall
waterfallType: "recoup_first" | "share_from_dollar_one"
hasProfitSharing: boolean  // Gates effective investor split in calculateWeeklyResult (see note below)
postRecoupInvestorSplit: number  // investor pool % (LP + GP carve) of distributable profit
runningRoyaltyOffset: boolean
royaltyOffsetAmount?: number

// Run parameters
estimatedWeeks: number
previewWeeks: number
openingWeek: number
```

### Default Deal Inputs

`DEFAULT_DEAL_INPUTS` provides industry-calibrated starting values for new productions:

| Field | Default | Notes |
|-------|---------|-------|
| totalCapitalization | $2,000,000 | Small musical scale |
| unitPrice | $20,000 | 100 units |
| weeklyNut | $450,000 | Mid-range operating costs |
| capacity | 1,200 seats | |
| performances | 8/week | Standard Broadway schedule |
| avgTicketPrice | $125 | Full-price blended |
| discountRate | 20% | |
| discountedTicketPrice | $75 | |
| creditCardFeeRate | 3% | Industry standard |
| housePercentage | 6% | Industry standard |
| royalties (total) | ~16.25% | Fixed % of adjusted gross |
| gpShareOfInvestorPool | 10% | Standard GP carve |
| waterfallType | recoup_first | Standard structure |
| postRecoupInvestorSplit | 50% | Standard LP/GP split |
| estimatedWeeks | 52 | 1-year run |
| previewWeeks | 4 | |
| openingWeek | 5 | |

### ModelOutput (model.ts)

```typescript
interface ModelOutput {
  dealInputs: DealInputs;
  occupancyRate: number;
  weeks: WeeklyResult[];
  recoupWeek: number | null;          // first week where cumulative profit ≥ capitalization
  totalGrossBoxOffice: number;
  totalRoyalties: number;
  totalOperatingProfit: number;
  totalInvestorDistributions: number;
  investorReturns: InvestorReturn[];
  approximateIRR: number | null;
  weeklyBreakeven: number | null;     // occupancy rate (0–1+); null if never achievable
}
```

### CapitalizationInvestor vs. Investor (capitalization.ts vs. deal.ts)

Two separate investor types exist:
- `Investor` (deal.ts)—simplified `{ id, name, amount, units }` used in the financial model for IRR calculations. **Never stored directly in Firestore**—always bridged at compute time from `CapitalizationInvestor`.
- `CapitalizationInvestor` (capitalization.ts)—full investor record stored in `investors/{investorId}` subcollection; drives the Capitalization tab UI and is the source of truth for investor data.

```typescript
interface CapitalizationInvestor {
  id: string;
  productionId: string;
  producerPoolId?: string;          // pool assignment
  // Identity
  name: string;
  email: string;
  phone?: string;
  address?: string;
  // Investment
  shares: number;
  amountCommitted: number;
  amountFunded: number;
  ownershipPercent: number;         // computed as amountCommitted / totalCapitalization before save
  status: InvestorStatus;           // "invited" | "docs_sent" | "signed" | "funded" | "admitted"
  notes?: string;
  isPersonalInvestment?: boolean;   // flags the user's own investment in the cap table
  // Per-investor document URLs (7 slots across 3 lifecycle stages)
  distributedInstructionLetterUrl?: string;
  distributedSignaturePageUrl?: string;
  distributedSubscriptionAgreementUrl?: string;
  signedSignaturePageUrl?: string;
  signedSubscriptionAgreementUrl?: string;
  executedSignaturePageUrl?: string;
  executedSubscriptionAgreementUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### ProducerPool (capitalization.ts)

```typescript
interface ProducerPool {
  id: string;
  productionId: string;
  ownerUserId: string;
  name: string;
  allocationLimit?: number;         // optional cap on total committed to this pool
  createdAt: Date;
  updatedAt: Date;
}
```

A "Direct Investors" default pool is lazily created by `ensureDefaultPool()` in `firestore.ts` when none exists. Legacy investors without a `producerPoolId` are assigned to this pool via `assignInvestorsToDefaultPool()`.

---

## Industry Benchmarks (Validated Against Public Data)

These figures are derived from publicly reported Broadway financials (Hadestown, Come From Away, Dear Evan Hansen, Wicked, Hamilton) and industry standards (APC, Dramatists Guild, Loeb & Loeb).

### Capitalization
| Show size | Typical cap |
|-----------|-------------|
| Small straight play | $2–5M |
| Mid-size musical | $8–12M |
| Large musical | $12–18M |
| Mega-musical | $18M+ |

Hadestown: $11.5M. Dear Evan Hansen: $9.5M. Come From Away: $12M. Wicked: $14M.

### Weekly Gross Box Office
- **Successful musical at 85% occupancy, 1,000 seats, $125 ATP**: ~$840K/week
- **Hadestown at 93% occ, 947 seats, $155 ATP**: ~$1.05M/week ✓ (matches press reports)
- **Typical breakeven range**: 55–75% occupancy for a well-structured deal

### The Nut (Weekly Operating Costs)
| Era / show size | Weekly nut |
|-----------------|------------|
| Small show, pre-2020 | $300–450K |
| Mid-size musical | $500–700K |
| Large musical (post-2022 labor contracts) | $700K–$1.2M |

The nut includes cast, crew, musicians, marketing, insurance, theater rent (flat component), administration. **Theater rent is already in the nut**—do not add a separate house % for the flat component, only for the gross-% component.

### Credit Card Fees
Standard: **2.5–3.5%** of gross box office. Model default: 3%.

### House Deal
Standard: **5–7%** of gross box office receipts. Model default: 6%.
Some theaters add a flat weekly rent ($10–20K) already included in the nut, plus the % of gross component.

### Royalties

**Two structures exist:**

**1. Fixed % of adjusted gross** (traditional, most common):
| Participant | Typical rate |
|-------------|-------------|
| Author (book) | 4.5% |
| Composer | 3.0% |
| Lyricist | 2.25% |
| Director | 2.0% |
| Choreographer | 1.5% |
| Each designer (set/costume/lighting/sound) | 0.5% |
| Production company | 1.0% |
| **Total** | **~15–18%** |

**2. Pool method** (`royaltyPoolType = "pool"`): Set `royaltyPoolPercentage` to the aggregate % of adjusted gross allocated to all royalty participants combined (typically 14–18%). The pool is then split proportionally by each participant's relative rate. This is equivalent to fixed %—the "40% royalty pool" figure cited in some industry literature refers to 40% of **weekly net operating profit** (a different calculation entirely, not implemented here as it's less common for investor modeling).

**Running Royalty Offset**: A fixed weekly dollar amount (industry range: $15K–$50K/week) subtracted from the gross royalty obligation during recoupment. It reduces cash paid to royalty participants pre-recoup, increasing weekly profit available to accelerate recoupment. It has **no effect post-recoupment**—it does not reduce creative participation percentages.

### GP Compensation Structure
Four compensation channels, the first three applied in sequence every profitable week before the waterfall split, the fourth applied post-recoup:
1. **GP Management Fee** (`gpFeeRate`)—% of operating profit (before flat overrides)
2. **GP Flat Weekly** (`gpFlatWeekly`)—optional fixed $ per week (capped at remaining profit)
3. **GP Flat Profit %** (`gpFlatProfitPercent`)—optional % of remaining profit after flat weekly
4. **GP Post-Recoup Carve** (`gpShareOfInvestorPool`)—% of investor pool, applied post-recoup only

Multiple channels can be active simultaneously. The UI warns when more than one is active.

### Waterfall Structure
- **Recoup First** (standard): 100% of weekly operating profit to investor pool until cap is returned. Then profit sharing activates per `postRecoupInvestorSplit`. The boundary week where recoupment crosses is handled correctly—the crossing amount goes to recoupment and the remainder splits post-recoup.
- **Share From Dollar One**: LP split applies from week 1; investor distributions count toward recoupment tracking simultaneously.
- **GP Share of Investor Pool**: GP (general partner / lead producer) typically receives 10% of the investor share as a performance fee. This is carved out before LP distributions.

### Post-Recoup Split
Standard: **50% to investors (LP), 50% to producers (GP)**. The 50% LP share is further distributed pro-rata to individual investors by pool percent. The GP's carve comes out of the investor pool (not additional to it), so LP net = `investorPool × (1 − gpShareOfInvestorPool)`.

### Recoupment Statistics
- Only **20–25% of Broadway musicals** fully recoup their capitalization.
- Successful recoupment: typically **7–18 months** (30–78 weeks) for musicals.
- Plays recoup faster: **4–6 months** if they do.
- Hamilton, Book of Mormon, Hadestown, Dear Evan Hansen: exceptional outliers with 500–1000%+ returns.

### Validation: Hadestown (calibrated model)
| Parameter | Value used | Result |
|-----------|-----------|--------|
| Capitalization | $11.5M | — |
| Capacity | 947 seats, 8 perfs | — |
| ATP (blended) | $155 | — |
| Discount rate | 10% at $90 | — |
| CC fee | 2.5% | — |
| House % | 6% | — |
| Royalties (fixed) | 14% of adj. gross | — |
| Running offset | $25K/week | — |
| Weekly nut | $530K | — |
| GP fee | 1.5% | — |
| Occupancy | 93% | — |
| **Weekly gross** | — | **$1.05M** ✓ |
| **Breakeven occ.** | — | **57%** ✓ |
| **Weeks to recoup** | — | **~37** (~8.5 mo) ✓ |

Public data: Hadestown reported ~$1M average weekly gross, recouped in ~7 months. Our model produces $1.05M weekly gross at 93% occupancy—within press-reported range. Recoup at ~37 weeks is slightly longer than the ~30 weeks reported (Hadestown had particularly strong early occupancy), which makes sense as a conservative model estimate.

---

## Analytics Events

`src/lib/analytics.ts` provides typed analytics helpers via the `Analytics` object. All events are fire-and-forget (errors swallowed).

| Event | Parameters | Trigger |
|-------|-----------|---------|
| `pageView` | pageName | Page mount |
| `signUp` | method (email/google) | Registration |
| `login` | method (email/google) | Sign-in |
| `productionCreated` | — | New production dialog |
| `dealInputsSaved` | productionId | Deal save (manual or autosave) |
| `scenarioRun` | scenarioName | Scenario execution |
| `sensitivityGridViewed` | — | Scenarios tab loaded |
| `artworkUploaded` | — | Artwork upload complete |
| `agreementUploaded` | — | Operating agreement upload |
| `modelViewed` | recoupWeek | Financial Model tab opened |
| `investorAdded` | — | Investor created |
| `investorDocUploaded` | docType | Investor document uploaded |
| `capitalizationViewed` | productionId | Capitalization tab opened |
| `producerPoolCreated` | — | Pool created |
| `dealRoomCreated` | productionId | Deal room created |
| `dealRoomViewed` | token | Investor visits deal room |
| `dealRoomLinkCopied` | productionId | Share link copied |
| `dealRoomDeactivated` | productionId | Deal room deactivated |
| `dealRoomUpdated` | productionId | Snapshot updated |

---

## Storage Layout

Production-level files stored at `productions/{userId}/{productionId}/`:
- `artwork`—Production artwork image (max 5MB, images only)
- `operating-agreement.pdf`—Operating agreement (max 20MB)
- `instruction-letter.pdf`—Investor instruction letter
- `member-signature-page.pdf`—Member signature page
- `subscription-agreement.pdf`—Subscription agreement

Investor-level files at `productions/{userId}/{productionId}/investors/{investorId}/`:
- `distributed/instruction-letter.pdf`
- `distributed/signature-page.pdf`
- `distributed/subscription-agreement.pdf`
- `signed/signature-page.pdf`
- `signed/subscription-agreement.pdf`
- `executed/signature-page.pdf`
- `executed/subscription-agreement.pdf`

All uploads use `uploadBytesResumable` with optional progress callbacks. Storage rules enforce that auth UID matches the `userId` path segment.

---

## Commands

```bash
npm run dev      # Local development server (http://localhost:3000)
npm run build    # Static export → out/ (runs prebuild + postbuild scripts)
npm run lint     # ESLint (flat config)
firebase deploy  # Deploy hosting + rules + storage
firebase deploy --only hosting        # Hosting only
firebase deploy --only firestore:rules
firebase deploy --only storage
```

### Build Pipeline

The build process has three stages:
1. **prebuild** (`scripts/prebuild.mjs`): Generates a timestamp-based build ID, writes to `.build_id`
2. **build**: Next.js static export; `next.config.ts` injects `.build_id` as `NEXT_PUBLIC_BUILD_ID`
3. **postbuild** (`scripts/postbuild.mjs`): Copies `.build_id` to `out/_build_id.txt`

The `UpdateChecker` component polls `/_build_id.txt` in production to detect new deployments and prompts users to refresh.

## Environment Variables

Required in `.env.local` (never commit real values):

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=soyouthinkyouwant.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=soyouthinkyouwant
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=soyouthinkyouwant.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=777571271688
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

Get these from: Firebase Console → Project Settings → Your Apps → Web App config.

## Firebase Project

- **Project ID**: soyouthinkyouwant
- **Project Number**: 777571271688
- **Org**: nathanpayne.com
- **Auth providers enabled**: Email/Password, Google
- **Analytics**: Enabled
- **Custom domain**: overridebroadway.com (add to Firebase Auth authorized domains + Google OAuth allowed origins)

---

## Common Pitfalls

**Routing / Build**
- Do not add `"use client"` to `app/(app)/productions/view/page.tsx`—it will break static generation
- Do not import Firebase directly in server components—always guard with `typeof window` or use client components
- `/deal-room` is outside the `(app)` route group by design—it has no auth requirement. Do not move it inside `(app)/`.

**Forms**
- There is only **one** `useForm()` instance for deal inputs—it lives in `ProductionHubClient`. Never create a new `useForm()` in a section component or in `DealBuilder`.
- Section components must use `<Controller>` with the `control` prop passed from the parent, not local state.
- `totalCapitalization ÷ unitPrice` auto-computes `units` via a `useEffect` + `setValue` in `ProductionHubClient`. Do not replicate this logic in section components.
- Inline edit inputs (title, subtitle, venue, URL) use `onBlur` to cancel on focus loss. The Save button must use `onMouseDown={e => e.preventDefault()}` to prevent the blur from firing before `onSubmit`. Without this, clicking Save dismisses the input without saving.

**Financial Model**
- `calculateRoyalties()` returns `{ totalRoyalties, breakdown }`—destructure with alias if needed: `{ totalRoyalties, breakdown: royaltyBreakdown }`
- `weeklyOfficeCharge` is kept in `DealInputs` for Firestore compatibility but is **not used in any calculation**—it is assumed to be included in `weeklyNut`
- ATP on the Financial Model tab is read-only (locked to deal inputs). Only the Scenarios tab has independent ATP inputs.
- The "40% royalty pool" figure in industry literature refers to 40% of **net operating profit**, not 40% of gross. Our model's `royaltyPoolPercentage` is a % of **adjusted gross** (14–18% is realistic for this field).
- `DealInputs.investors` is always `[]` in Firestore. Do NOT read it from the form or saved deal to drive investor returns—always bridge from `useInvestors()` at the `modelOutput` useMemo call site.

**Waterfall Phase**
- **Known inconsistency**: `calculateWeeklyResult` in `calculations.ts` gates the effective investor split using `hasProfitSharing` (when false, investors receive 0% post-recoup). However, `waterfallPhase.ts` derives phase state from `postRecoupInvestorSplit < 1.0` regardless of the toggle. This means the phase badge can show "Profit Sharing" while the actual calculations give investors nothing if the toggle is off.
- `capitalReturned = MIN(totalInvestorDistributions, cap)`—never exceeds capitalization.
- `profitDistributions = MAX(0, totalInvestorDistributions − cap)`—only non-zero post-recoupment.

**Firestore**
- Deal inputs are always saved under the fixed document ID `"primary"` within the `dealInputs` subcollection.
- Firestore rejects `undefined` values—always call `stripUndefined()` before `setDoc`.
- The Zustand store persist key changed from `"broadway-deal-draft"` to `"deal-builder-ui"`. The old key is defunct—any `useDealStore` code referencing `draftInputs`, `mergeDraftSection`, or `clearDraft` is from a deleted version and should not be re-introduced.
- Deal room documents live in the **top-level** `dealRooms` collection, not as a subcollection of productions. The token is the document ID.
- `deleteProduction()` only deletes the root production document. Subcollections (`dealInputs`, `investors`, `producerPools`, `scenarios`) and Storage files are **not** cascade-deleted—they become orphaned. This is a known gap.

**UI**
- Recharts Tooltip `formatter` props use `unknown` types—cast with `Number(v)` and `String(name)`.
- `InfoTip` in `shared/FormFields.tsx` wraps its own `TooltipProvider`. `InfoTip` in `ProductionHubClient.tsx` does not (it relies on the parent `TooltipProvider` in the shadcn Tooltip setup). Use the shared version in section components; use the local version in `ProductionHubClient`.
- JSX string literals do **not** interpret `\u` escape sequences—they render literally. Use actual Unicode characters (e.g., `—` not `\u2014`) inside JSX tags.
- Sensitivity grid hover tooltip: the container must always be rendered at fixed height to prevent table reflow (which causes cascading mouseLeave/mouseEnter flicker). Never conditionally mount/unmount the tooltip—toggle its content instead.

**Google OAuth / Custom Domain**
- For Google sign-in to work on `overridebroadway.com`, both of these must be configured:
  1. Firebase Console → Authentication → Settings → Authorized domains: add `overridebroadway.com`
  2. Google Cloud Console → APIs & Services → Credentials → OAuth client → Authorized JavaScript origins: `https://overridebroadway.com`; Authorized redirect URIs: `https://overridebroadway.com/__/auth/handler`
