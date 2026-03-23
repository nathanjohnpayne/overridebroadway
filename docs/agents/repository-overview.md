# Repository Overview

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
