# Code Modification Rules

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
