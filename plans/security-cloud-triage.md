# Security Cloud notification triage

Readback: 2026-10-03. Security Cloud returned 68 visible findings, without pagination remaining. Shared tooling findings are routed to MergePath; application or repository-specific data, CI and content findings remain owned by their reported project. Historical commit-scan findings are observations to validate, not confirmed-current deployed vulnerabilities.

Override Broadway fixes cover #188, #189 and #190. Current source baseline: `157e17875bc6c61a998cc5722b947cdf38a10ad9`. Shared surfaces were identified against MergePath's propagation manifest and canonical helper/workflow ownership. Other projects' application findings were classified but are outside the requested Override Broadway implementation scope.

| Reported repository | Finding | Owner and tracking |
|---|---|---|
| nathanpaynedotcom | Mutable Authoring-Agent claim lets same-agent approval masquerade as cross-agent review | [MergePath issue](https://github.com/nathanjohnpayne/mergepath/issues/928) |
| nathanpaynedotcom | A stale Codex reaction can clear a later unreviewed PR head | [MergePath issue](https://github.com/nathanjohnpayne/mergepath/issues/1751) |
| nathanpaynedotcom | Short commit-prefix matching lets a colliding head reuse a clean verdict | [MergePath issue](https://github.com/nathanjohnpayne/mergepath/issues/1752) |
| nathanpaynedotcom | Mutable PR diff fetch permits an A-B-A head swap during Phase 4b review | [MergePath issue](https://github.com/nathanjohnpayne/mergepath/issues/1753) |
| nathanpaynedotcom | Workflow-dispatch date inputs execute shell code in a PAT-bearing step | [MergePath issue](https://github.com/nathanjohnpayne/mergepath/issues/1764) |
| nathanpaynedotcom | Candidate-controlled pull-request workflows expose reviewer PATs and execute untrusted code | [MergePath issue](https://github.com/nathanjohnpayne/mergepath/issues/1765) |
| overridebroadway | Fork artifact can mint trusted relay-completion evidence and neutralize archive failure | [MergePath issue](https://github.com/nathanjohnpayne/mergepath/issues/1053) |
| overridebroadway | Mutable Authoring-Agent claim defeats cross-agent approval independence | [MergePath issue](https://github.com/nathanjohnpayne/mergepath/issues/928) |
| overridebroadway | Repository-local pre-tool hooks execute mutable branch code in credential-bearing review sessions | [MergePath issue](https://github.com/nathanjohnpayne/mergepath/issues/1758) |
| overridebroadway | Newline-containing Git paths collide in the external-review fingerprint | [MergePath issue](https://github.com/nathanjohnpayne/mergepath/issues/1759) |
| gaycruisebingo | Proof upload trigger can flag other users' proofs | Reported project; no implementation in this task |
| gaycruisebingo | Workflow dispatch inputs allow shell injection | [MergePath issue](https://github.com/nathanjohnpayne/mergepath/issues/1764) |
| gaycruisebingo | Day snapshots can be altered by hiding item docs | Reported project; no implementation in this task |
| gaycruisebingo | Vision trigger can flag other users' proofs | Reported project; no implementation in this task |
| gaycruisebingo | Client-writable day honors can be squatted | Reported project; no implementation in this task |
| nathanpaynedotcom | Required-check publishers can overwrite newer holds with stale success | [MergePath issue](https://github.com/nathanjohnpayne/mergepath/issues/1766) |
| nathanpaynedotcom | Candidate workflows can forge the propagation-lane exemption | [MergePath issue](https://github.com/nathanjohnpayne/mergepath/issues/1754) |
| nathanpaynedotcom | Deployment builds run with Firebase, Cloudflare, and GitHub credentials | [MergePath issue](https://github.com/nathanjohnpayne/mergepath/issues/1755) |
| nathanpaynedotcom | Downloaded yq binary is installed and executed without integrity verification | [MergePath issue](https://github.com/nathanjohnpayne/mergepath/issues/1756) |
| nathanpaynedotcom | PR diff instructions can manipulate merge-authoritative Phase 4b verdicts | [MergePath issue](https://github.com/nathanjohnpayne/mergepath/issues/1757) |
| nathanpaynedotcom | Public project hero exposes third-party identities and financial data | Reported project; no implementation in this task |
| overridebroadway | Re-created production IDs inherit access to orphaned subcollection records | [Override Broadway issue](https://github.com/nathanjohnpayne/overridebroadway/issues/188) |
| overridebroadway | Self-service accounts can allocate unbounded aggregate Firestore and Storage resources | [Override Broadway issue](https://github.com/nathanjohnpayne/overridebroadway/issues/189) |
| overridebroadway | Deleted deal-room tokens can be re-registered by another producer | [Override Broadway issue](https://github.com/nathanjohnpayne/overridebroadway/issues/190) |
| overridebroadway | Workflow relay writes a required check to an artifact-selected commit before head validation | [MergePath issue](https://github.com/nathanjohnpayne/mergepath/issues/1760) |
| overridebroadway | Pull-request head ref is interpolated into privileged workflow shell source | [MergePath issue](https://github.com/nathanjohnpayne/mergepath/issues/1761) |
| overridebroadway | Fork artifact can amplify one relay event into unbounded privileged comment writes | [MergePath issue](https://github.com/nathanjohnpayne/mergepath/issues/1762) |
| gaycruisebingo | Bug report idempotent retries bypass rate limit | Reported project; no implementation in this task |
| gaycruisebingo | Auth handoff exchange allows unauthenticated read DoS | Reported project; no implementation in this task |
| gaycruisebingo | Unvalidated analytics IDs can poison Firestore trigger retries | Reported project; no implementation in this task |
| gaycruisebingo | Unbounded user writes can spam admin alert digests | Reported project; no implementation in this task |
| gaycruisebingo | Most-Loved freeze can count post-cutoff proof rebinding | Reported project; no implementation in this task |
| gaycruisebingo | Unauthenticated event preview metadata exposure | Reported project; no implementation in this task |
| gaycruisebingo | Trusted OAuth redirect on mutable preview branch | Reported project; no implementation in this task |
| gaycruisebingo | Echo proofs bypass admin-confirmed review | Reported project; no implementation in this task |
| gaycruisebingo | Hearts can expose non-public proof references | Reported project; no implementation in this task |
| gaycruisebingo | Proof media deletion bypassed by immutable caching | Reported project; no implementation in this task |
| gaycruisebingo | PostHog replays routed to personal-domain proxy | Reported project; no implementation in this task |
| gaycruisebingo | Pull request CI leaves read token exposed to PR code | Reported project; no implementation in this task |
| gaycruisebingo | Persistent Firestore cache survives logout | Reported project; no implementation in this task |
| gaycruisebingo | Signed-in users can squat and spam Feed moments | Reported project; no implementation in this task |
| gaycruisebingo | Undeduped reports let one user auto-hide content | Reported project; no implementation in this task |
| gaycruisebingo | Unbounded leaderboard names can DoS share-card rendering | Reported project; no implementation in this task |
| gaycruisebingo | Orphan proof uploads can spam admin moderation emails | Reported project; no implementation in this task |
| gaycruisebingo | Single reporter can auto-hide any prompt or proof | Reported project; no implementation in this task |
| gaycruisebingo | Unmasked PostHog replay exposes sensitive user content | Reported project; no implementation in this task |
| gaycruisebingo | Malformed dayStats can crash leaderboard clients | Reported project; no implementation in this task |
| gaycruisebingo | Tally feed trusts unvalidated marker metadata | Reported project; no implementation in this task |
| gaycruisebingo | Oversized player names can suppress finale moments | Reported project; no implementation in this task |
| gaycruisebingo | Unvalidated tally markers can inject Feed cards | Reported project; no implementation in this task |
| nathanpaynedotcom | Untrusted commenters can amplify content into bot-authored archive comments | [MergePath issue](https://github.com/nathanjohnpayne/mergepath/issues/1767) |
| overridebroadway | CI bootstrap installs and executes a mutable release binary without integrity verification | [MergePath issue](https://github.com/nathanjohnpayne/mergepath/issues/1756) |
| gaycruisebingo | Recovery accepts impersonable publisher accounts | Reported project; no implementation in this task |
| gaycruisebingo | Notice bylines can be forged by admins | Reported project; no implementation in this task |
| gaycruisebingo | Re-snapshot zero-board guard is racy | Reported project; no implementation in this task |
| gaycruisebingo | Multiple day cards can be reshuffled for one allowance | Reported project; no implementation in this task |
| gaycruisebingo | web.app logout can re-open a firebaseapp.com session | Reported project; no implementation in this task |
| gaycruisebingo | Attestation gate can lift without persisted stamp | Reported project; no implementation in this task |
| gaycruisebingo | Auth bootstrap timeout can fail open into app shell | Reported project; no implementation in this task |
| gaycruisebingo | Disabled pledge can bypass proof-required claims | Reported project; no implementation in this task |
| gaycruisebingo | Day schedule lock skips days after index 9 | Reported project; no implementation in this task |
| gaycruisebingo | Mirror verification command crashes on undefined Python variable | Reported project; no implementation in this task |
| gaycruisebingo | Project board script skips token identity check | [MergePath issue](https://github.com/nathanjohnpayne/mergepath/issues/1768) |
| gaycruisebingo | Stale web.app handoff URL after in-app navigation | Reported project; no implementation in this task |
| gaycruisebingo | Alias sign-in can hang without AbortController timeout | Reported project; no implementation in this task |
| gaycruisebingo | Archive can corrupt bug-report import ledger | Reported project; no implementation in this task |
| gaycruisebingo | Unknown first-bingo mark can restamp stale server wins | Reported project; no implementation in this task |
| gaycruisebingo | Daily proof writes use cruise-wide first-bingo time | Reported project; no implementation in this task |

The yq notification was consolidated into existing MergePath #1756; duplicate #1763 was closed. Existing #928 tracks attribution, but its current session-environment proposal is weaker than the Security Cloud request for immutable authenticated attribution; that distinction is included in the evidence comment.

Production deployment, historical reservation backfill and Storage quota reconciliation are pending owner-reviewed cutover. Findings remain open in Security Cloud.

