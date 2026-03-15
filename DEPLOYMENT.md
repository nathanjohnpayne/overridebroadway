# Deployment

> This guide covers deploying the existing project. For **new project setup** (create Firebase project, `firebase init`, first-time auth bootstrap), see `ai_agent_repo_template/DEPLOYMENT.md` in the sibling directory.

## Prerequisites

- [Firebase CLI](https://firebase.google.com/docs/cli) (`firebase-tools`) installed globally
- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (`gcloud`) installed
- Local `gcloud` wrapper installed on PATH (see First-Time Setup below)
- `op-firebase-deploy` and `op-firebase-setup` on PATH
- Application Default Credentials (ADC) initialized via `gcloud auth application-default login`
- Permission to impersonate `firebase-deployer@soyouthinkyouwant.iam.gserviceaccount.com`

## Environments

| Environment | Firebase Project | URL |
|-------------|-----------------|-----|
| Production | `soyouthinkyouwant` | overridebroadway.com |

There is no staging environment. All deploys go directly to production.

## Build Process

This is a Next.js app with `output: 'export'` (static export). The build must complete before deploy.

```bash
# Create .env.local first (see README.md for the required NEXT_PUBLIC_FIREBASE_* values)

# Production build (static export → out/)
npm run build
```

Build output goes to `out/`. Never edit `out/` directly.

The build pipeline runs three stages automatically:
1. `prebuild` (`scripts/prebuild.mjs`) — generates a timestamp-based build ID, writes to `.build_id`
2. `build` — Next.js static export; injects `NEXT_PUBLIC_BUILD_ID` from `.build_id`
3. `postbuild` (`scripts/postbuild.mjs`) — copies `.build_id` to `out/_build_id.txt`

## Deployment Steps

All deploys use `op-firebase-deploy` for keyless, non-interactive service account impersonation.

```bash
# Full deploy (hosting + Firestore rules + Storage rules)
npm run deploy

# Hosting only
npm run deploy:hosting

# Any target combo
op-firebase-deploy --only firestore:rules
```

The script:
1. Auto-detects the Firebase project from `.firebaserc`
2. Reads source credentials from `GOOGLE_APPLICATION_CREDENTIALS` or `~/.config/gcloud/application_default_credentials.json`
3. Generates a temporary `impersonated_service_account` credential file for `firebase-deployer@soyouthinkyouwant.iam.gserviceaccount.com`
4. Sets `GOOGLE_APPLICATION_CREDENTIALS` to that temp file and runs `firebase deploy --non-interactive`
5. Cleans up credentials on exit

No long-lived deploy key is stored locally or in 1Password. The only interactive step is refreshing local ADC if it has expired or been revoked:

```bash
gcloud auth application-default login
```

The local `gcloud` wrapper uses the same ADC source so normal `gcloud` commands work without an interactive `gcloud auth login`.

## First-Time Setup

Install the canonical helper scripts from the sibling template repo once per machine:

```bash
mkdir -p ~/.local/bin
cp ../ai_agent_repo_template/scripts/gcloud/gcloud ~/.local/bin/gcloud
cp ../ai_agent_repo_template/scripts/firebase/op-firebase-deploy ~/.local/bin/
cp ../ai_agent_repo_template/scripts/firebase/op-firebase-setup ~/.local/bin/
chmod +x ~/.local/bin/gcloud ~/.local/bin/op-firebase-deploy ~/.local/bin/op-firebase-setup
hash -r
```

Then bootstrap machine auth and project impersonation:

```bash
gcloud auth application-default login
op-firebase-setup soyouthinkyouwant
```

`op-firebase-setup` is the legacy script name, but it now performs keyless setup. For this project it:
1. Enables the IAM Credentials API
2. Creates `firebase-deployer@soyouthinkyouwant.iam.gserviceaccount.com` if needed
3. Grants deploy roles to that service account
4. Grants your current principal `roles/iam.serviceAccountTokenCreator` on the deployer
5. Creates or updates a dedicated `gcloud` configuration named `soyouthinkyouwant`

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

When connecting CI, prefer Workload Identity Federation or another `external_account` credential as the source ADC. If CI already exposes `GOOGLE_APPLICATION_CREDENTIALS` pointing at an `external_account` file, `op-firebase-deploy` can reuse it to impersonate the deployer service account.

## Secrets Management

- Real Firebase web config (`NEXT_PUBLIC_FIREBASE_*`) is stored only in local `.env.local` files (gitignored). Never hardcode live values in `src/lib/firebase.ts`, documentation, or committed config.
- `NEXT_PUBLIC_FIREBASE_API_KEY` is a browser key — not the auth boundary, but committing it triggers abuse alerts and quota exposure.
- Deploy auth uses short-lived impersonated credentials derived from local ADC or CI-provided external-account credentials.

### Credential Rotation

If a browser API key is exposed:
1. Remove from tracked files and build artifacts
2. If it was public, rewrite git history and force-push before making the repo public
3. Create a replacement browser key in Google Cloud Credentials with the same restrictions (HTTP referrers: `overridebroadway.com`, `localhost`, Firebase API allowlist)
4. Update local `.env.local`, rebuild and redeploy
5. Verify the live bundle serves the new key only, then delete the old key

For future services requiring secrets, commit only template files with `op://` references and resolve them with `op inject` into a gitignored runtime file at deploy time. Never commit the resolved output.

## Auth Maintenance

If local ADC has expired, been revoked, or is missing:

```bash
gcloud auth application-default login
```

If deploy impersonation breaks because IAM bindings or `gcloud` config drifted, rerun:

```bash
op-firebase-setup soyouthinkyouwant
```

## Google OAuth / Custom Domain

For Google sign-in to work on `overridebroadway.com`:
1. Firebase Console → Authentication → Settings → Authorized domains: add `overridebroadway.com`
2. Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID → Authorized JavaScript origins: add `https://overridebroadway.com`

Both must be configured. Missing either causes OAuth failures on the custom domain.
