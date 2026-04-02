# Repository Rules

## Structure Invariants

The following files must always exist at the repository root and must never be deleted or moved:

- `README.md`
- `AGENTS.md`
- `DEPLOYMENT.md`
- `CONTRIBUTING.md`
- `.ai_context.md`

The following directories must always exist:

- `rules/` — contains this file and other binding constraints
- `plans/` — execution and rollout plans
- `specs/` — product specifications
- `tests/` — test placeholder (no automated unit test suite currently)
- `scripts/ci/` — CI enforcement scripts
- `docs/` — extended documentation

The following tool config directory must contain only configuration:

- `.claude/` — Claude Code permissions config only
- `.cursor/rules/` — Cursor AI rules in `.mdc` format (machine-generated Cursor config)

**Intentionally absent directories:**

- `functions/` — No Cloud Functions in this repo. The app is a pure static Next.js export. Firebase Hosting serves static files; Firestore security rules handle access control.
- `dist/` — Next.js output goes to `out/`, not `dist/`. Never create a `dist/` directory.

## Forbidden Patterns

- **Never push directly to `main`.** All changes must go through a pull request—even single-line fixes, documentation updates, and deploy config changes. The only exception is if the human explicitly authorizes a direct push in chat as a break-glass override.
- **Never edit `out/` directly.** It is a Next.js static export artifact. Always run `npm run build` to regenerate.
- **Never commit secrets.** Firebase web config (`NEXT_PUBLIC_FIREBASE_*`), service account keys, and ADC credentials must never be committed. Use `.env.local` files (gitignored) for local config.
- **No instruction files in tool folders.** `.claude/` and `.cursor/` must not contain plain `.md` or `.txt` instruction files. `.cursor/rules/*.mdc` is permitted (Cursor rules format, not instruction prose).
- **No duplicate documentation.** If a concept is documented in `AGENTS.md` or a canonical root file, it must not be redefined in a conflicting location.
- **No new top-level directories** without explicit justification documented in `AGENTS.md` or a `plans/` entry.
- **Do not delete tests or CI scripts to force a build to pass.**
- **One `useForm()` instance.** The `useForm<DealInputs>()` call lives in `ProductionHubClient`. Never add a second form instance in a section component.
- **No `"use client"` on server wrappers.** `app/(app)/productions/view/page.tsx` must remain a server component. Use the `*DynamicLoader` pattern for client-side rendering.
- **`DealInputs.investors` is always `[]` in Firestore.** Do not read investors from the deal form — always bridge from `useInvestors()` at the model computation site.
- **`stripUndefined()` before every Firestore write.** Firestore rejects documents with `undefined` values.

## High-Risk Modification Zones

Changes to the following files require extra scrutiny and explicit human review:

| File | Risk |
|------|------|
| `src/lib/model/calculations.ts` | Core financial engine — changes affect all model outputs and investor return calculations |
| `src/lib/model/scenarios.ts` | Scenario engine — drives all three scenarios and the sensitivity grid |
| `src/lib/model/waterfallPhase.ts` | Waterfall phase derivation — displayed in LiveOutcomePanel, WaterfallSection, DealRoomView |
| `firestore.rules` | Firestore security — incorrect rules can expose deal data or lock out legitimate users |
| `storage.rules` | Storage security — same caution |
| `src/lib/firestore.ts` | All Firestore CRUD — changes affect data integrity across the app |
| `src/contexts/AuthContext.tsx` | Auth state — breaks login/logout/route guards |

## CI Enforcement

The following checks are implemented in `scripts/ci/` and must pass before any commit is merged:

1. `check_required_root_files` — Verifies README.md, AGENTS.md, DEPLOYMENT.md, CONTRIBUTING.md, and .ai_context.md all exist at repository root
2. `check_no_tool_folder_instructions` — Verifies .claude/ and .cursor/ contain no plain .md or .txt instruction files (.mdc Cursor rules are permitted)
3. `check_no_forbidden_top_level_dirs` — Verifies no forbidden top-level directories exist
4. `check_dist_not_modified` — Verifies out/ files were not directly modified (checks `out/`, not `dist/`)
5. `check_spec_test_alignment` — Advisory: verifies specs/ files have corresponding test coverage (advisory for this repo)
6. `check_duplicate_docs` — Verifies no documentation topic is duplicated between root files and tool folders
7. `check_review_policy_exists` (inline in repo_lint.yml) — Verifies .github/review-policy.yml and REVIEW_POLICY.md both exist
