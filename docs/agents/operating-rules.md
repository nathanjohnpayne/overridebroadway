# Agent Operating Rules

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

## 1Password CLI authentication failures

If any `op` command (`op read`, `op inject`, `op run`, `op document get`,
or any script that wraps them) fails with a sign-in or authentication
error — including but not limited to:

- `[ERROR] ... not currently signed in`
- `session expired`
- `biometric unlock ... timed out`
- `authorization prompt dismissed`
- `error initializing client: authorization`

Then follow this procedure:

1. **Stop immediately.** Do not retry the command, do not attempt
   workarounds (manual token entry, environment variable overrides,
   fallback credential paths, or skipping the credential step).
2. **Prompt the human with context.** State what you were trying to do
   and what credential you needed. Example:
   > "1Password is timing out. Could you let me know when you are back
   > to provide a biometric response? I need the reviewer PAT to
   > approve PR #142."
3. **Wait for the human to confirm** they are present and ready before
   retrying the `op` command.
4. After confirmation, retry **once**. If it fails again, report the
   full error output and wait — do not loop.

This rule applies only to 1Password CLI sign-in and authentication
errors. Other `op` failures (wrong item ID, missing field, network
errors, vault permission errors) should be diagnosed and resolved
normally.
