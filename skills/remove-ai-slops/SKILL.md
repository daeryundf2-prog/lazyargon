---
name: remove-ai-slops
description: "Removes AI-generated code smells from branch changes or an explicit file list behind regression tests, including junk tests (prose pins, source greps, copied inventories, mock echoes), each proven by its class's rule before a cut. Use when the user asks to clean up, deslop, remove AI-slop patterns, or prune tests from recent changes."
---

## Antigravity Harness Tool Compatibility

In Google Antigravity, use native subagents and tools (`invoke_subagent` with Tier-Routing, file editing tools):

| Task | Antigravity tool |
| --- | --- |
| Parallel slop cleanup lane | `invoke_subagent` with `Model: "inherit"` (`TypeName: "self"`) |
| Gate review / adversarial check | `invoke_subagent` with `Model: "inherit"` |
| Direct file operations | `view_file`, `replace_file_content`, `write_to_file` |
| Direct command & test execution | `run_command` |


# Remove AI Slops Skill

## Inputs

- **Default scope**: branch diff vs `merge-base main` (no arguments needed)
- **Optional scope**: explicit file list passed by the caller (e.g., a Ralph workflow's changed-files set)

## What this skill does

Cleans AI-generated slop from a bounded set of changed files while strictly preserving behavior. Locks behavior with regression tests first, then runs a categorized multi-pass cleanup, then verifies with quality gates and a critical review. Reverts and direct-edits when verification fails.

The core safety invariant: **behavior is locked by green tests before a single line is removed**. A checklist alone is not safety; a passing regression test is.

---

## Categories (what counts as slop)

The agent looks for these ten categories. The first three are stylistic, the next three are structural, the next two are about hidden cost, the ninth is tests, and the last is size.

### Stylistic
1. **Obvious comments** — remove comments restating code, trivial docstrings, section dividers, commented-out code, and vague TODOs/Notes; KEEP comments explaining WHY (business logic, edge cases, workarounds), ticket links, regex/algorithm explanations, and BDD markers (`# given`, `# when`, `# then`, `# when/then`).
2. **Over-defensive code** — remove null checks for guaranteed values, try/except around non-raising code, `isinstance` on statically typed params, defaults on required params, backward-compat shims, duplicate multi-layer validation, and **broad exception catching** (`except Exception`/`except BaseException`, empty `catch {}`, or un-narrowed `catch (e) { console.error(e) }` — REFACTOR to specific exceptions or `instanceof` narrowing + re-throw); KEEP boundary validation, I/O error handling, nullable DB fields, and top-level boundary catch-alls (CLI `main()`, HTTP handler) with explicit logging + re-raise. **PROOF REQUIRED**: before deleting any validation or error handling at a trust boundary, Phase 2 must include an **adversarial** regression (malformed or hostile input) that fails if the guard is removed (no adversarial test → the guard stays; only a proven duplicate of an inner check is removable).
3. **Excessive complexity** — refactor deep nesting (>3 levels → guard clauses / early returns), nested ternaries (→ explicit `if/else`), 4+ predicate booleans, >5-arg parameter lists, >50-line god functions, overly clever one-liners, type/enum/literal `if/elif/else` chains (must be `match/case` + `assert_never` on wildcard), and `object` type annotations (must be `Protocol`, `TypeVar`, or explicit union); KEEP established codebase complexity patterns, intentional hot-path idioms, and `if/else` for boolean conditions and range checks.
- Full stylistic category rules (KEEP, REFACTOR, and boundary adversarial proof requirements): [references/categories.md](references/categories.md)

### Structural
4. **Needless abstraction** — remove pass-through wrappers, single-use helpers, speculative indirection ("we might need this later"), single-implementer interfaces with no testability win, and constructor-only factories; KEEP abstractions that provide a real seam (testability, multiple implementers, framework-required boundaries).
5. **Boundary violations** — fix wrong-layer imports (UI importing DB driver), leaky responsibilities (handler doing service business logic), hidden coupling (reading another module's private state), and side effects in pure-named functions; KEEP pragmatic short-circuits already established in this codebase and flag for human judgment if unsure.
6. **Dead code** — remove unused imports, unused private functions/methods, unreachable branches, stale feature flags, debug leftovers (`console.log`, `print(...)`, `dbg!`), and removed-but-still-referenced code; KEEP code referenced via reflection, dynamic dispatch, string lookup, or intentional feature-flag rollback paths (verify with the user).
- Full structural category catalog and KEEP rules: [references/categories.md](references/categories.md)

### Hidden cost
7. **Duplication** — consolidate copy-pasted branches with trivial differences, redundant helpers doing the same thing in two places, and repeated literal/magic-number sequences; KEEP incidental duplication where similar-looking code serves different intents that could diverge.
8. **Performance equivalences (behavior-preserving optimizations)** — apply provably equivalent optimizations (`O(n²) → O(n)` set lookup vs list scan, hoisting repeated loop computation, generator over single-pass `list(...)`, `join` over loop string concatenation, batching loop DB/API calls, removing redundant deep copies/clones, caching `.length`/`len()` in loops). **Hard rule**: only apply when behavior equivalence is obvious; do NOT change algorithms with subtle correctness implications, do NOT micro-optimize hot paths without a benchmark, and if in doubt, SKIP.
- Full duplication and performance-equivalence catalog: [references/categories.md](references/categories.md)

### Tests
9. **Tests: missing or junk** — judge every in-scope test by `../programming/references/testing/junk-classes.md`: (a) **Missing**: add the narrowest test passing the four-question authoring gate (`../programming/references/testing/README.md`) and naming its owner contract (PROSE files like prompt/`SKILL.md`/rule/markdown cover only machine-consumed values or leave to review); (b) **Junk**: mark every in-scope test declaration `R`/`F`/`C`/`D` (re-mark misnamed tests by their assertions, never cut for name) and prove every `D` or `C` by its class's rule BEFORE the cut (serial orchestrator mutations in Phase 4b where `D` requires keeper red + candidate green or both red, while candidate-only red is `R` or `C` into keeper; prose pin, change certificate, seam keeper via `knip`/grep, copied inventory, capability restatement or `F` if no delivery test, and near-duplicate table consolidation + typecheck; delete any test-only production seam whose last test was cut); (c) **KEEP**: everything under the retention bar (public API, protocol, config, migration, storage, security, platform, shipped-copy equality, Node-compat suites, issue regressions, machine-consumed text), never delete static/slow tests for being static/slow, and report baseline-red tests as product bugs rather than deleting them.
- Full missing/junk test rules, per-class proof requirements, and retention bar: [references/categories.md](references/categories.md)

### Size
10. **Oversized modules** — any source file exceeding **250 pure LOC** (non-blank, non-comment lines; POSIX measure: `awk '!/^[[:space:]]*$/ && !/^[[:space:]]*(#|\/\/)/' <file> | wc -l`, or `uv run <programming skill dir>/scripts/python/check-no-excuse-rules.py <paths>` rule `oversized-module` for `.py` files only) is an architectural defect requiring full modular refactoring: (1) measure and list every oversized file in scope, (2) identify single responsibilities, (3) plan concept-named splits (never `utils.py`, `helpers.py`, `common.py`, `service.py`, `part_1.py`, or `foo_1.py`/`foo_2.py` token splits), (4) present the split plan to the user before executing, (5) extract into clean modules with re-export-only `__init__.py`, and (6) re-measure (all ≤250 pure LOC) and run tests, typecheck, and lint; no counting blanks/comments, no "230 LOC, close enough", and no "it's generated" outside build output directories (KEEP standalone single-responsibility scripts only with `# noqa: SIZE_OK` or `// allow: SIZE_OK` in the first 10 lines plus a WHY comment).
- Full cross-platform LOC measurement commands (POSIX, Python, PowerShell), 6-step modular refactoring procedure, and forbidden escapes: [references/categories.md](references/categories.md)

---

## Quality Gates

A pass is complete only when all applicable gates are green. Skip gates that are genuinely N/A for the project (e.g., no security scanner configured), and report `N/A` explicitly — do not silently skip.

| Gate | Tool | Pass condition |
|---|---|---|
| Regression tests | project's test runner | all green |
| Lint | project's linter | zero errors (warnings OK if pre-existing) |
| Typecheck | project type-checker (`tsc --noEmit`, `basedpyright`, `cargo check`, `go vet`) | zero new errors |
| Unit/integration tests | project's test runner | all green (pre-existing failures noted, not introduced) |
| Static/security scan | project's scanner | zero new findings, or `N/A` if not configured |

---

## Process

### Phase 0: Lock Scope & Plan

Lock the 3-line scope (`목표 / 완료 조건 / 범위`) and track each phase sequentially.

### Phase 1: Determine scope

If file paths were passed as arguments, that is the scope. Otherwise:

```bash
git diff $(git merge-base main HEAD)..HEAD --name-only
```

Filter out: deleted files, binary files, generated/vendored files (`node_modules/`, `dist/`, `target/`, lockfiles). List the final scope.

### Phase 2: Lock behavior with regression tests (NEW — non-negotiable)

- For each in-scope source file: (1) identify public/observable behavior, (2) check existing test coverage (`git grep` / test conventions), (3) **if uncovered, write the narrowest test passing the authoring gate (`../programming/references/testing/README.md`) BEFORE editing the file** (asserting observable boundary outputs, never implementation shape or values derived from the code under test; PROSE files like prompt/`SKILL.md`/rule/markdown are exempt unless asserting a machine-consumed value), (4) run the test suite (record unchanged baseline-red tests as bugs excluded from proofs and neither fixed nor deleted; everything else must be **green**, and STOP if the runner is broken), and (5) run `bun run <programming skill dir>/scripts/typescript/check-test-junk.ts <test files>` over all in-scope test files (including step 3 additions, rewriting any step 3 test it flags and adding existing findings as category-9 candidates for the Tests Ledger).
- Full 5-step Phase 2 behavior-locking procedure: [references/execution-phases.md](references/execution-phases.md)

### Phase 3: Cleanup plan — existence first, then smells

- **Run the deletion ladder on each changed unit before categorizing smells**: (1) **Delete entirely** (YAGNI, speculative, dead on arrival; or category-9 test with proof), (2) **Reuse** an existing repo helper or pattern, (3) **Platform / stdlib / native / dependency** replacement (`<input type="date">`, `URLSearchParams`, existing imported util), (4) **Simplify in place** (only code landing here proceeds to smell categories).
- **Bug-fix diffs, `debt:` markers, and order rule**: grep callers of every touched shared function and fix the shared seam once rather than per-caller guards; produce an explicit per-file plan (`Ladder`, `Categories`, `Order`, `Risk`) before spawning removal agents; mark intentional bounded simplifications in-code with a `debt:` comment naming ceiling and upgrade trigger (listed under "Remaining Risks / Deferred"); and apply the safest → riskiest order rule: `comments → dead code → defensive → duplication → complexity → abstraction/boundary → performance → tests (F rows; D/C wait for Phase 4b) → oversized-modules`.
- Full deletion ladder rationale and worked cleanup plan example: [references/execution-phases.md](references/execution-phases.md)

### Phase 4: Parallel slop removal via `invoke_subagent` (`Model: "inherit"`) in batches of 3–5

- **Strict batching protocol**: (1) slice in-scope files into chunks of 3–5 files (if ≤5 files, launch all in one batch); (2) launch all subagents in the chunk **in parallel in a single turn** with one flat `invoke_subagent({ TypeName: "self", Role: "Slop Remover", Model: "inherit", Prompt })` call per file (never wrap in `Subagents: [...]` or pass `toolAction`/`toolSummary`, **never** launch >5 files at once, and **never** launch serially when >1 file remains in the batch); (3) end your turn and wait for reactive wakeup via `send_message`; (4) collect batch results before starting the next batch.
- **Per-file worker prompt rules**: run the Phase 3 deletion ladder first, then evaluate EVERY category in `Categories (what counts as slop)` with KEEP and REFACTOR rules verbatim in safest → riskiest order; for a test file, apply `F` rows and return one ledger row per `D`/`C`/`F` (`| test | mark | keeper or reason | proposed proof |`) without cutting `D`/`C` or mutating any file; preserve behavior (SKIP when equivalence is not obvious), do NOT change public API signatures, do NOT remove type hints, do NOT introduce new abstractions or dependencies, keep the diff minimal, report changes grouped by category, and run tests and typecheck.
- Full batching rationale and verbatim per-file `invoke_subagent` JSON prompt template: [references/execution-phases.md](references/execution-phases.md)

### Phase 4b: Prove the test cuts, serially, then cut

- **Serial mutation and non-mutation proofs**: after the last batch finishes and no worker or test run is live, the orchestrator serially runs `bun run <programming skill dir>/scripts/typescript/mutation-proof.ts --file <owner> --find <text> --replace <text> --test 'candidate=<argv>' --test 'keeper=<argv>'` (with `--json`; use a wrapper script or file-path target if a `--test` filter contains spaces) one mutation at a time (never two on the same file), verifying byte-for-byte sha256 restoration of the owner before the next row, and checks non-mutation proofs (prose pin, change certificate, seam keeper, copied inventory, capability restatement, near-duplicate cases); only rows proven per the table are cut, while a `D` or `C` whose proof fails or was not run becomes an `R`.
- **Batch failure handling**: if a subagent returns without the deliverable, ack-only after follow-up, `BLOCKED: <reason>`, or fails, do NOT block the batch — collect successful results, retry the failed file once later, and if retry also fails, escalate under "Issues Found & Fixed".
- Full serial mutation-proof procedure and batch failure handling details: [references/execution-phases.md](references/execution-phases.md)

### Phase 5: Verify with quality gates + critical review

- Run all five quality gates above, then walk every item of the critical review checklist across **Safety** (no functional logic removed, all I/O/network/external API error handling preserved, type hints intact and correct, imports valid, no breaking changes to public APIs), **Behavior** (return values unchanged per Phase 2 regression tests, side effects unchanged, exception behavior unchanged, edge case handling preserved), and **Quality** (removed changes are genuinely slop rather than intentional patterns, remaining code follows project conventions, no orphaned code or dead references, performance changes are obviously equivalent with no subtle algorithm shifts, no new abstractions introduced).
- Full critical review checklist (Safety, Behavior, Quality): [references/report-and-checklists.md](references/report-and-checklists.md)

### Phase 6: Fix issues

- If any gate fails or any checklist item flips: (1) identify the specific change that caused the failure, (2) explain why it broke things, (3) `git checkout` the affected file (or use `git diff` + targeted `replace_file_content` to revert just the problematic hunk), (4) if genuine slop remains after revert, edit the file directly via parallel `replace_file_content` calls applying only provably safe changes, (5) re-run the failing gate and re-walk the checklist, and (6) repeat until all gates are green and the checklist is clean; if you fail three times on the same file, STOP and escalate to the user with the file, what you tried, what failed, and your hypothesis.
- Full 6-step revert/fix procedure and 3-strike escalation rule: [references/report-and-checklists.md](references/report-and-checklists.md)

---

## Output Format

- Emit the `AI SLOP REMOVAL REPORT` containing `Scope`, `Files`, `Behavior Lock` (`Existing coverage`, `Tests added`, `Baseline status` with baseline-red list), `Cleanup Plan`, `Per-File Results` (each cut showing what replaces it plus skipped items), `Tests Ledger` (`| Test | Mark | Keeper / reason | Proof |`), `Quality Gates`, `Critical Review` (`Safety`, `Behavior`, `Quality`), `Issues Found & Fixed`, `Net Impact` (`LOC`, `Dependencies`, `Files deleted`), `Remaining Risks / Deferred` (the debt ledger, including `debt:` markers kept this pass with `file:line — ceiling → upgrade trigger`), and `Final Status: CLEAN | ISSUES FIXED | REQUIRES ATTENTION`.
- Full `AI SLOP REMOVAL REPORT` template and worked example: [references/report-and-checklists.md](references/report-and-checklists.md)

---

## Anti-Patterns (do not do these)

- Do NOT skip Phase 2 (regression tests lock behavior; checklists do not), bundle unrelated refactors, disguise algorithm changes as performance optimizations, silently skip N/A or failed gates, remove comments that explain WHY (only remove comments that restate WHAT), or touch files outside scope (report out-of-scope slop under "Remaining Risks").
- Full anti-patterns list and rationale: [references/report-and-checklists.md](references/report-and-checklists.md)

---

## Tool Persistence

- When a tool call fails, retry with adjusted parameters.
- Never silently skip a failed tool call.
- Never claim a gate passed without running it and reading the output.
- If correctness depends on further inspection, keep using the project type-checker, the test runner (`run_command`), and direct file reads (`view_file`) until the result is grounded.

---

## Quality Assurance

- NEVER remove code that serves a functional purpose.
- Preserve every proven contract: a test leaves only with its proof receipt (category 9), and a missing contract gets a gate-passing test, never a change certificate.
- When in doubt, SKIP and keep the original; never GUESS.
