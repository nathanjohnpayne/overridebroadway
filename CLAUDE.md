Read these files before taking any action in this repository:

1. `AGENTS.md` — behavioral rules and operating instructions
2. `rules/repo_rules.md` — binding structural constraints
3. Relevant `specs/` files — intended system behavior
4. `DEPLOYMENT.md` — deploy process and credential setup
5. `.ai_context.md` — supplemental context

If any of these files are missing, flag the gap before proceeding.

# Code Review

Before creating, reviewing or merging a PR, read [REVIEW_POLICY.md](REVIEW_POLICY.md) and [.github/review-policy.yml](.github/review-policy.yml), together with the Code Review Policy section in [AGENTS.md](AGENTS.md). Those files govern the complete workflow, including identity-checked author/reviewer wrappers, credential handling, review scope, feedback and conversation accounting, required checks and merge authorization. This entrypoint does not maintain a separate checklist.

For Claude cloud sessions, also read [Cloud Agent Environments](docs/agents/cloud-environments.md) and run its capability probe before selecting a transport or writing. It governs provisioned credentials, the approved signed cloud committer and the wrapped REST path where the proxy refuses `gh pr` commands. Use the applicable local or cloud credential path; the cloud guide takes precedence over local-only preflight examples.
