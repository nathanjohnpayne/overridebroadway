# Deployment

> This guide covers deploying the existing project. For **new project setup** (create Firebase project, `firebase init`, first-time auth bootstrap), see `ai_agent_repo_template/DEPLOYMENT.md` in the sibling directory.

## Prerequisites

- [Firebase CLI](https://firebase.google.com/docs/cli) (`firebase-tools`) installed globally
- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (`gcloud`) installed
- [1Password CLI](https://developer.1password.com/docs/cli/) (`op`) installed and signed in
- Local `gcloud` wrapper installed on PATH (see First-Time Setup below)
- `op-firebase-deploy` and `op-firebase-setup` on PATH
- Access to the shared 1Password source credential `op://Private/GCP ADC/credential` or another explicit `GOOGLE_APPLICATION_CREDENTIALS` file
- Permission to impersonate `firebase-deployer@soyouthinkyouwant.iam.gserviceaccount.com`

## Machine User Setup (New Project)

When creating a new repository from this template, complete these steps to enable the AI agent cross-review system. All steps are manual (human-only) unless noted.

### 1. Add machine users as collaborators

Go to the new repo → Settings → Collaborators → Invite each:

- `nathanpayne-claude` — Write access
- `nathanpayne-codex` — Write access
- `nathanpayne-cursor` — Write access

### 2. Accept collaborator invitations

Log into each machine user account and accept the invitation:

- https://github.com/notifications (as `nathanpayne-claude`)
- https://github.com/notifications (as `nathanpayne-codex`)
- https://github.com/notifications (as `nathanpayne-cursor`)

Alternatively, use `gh` CLI or the invite URL directly: `https://github.com/{owner}/{repo}/invitations`

**Note:** Fine-grained PATs cannot accept invitations via API. Use the browser or a classic PAT with `repo` scope.

### 3. Store PATs as repository secrets

Go to the new repo → Settings → Secrets and variables → Actions → New repository secret. Add:

| Secret name | Value |
|---|---|
| `CLAUDE_PAT` | Fine-grained PAT for `nathanpayne-claude` (from 1Password: `GitHub PAT (pr-review-claude)`) |
| `CODEX_PAT` | Fine-grained PAT for `nathanpayne-codex` (from 1Password: `GitHub PAT (pr-review-codex)`) |
| `CURSOR_PAT` | Fine-grained PAT for `nathanpayne-cursor` (from 1Password: `GitHub PAT (pr-review-cursor)`) |
| `REVIEWER_ASSIGNMENT_TOKEN` | PAT for `nathanjohnpayne` (from 1Password: `GitHub PAT (pr-review-nathanjohnpayne)`) |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude Code headless review |
| `OPENAI_API_KEY` | OpenAI API key for Codex headless review |

Or use the CLI (faster):

```bash
# From 1Password references — replace with actual values
gh secret set CLAUDE_PAT --repo {owner}/{repo} --body "$(op read 'op://Private/GitHub PAT (pr-review-claude)/token')"
gh secret set CODEX_PAT --repo {owner}/{repo} --body "$(op read 'op://Private/GitHub PAT (pr-review-codex)/token')"
gh secret set CURSOR_PAT --repo {owner}/{repo} --body "$(op read 'op://Private/GitHub PAT (pr-review-cursor)/token')"
gh secret set REVIEWER_ASSIGNMENT_TOKEN --repo {owner}/{repo} --body "$(op read 'op://Private/GitHub PAT (pr-review-nathanjohnpayne)/token')"
gh secret set ANTHROPIC_API_KEY --repo {owner}/{repo} --body "$(op read 'op://Private/Anthropic API Key/credential')"
gh secret set OPENAI_API_KEY --repo {owner}/{repo} --body "$(op read 'op://Private/OpenAI API Key/credential')"
```

### 4. Configure branch protection

Go to the new repo → Settings → Branches → Add branch protection rule for `main`:

1. **Require pull request reviews before merging:** Yes
2. **Required number of approving reviews:** 1
3. **Dismiss stale pull request approvals when new commits are pushed:** Yes
4. **Require status checks to pass before merging:** Yes
   - Add `Self-Review Required`
   - Add `Label Gate`
5. **Do not allow bypassing the above settings:** Disabled (so Nathan can force-merge in emergencies)

Or use the CLI:

```bash
gh api --method PUT "repos/{owner}/{repo}/branches/main/protection" \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "checks": [
      {"context": "Self-Review Required"},
      {"context": "Label Gate"}
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "required_approving_review_count": 1
  },
  "restrictions": null
}
EOF
```

**Note:** Branch protection requires the repo to be public, or requires GitHub Pro/Team for private repos.

### 5. Create required labels

The workflows expect these labels to exist. Create them if they don't:

```bash
gh label create "needs-external-review" --color "D93F0B" --description "Blocks merge until external reviewer approves" --repo {owner}/{repo}
gh label create "needs-human-review" --color "B60205" --description "Agent disagreement — requires human review" --repo {owner}/{repo}
gh label create "policy-violation" --color "000000" --description "Review policy violation detected" --repo {owner}/{repo}
gh label create "audit" --color "FBCA04" --description "Weekly PR audit report" --repo {owner}/{repo}
```

### 6. Verify setup

Run these checks after completing the steps above:

```bash
REPO="{owner}/{repo}"

# Check collaborators
echo "=== Collaborators ==="
gh api "repos/$REPO/collaborators" --jq '.[].login'

# Check secrets exist
echo "=== Secrets ==="
gh secret list --repo "$REPO"

# Check branch protection
echo "=== Branch Protection ==="
DEFAULT=$(gh api "repos/$REPO" --jq '.default_branch')
gh api "repos/$REPO/branches/$DEFAULT/protection/required_status_checks" --jq '.checks[].context'

# Check labels
echo "=== Labels ==="
gh label list --repo "$REPO" --search "needs-external-review"
gh label list --repo "$REPO" --search "needs-human-review"
gh label list --repo "$REPO" --search "policy-violation"
```

### Token rotation (as needed)

The current PATs are set to never expire. If you ever need to rotate them:

1. Generate new fine-grained PATs for each machine user account
2. Update the tokens in 1Password
3. Update `CLAUDE_PAT`, `CODEX_PAT`, `CURSOR_PAT` secrets on every repo
4. Revoke the old tokens
5. Verify agent access still works

The `REVIEWER_ASSIGNMENT_TOKEN` (Nathan's PAT) follows the same rotation process.

---

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
2. Reads source credentials from `GOOGLE_APPLICATION_CREDENTIALS`, then `op://Private/GCP ADC/credential`, then `~/.config/gcloud/application_default_credentials.json`
3. Generates a temporary `impersonated_service_account` credential file for `firebase-deployer@soyouthinkyouwant.iam.gserviceaccount.com`
4. Sets `GOOGLE_APPLICATION_CREDENTIALS` to that temp file and runs `firebase deploy --non-interactive`
5. Cleans up credentials on exit

No browser prompt is needed for routine use once `op://Private/GCP ADC/credential` exists and the 1Password CLI is unlocked.

This 1Password-first source-credential model is a deliberate project decision. Do not replace it with ADC-first day-to-day docs, routine browser-login steps, `firebase login`, or long-lived deploy keys unless a human explicitly asks for that change.

The local `gcloud` wrapper uses the same source-credential precedence, then resolves quota attribution in this order: explicit `--billing-project`, explicit `--project`, the nearest repo `.firebaserc` project, then the active `gcloud` config.

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

Then bootstrap project impersonation:

```bash
op-firebase-setup soyouthinkyouwant
```

If `op://Private/GCP ADC/credential` does not exist yet, seed it once by running `gcloud auth application-default login`, then copy the resulting `~/.config/gcloud/application_default_credentials.json` into the 1Password item `Private/GCP ADC`, field `credential`.

`op-firebase-setup` is the legacy script name, but it now performs keyless setup. For this project it:
1. Enables the IAM Credentials API
2. Creates `firebase-deployer@soyouthinkyouwant.iam.gserviceaccount.com` if needed
3. Grants deploy roles to that service account
4. Grants your current principal `roles/iam.serviceAccountTokenCreator` on the deployer
5. Creates or updates a dedicated `gcloud` configuration named `soyouthinkyouwant`, including `billing/quota_project=soyouthinkyouwant`

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

Deploys are manual via `op-firebase-deploy`. CI workflows (repo linting, review policy enforcement) run on push/PR via GitHub Actions — see `.github/workflows/`.

When connecting CI, prefer Workload Identity Federation or another `external_account` credential as the source credential. If CI already exposes `GOOGLE_APPLICATION_CREDENTIALS` pointing at an `external_account` file, `op-firebase-deploy` can reuse it to impersonate the deployer service account.

## Secrets Management

- Real Firebase web config (`NEXT_PUBLIC_FIREBASE_*`) is stored only in local `.env.local` files (gitignored). Never hardcode live values in `src/lib/firebase.ts`, documentation, or committed config.
- `NEXT_PUBLIC_FIREBASE_API_KEY` is a browser key — not the auth boundary, but committing it triggers abuse alerts and quota exposure.
- Deploy auth uses short-lived impersonated credentials derived from a 1Password-backed GCP ADC source credential, another explicit `GOOGLE_APPLICATION_CREDENTIALS` file, or CI-provided external-account credentials.

### Credential Rotation

If a browser API key is exposed:
1. Remove from tracked files and build artifacts
2. If it was public, rewrite git history and force-push before making the repo public
3. Create a replacement browser key in Google Cloud Credentials with the same restrictions (HTTP referrers: `overridebroadway.com`, `localhost`, Firebase API allowlist)
4. Update local `.env.local`, rebuild and redeploy
5. Verify the live bundle serves the new key only, then delete the old key

For future services requiring secrets, commit only template files with `op://` references and resolve them with `op inject` into a gitignored runtime file at deploy time. Never commit the resolved output.

## Auth Maintenance

If day-to-day auth stops working, first make sure the 1Password CLI is signed in and `op://Private/GCP ADC/credential` is readable.

If deploy impersonation breaks because IAM bindings or `gcloud` config drifted, rerun:

```bash
op-firebase-setup soyouthinkyouwant
```

If the shared source credential itself needs rotation, refresh it once with `gcloud auth application-default login`, overwrite the `Private/GCP ADC` item with the new `application_default_credentials.json`, and, if desired, align its own quota project with:

```bash
gcloud auth application-default set-quota-project soyouthinkyouwant
```

## Google OAuth / Custom Domain

For Google sign-in to work on `overridebroadway.com`:
1. Firebase Console → Authentication → Settings → Authorized domains: add `overridebroadway.com`
2. Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID → Authorized JavaScript origins: add `https://overridebroadway.com`

Both must be configured. Missing either causes OAuth failures on the custom domain.
