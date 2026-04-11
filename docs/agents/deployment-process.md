# Deployment Process

See `DEPLOYMENT.md` for full instructions.

Deploy requires `firebase-tools`, Google Cloud SDK (`gcloud`), the local `gcloud` wrapper, and access to impersonate `firebase-deployer@soyouthinkyouwant.iam.gserviceaccount.com`.

The 1Password-first deploy-auth model is a deliberate repository invariant. Do not switch this repo back to ADC-first, routine browser-login, `firebase login`, or long-lived deploy-key auth without explicit human approval.

- If credential preflight was run at session start (`scripts/op-preflight.sh --mode all`),
  deploy credentials are already cached in `GOOGLE_APPLICATION_CREDENTIALS`. No additional
  biometric prompt is needed for deployment.

If an `op` command fails with a sign-in or biometric error during deploy, follow the pause-and-prompt procedure in [operating-rules.md](operating-rules.md#1password-cli-authentication-failures). Do not retry or work around the failure without the human present.

```bash
# Full deploy (hosting + Firestore rules + Storage rules)
npm run deploy

# Hosting only
npm run deploy:hosting
```

**First-time setup:**
```bash
op-firebase-setup soyouthinkyouwant
```

**Environment variables** — required in `.env.local` (never commit real values):
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=soyouthinkyouwant.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=soyouthinkyouwant
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=soyouthinkyouwant.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=777571271688
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

---
