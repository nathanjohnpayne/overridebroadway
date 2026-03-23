# Reference: Types, Hooks, Analytics, and Benchmarks

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

---
