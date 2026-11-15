### Phase 5: Verify with quality gates + critical review

Run the five quality gates listed above. Then walk the critical review checklist:

**Safety**:
- [ ] No functional logic accidentally removed
- [ ] All error handling preserved (especially around I/O, network, external APIs)
- [ ] Type hints intact and correct
- [ ] Imports still valid
- [ ] No breaking changes to public APIs

**Behavior**:
- [ ] Return values unchanged (verified by Phase 2 regression tests)
- [ ] Side effects unchanged
- [ ] Exception behavior unchanged
- [ ] Edge case handling preserved

**Quality**:
- [ ] Removed changes are genuinely slop, not intentional patterns
- [ ] Remaining code follows project conventions
- [ ] No orphaned code or dead references
- [ ] Performance changes are obviously equivalent (no subtle algorithm shifts)
- [ ] No new abstractions introduced

### Phase 6: Fix issues

If any gate fails or any checklist item flips:

1. Identify the specific change that caused the failure.
2. Explain why it broke things.
3. `git checkout` the affected file (or use `git diff` + targeted `replace_file_content` to revert just the problematic hunk).
4. If genuine slop remains after revert, edit the file directly yourself — in parallel per file via multiple `replace_file_content` calls — applying only the changes you can prove are safe.
5. Re-run the failing gate and re-walk the checklist for the affected file.
6. Repeat until all gates green AND checklist clean.

If you fail three times on the same file, STOP and escalate to the user with: the file, what you tried, what failed, your hypothesis. Do not keep editing.

---

## Output Format

```text
AI SLOP REMOVAL REPORT
======================

Scope: [branch diff vs merge-base main / explicit file list]
Files: [N files]
  - path/to/file1.ts
  - path/to/file2.py

Behavior Lock:
  - Existing coverage: [N files already covered]
  - Tests added: [M gate-passing tests at path/to/test_X.py, each naming its contract]
  - Baseline status: GREEN apart from the baseline-red list (recorded as bugs, excluded from proofs, not deleted): [none] OR [list]

Cleanup Plan:
  - path/to/file1.ts: [ladder: 1 delete (native) + simplify-in-place] → [dead code → complexity → performance]
  - path/to/file2.py: [ladder: all simplify-in-place] → [comments → defensive]

Per-File Results (each cut shows what replaces it):
  path/to/file1.ts
    - Ladder/delete: custom DatePicker (48 lines) → <input type="date"> (native), flatpickr import removed
    - Dead code: 3 removed (lines X-Y, A-B, C) → nothing (unreachable)
    - Excessive complexity: 1 simplified (nested ternary at L42 → if/else)
    - Performance: 1 (line N: list scan → set lookup, O(n²)→O(n), behavior identical)
    - Skipped (preserved): 2 (defensive null check at boundary; commented WHY at L88)

  path/to/file2.py
    - Obvious comments: 5 removed → nothing
    - Over-defensive: 1 simplified (redundant isinstance on typed param)

Tests Ledger (category 9; one row per test declaration marked D/C/F, proofs run in Phase 4b):
  | Test | Mark | Keeper / reason | Proof |
  |---|---|---|---|
  | `foo.test.ts > reads the source for "export"` | D | source grep; `foo.test.ts > exports parse()` owns the contract | mutation parse.ts `return tokens` -> `return []`: candidate green, keeper red; restored sha-equal |
  | `skill.test.ts > mentions the gate` | D | prose pin on SKILL.md | assertion line + repo prose rule (no mutation applies) |

Quality Gates:
  - Regression tests: PASS (12 tests, 0 failed)
  - Lint: PASS
  - Typecheck (project type-checker): PASS (0 new errors on changed files)
  - Unit/integration tests: PASS (45 tests, 0 failed)
  - Static/security scan: N/A (not configured)

Critical Review:
  - Safety: PASS
  - Behavior: PASS
  - Quality: PASS

Issues Found & Fixed:
  - [None] OR [Issue description → Fix applied]

Net Impact:
  - LOC: -74 (removed 91, added 17)
  - Dependencies: -1 (flatpickr removed; native <input type="date"> used)
  - Files deleted: 1 (src/date-picker-wrapper.ts — platform-native replacement)

Remaining Risks / Deferred (this section is the debt ledger):
  - [None] OR [e.g., "boundary violation in module X flagged but not refactored — needs human judgment"]
  - `debt:` markers kept this pass: [None] OR [file:line — ceiling → upgrade trigger]

Final Status: CLEAN | ISSUES FIXED | REQUIRES ATTENTION
```

---

## Anti-Patterns (do not do these)

- **Skipping Phase 2.** Removing code on uncovered ground is a behavior-change time bomb regardless of how careful the agent is. The regression test IS the safety mechanism; the checklist is its complement, not its replacement.
- **Bundling unrelated refactors.** A single "cleanup" commit with dead code deletion + abstraction removal + performance change is impossible to review and impossible to bisect. Stay scoped to slop.
- **Algorithm changes disguised as performance optimization.** If equivalence requires a proof, it is not a slop fix — it is a refactor and belongs in a separate change.
- **Silent skips.** If a quality gate is N/A, say `N/A` and why. If a check failed and you could not fix it, say so. Never claim PASS without evidence.
- **Removing comments that explain WHY.** "It is obvious from the code" is rarely true for the next reader. Only remove comments that restate WHAT.
- **Touching files outside scope.** If a file was not in the branch diff or explicit list, do not edit it, even if you notice slop in passing. Report it under "Remaining Risks".
