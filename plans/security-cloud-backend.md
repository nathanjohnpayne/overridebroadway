# Backend quota boundary

The owner selected public signup with backend-enforced quotas on 2026-10-03 for #189. The new `functions/` directory contains the Firebase callable mutation service that is required to enforce this choice. Static Next.js rendering and Firebase client reads remain in place. This supersedes the prior no-Cloud-Functions architectural constraint in `rules/repo_rules.md`.

Deploy requires a coordinated backend, Hosting, Firestore rules and Storage rules release, after existing Storage usage has been reconciled into private quota documents. Do not enable the deny-client-write rules against an old frontend or enable the backend against permissive old rules. Review the cutover and maintenance window with the owner before deploying.

Use a dedicated runtime service account with only Firestore data access and this project's Storage object access. Deploy authentication continues to use the established 1Password-backed process. Firebase Storage's cross-service rules require its service agent to have Firestore read access; verify that prerequisite during deployment.

Before cutover, inventory all objects under `productions/{uid}/` and set each user's `mutationQuotas/{uid}` `files` and `bytes` to at least the object count and aggregate stored bytes. Allocation accounting is conservative and does not decrement on deletion or failed/expired upload reservations. Accounts already above a limit retain reads and deletion but receive no new allocations. Record the inventory and readback before enabling uploads. Backend queries count existing production, investor, scenario, pool and room documents, so these collections do not need untrusted client counters.

Production IDs and tokens deleted before this release cannot be retrospectively reserved from current Firestore alone. If historical tokens or production IDs must remain unusable, recover their inventory from backups/audit records and create reservations before cutover. No historical backfill or production mutation is performed by this PR.

Validate callable authentication, ordinary producer save and deletion, share/deactivate/reactivate, new immutable uploads, expired/replayed upload denial, quota boundaries and deployment readback in a staging project first. Public account creation still permits Sybil accounts; per-user quotas do not claim a project-wide spending cap.
