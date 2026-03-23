# Documentation Rules

- **No duplicate documentation.** Do not redefine topics already covered in `AGENTS.md` / `docs/agents/`, `DEPLOYMENT.md`, `CONTRIBUTING.md`, or `.ai_context.md`.
- **Code vs. docs disagreement:** Trust the implementation first, then update documentation to match or explicitly call out the gap.
- **`rules/repo_rules.md`** is the authoritative list of structure invariants and CI checks.
- **`.claude/` must not contain instruction files.** Only machine-generated config (`.claude/settings.local.json` is permitted).
- **`.cursor/rules/*.mdc`** files are valid Cursor AI rules config — not instruction prose. Do not flag or modify them.
- **New top-level directories** require explicit justification documented in `AGENTS.md` or a `plans/` entry.

---
