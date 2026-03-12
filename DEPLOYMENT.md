# Deployment

## Prerequisites

- [Firebase CLI](https://firebase.google.com/docs/cli) (`firebase-tools`) installed globally
- [1Password CLI](https://developer.1password.com/docs/cli/) (`op`) installed and signed in
- Google Cloud SDK (`gcloud`) installed
- `op-firebase-deploy` script on PATH (see First-Time Setup below)
- Access to the `Private` vault in 1Password: `Private/Firebase Deploy - soyouthinkyouwant` and `Private/GCP ADC`

## Environments

| Environment | Firebase Project | URL |
|-------------|-----------------|-----|
| Production | `soyouthinkyouwant` | overridebroadway.com |

There is no staging environment. All deploys go directly to production.

## Build Process

This is a Next.js app with `output: 'export'` (static export). The build must complete before deploy.

```bash
# Source environment variables first
cp .env.local.example .env.local  # first time; fill in real values
# (or export NEXT_PUBLIC_FIREBASE_* vars)

# Production build (static export → out/)
npm run build
```

Build output goes to `out/`. Never edit `out/` directly.

The build pipeline runs three stages automatically:
1. `prebuild` (`scripts/prebuild.mjs`) — generates a timestamp-based build ID, writes to `.build_id`
2. `build` — Next.js static export; injects `NEXT_PUBLIC_BUILD_ID` from `.build_id`
3. `postbuild` (`scripts/postbuild.mjs`) — copies `.build_id` to `out/_build_id.txt`

## Deployment Steps

All deploys use `op-firebase-deploy` for non-interactive 1Password auth.

```bash
# Full deploy (hosting + Firestore rules + Storage rules)
npm run deploy

# Hosting only
npm run deploy:hosting

# Any target combo
op-firebase-deploy --only firestore:rules
```

The script:
1. Reads the service account key from 1Password (`Private/Firebase Deploy - soyouthinkyouwant`), falling back to `Private/GCP ADC`
2. Auto-detects the Firebase project from `.firebaserc`
3. Runs `firebase deploy --non-interactive`
4. Cleans up credentials on exit

The only interactive step is the 1Password biometric prompt (Touch ID). No `firebase login` or browser prompts needed.

## First-Time Setup

```bash
op-firebase-setup soyouthinkyouwant
```

Creates `firebase-deployer@soyouthinkyouwant.iam.gserviceaccount.com`, grants deploy roles, generates a key, and stores it in 1Password as `Firebase Deploy - soyouthinkyouwant`. Run once per machine.

## Token Renewal

The ADC refresh token has no fixed expiry but is revoked on Google password change, explicit revocation, or 6 months of inactivity. If deploys fail with `invalid_grant`:

```bash
gcloud auth application-default login --project=soyouthinkyouwant
op item edit "GCP ADC" --vault Private \
  "credential=$(cat ~/.config/gcloud/application_default_credentials.json)"
```

## Rollback Procedure

Firebase Hosting supports instant rollback:

```bash
# List recent releases
firebase hosting:releases:list

# Roll back via CLI
firebase hosting:channel:deploy live --release-id <VERSION_ID>
```

Or use the Firebase Console → Hosting → Release History → Roll back.

## Post-Deployment Verification

1. Open `overridebroadway.com` in an incognito window
2. Sign in with email or Google OAuth — confirm authentication works
3. Navigate to Dashboard — confirm productions load
4. Open a production and load the Deal Builder — confirm deal inputs and model render
5. Open a Deal Room via share link — confirm public access with no login
6. Check browser DevTools → Console for errors
7. Confirm `UpdateChecker` polling works (new deploy should prompt users to refresh)

## CI/CD Integration

No CI/CD pipeline is currently configured. Deploys are manual via `npm run deploy`.

## Secrets Management

- Real Firebase web config (`NEXT_PUBLIC_FIREBASE_*`) is stored only in local `.env.local` files (gitignored). Never hardcode live values in `src/lib/firebase.ts`, documentation, or committed config.
- `NEXT_PUBLIC_FIREBASE_API_KEY` is a browser key — not the auth boundary, but committing it triggers abuse alerts and quota exposure.
- Service account credentials are stored exclusively in 1Password.

### Credential Rotation

If a browser API key is exposed:
1. Remove from tracked files and build artifacts
2. If it was public, rewrite git history and force-push before making the repo public
3. Create a replacement browser key in Google Cloud Credentials with the same restrictions (HTTP referrers: `overridebroadway.com`, `localhost`, Firebase API allowlist)
4. Update local `.env.local`, rebuild and redeploy
5. Verify the live bundle serves the new key only, then delete the old key

If the deploy ADC credential (`Private/GCP ADC`) goes stale:
```bash
gcloud auth application-default login --project=soyouthinkyouwant
# Then update the 1Password item
```

For future services requiring secrets, commit only template files with `op://` references and resolve them with `op inject` into a gitignored runtime file at deploy time. Never commit the resolved output.

## Google OAuth / Custom Domain

For Google sign-in to work on `overridebroadway.com`:
1. Firebase Console → Authentication → Settings → Authorized domains: add `overridebroadway.com`
2. Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID → Authorized JavaScript origins: add `https://overridebroadway.com`

Both must be configured. Missing either causes OAuth failures on the custom domain.
