# Testing Requirements

- Run `npm run build` after code changes — static export must succeed.
- Run `npm run lint` — no ESLint errors.
- There is no automated unit test suite. When modifying financial calculations, test manually:
  1. Create a test production in the app
  2. Verify deal inputs save and reload correctly via Firestore
  3. Verify the financial model renders expected outputs for known inputs
  4. Test autosave (wait 1.5s after edit, verify Firestore is updated)
  5. Test deal room share flow end-to-end
- Leave clear notes in your final response about what was and was not manually verified.
- **Do not delete tests or CI scripts to force a build to pass.**

### CI Scripts

Run these before opening a PR:

```bash
scripts/ci/check_required_root_files
scripts/ci/check_no_tool_folder_instructions
scripts/ci/check_no_forbidden_top_level_dirs
scripts/ci/check_dist_not_modified
scripts/ci/check_spec_test_alignment
scripts/ci/check_duplicate_docs
```

---
