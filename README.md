# Override

Override is the financial operating platform for Broadway producers—from modeling your capitalization to managing investors, tracking recoupment, and distributing returns.

**Live at**: [overridebroadway.com](https://overridebroadway.com)

## Features

- **Deal Builder**—Guided or direct-edit workflow for structuring Broadway production deals (capitalization, weekly economics, revenue, royalties, waterfall)
- **Financial Model**—Real-time per-week P&L projections with breakeven analysis, IRR calculation, and investor return modeling
- **Scenario Analysis**—Bear/Base/Bull scenario comparison with an occupancy × run-length sensitivity grid
- **Capitalization Management**—Full investor cap table with status tracking, document management, and producer pool organization
- **Deal Room**—Public, token-secured investor workspace with snapshotted deal economics (no login required)
- **Waterfall Engine**—Configurable recoup-first or share-from-dollar-one distribution structures with GP fee layering

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, static export) |
| Language | TypeScript (strict) |
| UI | Tailwind CSS v4 + shadcn/ui + Lucide |
| Charts | Recharts 3 |
| Forms | react-hook-form |
| State | Zustand (persist middleware) |
| Backend | Firebase (Auth, Firestore, Storage, Analytics) |
| Hosting | Firebase Hosting |

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- Firebase CLI (`npm install -g firebase-tools`)
- Google Cloud SDK (`gcloud`) for deploy-auth bootstrap / ADC refresh

### Setup

1. Clone the repository:

```bash
git clone https://github.com/your-org/overridebroadway.git
cd overridebroadway
```

2. Install dependencies:

```bash
npm install
```

3. Create `.env.local` with your Firebase config:

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=soyouthinkyouwant.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=soyouthinkyouwant
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=soyouthinkyouwant.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=777571271688
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

Get these values from: Firebase Console → Project Settings → Your Apps → Web App config.

4. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Static export to `out/` (includes prebuild/postbuild scripts) |
| `npm run lint` | Run ESLint |
| `npm run deploy` | Deploy hosting + Firestore rules + Storage rules via keyless impersonation |
| `npm run deploy:hosting` | Deploy hosting only via keyless impersonation |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages and components
│   ├── (auth)/             # Login and signup (public)
│   ├── (app)/              # Authenticated routes (dashboard, production hub)
│   └── deal-room/          # Public investor-facing deal room
├── components/             # Shared components (analytics, update checker, shadcn/ui)
├── contexts/               # React context providers (auth)
├── hooks/                  # Custom hooks (productions, deal inputs, investors, pools)
├── lib/                    # Firebase integration, Firestore CRUD, storage, utilities
│   └── model/              # Financial engine (calculations, scenarios, waterfall, formatters)
├── stores/                 # Zustand stores (UI state)
└── types/                  # TypeScript type definitions
```

## Documentation

- **[AGENTS.md](./AGENTS.md)**—Comprehensive project documentation covering architecture, financial model, data model, types, industry benchmarks, and development guidelines
- **[ARCHITECTURE.md](./ARCHITECTURE.md)**—Onboarding guide with system overview, routing model, and common change patterns

## Firebase Project

- **Project ID**: soyouthinkyouwant
- **Auth providers**: Email/Password, Google
- **Custom domain**: overridebroadway.com

## Credential Hygiene & Rotation

- Keep real `NEXT_PUBLIC_FIREBASE_*` values in `.env.local`, not in tracked source.
- The Firebase Web API key is not the auth boundary, but checking it into source is still a security concern because public exposure triggers Google abuse alerts and noisy quota usage.
- Keep browser-key restrictions enabled in Google Cloud Credentials.
- If a browser key is exposed: remove it from source/history, create a replacement key with the same referrer/API restrictions, update `.env.local`, redeploy, verify the live site uses the new key, then delete the old key.
- Deploy auth uses short-lived impersonated credentials. If local auth stops working, rerun `gcloud auth application-default login`; if IAM bindings drift, rerun `op-firebase-setup soyouthinkyouwant`.

## Deploy Auth & Future Secret Flow

- First-time setup for deploy maintainers: `gcloud auth application-default login` then `op-firebase-setup soyouthinkyouwant`
- Day-to-day deploys: `npm run deploy` or `npm run deploy:hosting`
- `op-firebase-deploy` keeps the old name for compatibility, but it now creates a short-lived impersonated credential for `firebase-deployer@soyouthinkyouwant.iam.gserviceaccount.com` from local ADC.
- Future APIs or services should use committed template files with `op://Private/<item>/<field>` references and `op inject` into gitignored runtime files during deploy

## License

Private—All rights reserved.
