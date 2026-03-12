# Contributing

## Overview

Override is an internal financial platform for Broadway producers. The codebase uses Next.js 16 App Router with TypeScript strict mode and Firebase as the backend. Keep changes aligned with the existing architecture. Prefer small, focused changes over refactoring.

## Branch Naming

| Type | Format | Example |
|------|--------|---------|
| New feature | `feature/<short-description>` | `feature/investor-export` |
| Bug fix | `fix/<short-description>` | `fix/waterfall-phase-badge` |
| Maintenance | `chore/<short-description>` | `chore/upgrade-firebase-sdk` |

## Commit Message Format

Use imperative present tense. Keep the subject line under 72 characters.

```
Add IRR display to investor returns tab
Fix hasProfitSharing toggle not gating waterfall phase badge
Update Firestore security rules for dealRooms collection
```

## Pull Request Process

1. Branch from `main`
2. Run `npm run build` — static export must succeed before opening a PR
3. Run `npm run lint` — no lint errors
4. Run `scripts/ci/` checks locally
5. Open a PR against `main` with a clear title and description
6. At least one human review required before merge

## Code Style

- **Language:** TypeScript 5 strict. All new code must be fully typed.
- **Framework:** Next.js 16 App Router. Follow existing patterns in `src/app/`.
- **UI:** Tailwind CSS v4 + shadcn/ui (Radix primitives). No custom CSS modules or styled-components.
- **Charts:** `recharts` only.
- **Forms:** `react-hook-form` with `Controller`. **One** `useForm<DealInputs>()` instance lives in `ProductionHubClient` — never create a new form instance in a section component.
- **State:** Zustand only for UI state (guided mode). Deal data lives in Firestore via `useDealInputs`.
- **Firebase writes:** `setDoc` with `stripUndefined()` applied before every write. No raw saves with `undefined` fields.
- **Static export rules:** Never add `"use client"` to server component wrappers. Use the `*DynamicLoader` client pattern for components requiring `useSearchParams`.

## Financial Model Rules

**Do not modify the financial engine without understanding the full calculation chain:**

- `src/lib/model/calculations.ts` — core per-week calculations
- `src/lib/model/scenarios.ts` — `runScenario()`, sensitivity grid
- `src/lib/model/waterfallPhase.ts` — waterfall phase derivation (pure functions)

**Known inconsistency to preserve (do not "fix"):** `calculateWeeklyResult` gates effective investor split using `hasProfitSharing`, but `waterfallPhase.ts` derives phase from `postRecoupInvestorSplit < 1.0` regardless of the toggle. This is documented in AGENTS.md Common Pitfalls.

## Adding a New Route / Feature

When adding a new authenticated page:
1. Add the route under `src/app/(app)/`
2. Wire navigation in `src/app/(app)/layout.tsx` if it needs a nav entry
3. Add analytics event in `src/lib/analytics.ts` if it's a meaningful user action

When adding a new Firestore collection or subcollection:
1. Update `firestore.rules` with appropriate security rules
2. Add CRUD operations in `src/lib/firestore.ts`
3. Document the collection in AGENTS.md under Firestore Data Model

## Testing

```bash
npm run build   # Static export — must succeed
npm run lint    # ESLint
```

There is no automated unit test suite. When modifying financial calculations or Firestore logic, test manually:
1. Create a test production in the app
2. Verify deal inputs save and reload correctly
3. Verify the financial model renders expected outputs
4. Leave notes in your PR about what you tested manually and what you did not verify.

**Do not delete tests or CI scripts to force a build to pass.**

## Agent Contributions

AI agent contributions must follow `AGENTS.md`. All agent-proposed changes require human review before merge. Agents must be explicit about what was and was not manually verified.

## Questions

Open an issue on GitHub or contact the repo owner directly.
