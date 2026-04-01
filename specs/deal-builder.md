---
spec_id: deal-builder
title: Deal Builder
status: active
last_updated: 2026-03-31
---

# Deal Builder

## Overview

The Deal Builder is the core workspace for configuring a Broadway production's
financial deal. It lives at `/productions/view?id={id}` and consists of a
two-pane layout: section-based input forms on the left and a sticky Live Outcome
panel on the right (desktop) or a collapsed strip (mobile).

Deal inputs are loaded from and persisted to Firestore via `useDealInputs`.
Form state is managed by `react-hook-form`. A financial model (`runScenario`)
computes outputs in real time as inputs change.

## Functional Requirements

### FR-1: Deal Input Form

- The DealBuilder renders five sections, navigable via tabs or a guided stepper:
  1. **Capitalization** -- total cap, units, unit price, investors.
  2. **Weekly Economics** -- weekly nut, capacity, performances, ticket prices.
  3. **Revenue** -- credit card fees, house percentage, house profits threshold.
  4. **Royalties** -- per-role royalty rates, pool type, royalty base.
  5. **Waterfall** -- waterfall type (recoup first vs share from $1), post-recoup
     splits, GP fees, royalty offsets.
- Each section accepts numeric inputs via controlled form fields.
- Default values are defined in `DEFAULT_DEAL_INPUTS`.

### FR-2: Model Rendering / Calculation

- As deal inputs change, `runScenario` is called with the current inputs and a
  default scenario to produce a `ModelOutput`.
- The `ModelOutput` includes:
  - Weekly results array (gross, operating profit, investor distributions, recoup
    percentage per week).
  - `recoupWeek` -- the week investors fully recoup their capital (or null).
  - `totalGrossBoxOffice`, `totalOperatingProfit`, `totalInvestorDistributions`.
  - `weeklyBreakeven` -- the occupancy rate at which the production breaks even.
  - `approximateIRR` -- annualized internal rate of return for the investor pool.
  - Per-investor returns with ROI, cash-on-cash multiple, and individual recoup
    week.
- The Live Outcome panel displays weekly gross, breakeven occupancy, and recoup
  week from the model output.

### FR-3: Save and Load Deals

- On mount, `useDealInputs` calls `getDealInputs(productionId)` to fetch the
  saved deal from Firestore subcollection
  `productions/{id}/dealInputs/primary`.
- When no saved deal exists, `DEFAULT_DEAL_INPUTS` are used.
- Autosave fires 1.5 seconds after the user stops editing (debounced). The save
  bar shows "Saving...", then "Saved" for 3 seconds before returning to idle.
- A manual "Save Deal Inputs" button triggers an immediate
  `saveDealInputs(productionId, inputs)`.
- The save bar shows an "Unsaved changes" badge when the form is dirty.

### FR-4: Guided Mode

- Guided mode is a progressive stepper that walks the user through each section
  in order, tracking completion.
- UI state (guided mode active, current section, completed sections) is
  persisted in `localStorage` via `zustand/persist` under key
  `"deal-builder-ui"`.
- The user can toggle between guided mode and free-form tab navigation.

## Acceptance Criteria

- [ ] AC-1: All five deal sections render their respective form fields.
- [ ] AC-2: Changing inputs triggers `runScenario` and updates the Live Outcome
  panel in real time.
- [ ] AC-3: Deal inputs are loaded from Firestore on mount and populate the form.
- [ ] AC-4: Autosave persists changes to Firestore after a 1.5-second debounce.
- [ ] AC-5: The manual save button calls `saveDealInputs` and shows saving status.
- [ ] AC-6: When no saved deal exists, `DEFAULT_DEAL_INPUTS` are applied.
- [ ] AC-7: Guided mode state persists across page reloads via localStorage.
- [ ] AC-8: The mobile layout shows a condensed outcome strip instead of the full
  sidebar panel.
