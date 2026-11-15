## Categories (what counts as slop)

The agent looks for these ten categories. The first three are stylistic, the next three are structural, the next two are about hidden cost, the ninth is tests, and the last is size.

### Stylistic
1. **Obvious comments** — comments restating code, trivial docstrings, section dividers, commented-out code, vague TODOs/Notes.
   - KEEP: comments explaining WHY (business logic, edge cases, workarounds), ticket links, regex/algorithm explanations.
   - KEEP: BDD markers (`# given`, `# when`, `# then`, `# when/then`).

2. **Over-defensive code** — null checks for guaranteed values, try/except around code that cannot raise, isinstance checks for statically typed params, default values for required params, backward-compat shims, redundant validation duplicated at multiple layers, **broad exception catching** (`except Exception`/`except BaseException` in Python, empty `catch {}` or `catch (e) { console.error(e) }` without narrowing in TypeScript/JavaScript).
   - KEEP: validation at system boundaries (user input, external APIs), I/O error handling, nullable DB fields. Top-level boundary catch-all (CLI `main()`, HTTP handler) with explicit logging + re-raise is acceptable.
   - REFACTOR: `except Exception` → catch the specific exception you expect. Empty `catch {}` → add `instanceof` narrowing or re-throw. `catch (e) { log(e) }` → narrow with `instanceof`, handle known cases, re-throw unknown.
   - PROOF REQUIRED: before deleting any validation or error handling at a trust boundary, Phase 2 must include an **adversarial** regression (malformed or hostile input) that fails if the guard is removed. No adversarial test → the guard stays. Redundant defense to remove is a duplicate of a check that already runs *inside* the boundary; a guard with no proof of redundancy is load-bearing.

3. **Excessive complexity** — deep nesting (>3 levels), nested ternaries, complex boolean expressions (combine 4+ predicates), long parameter lists (>5 args without a struct/dataclass/object), god functions (>50 lines doing many things), overly clever one-liners that sacrifice readability, `if/elif/else` chains for type/enum/literal discrimination (must be `match/case` + `assert_never`), `object` used as a type annotation (must be `Protocol`, `TypeVar`, or explicit union).
   - KEEP: established complexity patterns in this codebase, performance-critical hot paths that intentionally use a complex idiom. `if/else` for boolean conditions and range checks (not variant discrimination).
   - REFACTOR: nested if-chains → guard clauses / early returns. Complex ternaries → explicit if/else. isinstance/enum if/elif chains → `match/case` with `assert_never` on the wildcard. `object` annotations → `Protocol` (structural), `TypeVar` (generic), or union (known variants).

### Structural
4. **Needless abstraction** — pass-through wrappers, single-use helpers, speculative indirection ("we might need this later"), interfaces with one implementer where the interface adds no testability win, factory functions that just call a constructor.
   - KEEP: abstractions that provide a real seam (testability, multiple implementers, framework-required boundaries).

5. **Boundary violations** — wrong-layer imports (UI importing DB driver), leaky responsibilities (handler doing business logic that belongs in a service), hidden coupling (module A reads module B's private state), side effects in pure-named functions.
   - KEEP: pragmatic short-circuits already established as a pattern in this codebase. Flag for human judgment if unsure.

6. **Dead code** — unused imports, unused private functions/methods, unreachable branches, stale feature flags, debug leftovers (`console.log`, `print(...)`, `dbg!`), removed-but-still-referenced code.
   - KEEP: code referenced via reflection, dynamic dispatch, or string lookup. Code intentionally kept as a feature flag rollback path (verify with the user).

### Hidden cost
7. **Duplication** — copy-pasted branches with trivial differences, redundant helpers that do the same thing in two places, repeated literal/magic-number sequences.
   - KEEP: incidental duplication (two pieces of code that look similar but serve different intents that could diverge). Prefer leaving them separate over forcing a premature shared abstraction.

8. **Performance equivalences (behavior-preserving optimizations)** — changes that are provably equivalent in semantics but cheaper in time/space:
   - O(n²) → O(n) when correctness preserved (e.g., set lookup vs list scan)
   - Repeated computation inside a loop → hoist outside
   - Unnecessary intermediate collections (eager `list(...)` when only iterated once → generator)
   - String concatenation in loop → `join`
   - Redundant DB/API calls in a loop → batch
   - Redundant deep copies / clones
   - `.length` / `len()` recomputed inside loop → cache

   **Hard rule**: only apply when behavior equivalence is obvious. Do NOT change algorithms with subtle correctness implications. Do NOT micro-optimize hot paths without a benchmark. If in doubt, SKIP.

### Tests
9. **Tests: missing or junk** — tests are code in scope like any other file, judged by the one table in the `programming` skill, `../programming/references/testing/junk-classes.md` (junk classes, retention bar, R/F/C/D marks, proof rule). Two directions:
   - **Missing**: a behavior in the changed files that no test guards, where the repository keeps tests for that kind of behavior and a regression would otherwise pass unnoticed. ADD the narrowest test that passes the four-question authoring gate (`../programming/references/testing/README.md`); name its owner contract. A PROSE file (prompt, `SKILL.md`, rule, markdown) has no behavioral seam: cover only a machine-consumed value (parsed field, sentinel a runtime greps, a doc JSON sample through its real validator) or leave it to review.
   - **Junk**: mark every in-scope test declaration `R` / `F` / `C` / `D`. A `D` or `C` needs the proof the table names for its class BEFORE the cut: for a behavior class (cannot fail, mock echo, source grep, duplicate contract, layer replay, implementation mirror, fabricated postcondition, input transcript) a mutation of the production owner run against the candidate and its named keeper on the unmodified test tree; for a prose pin the assertion line plus the repo's prose rule; for a change certificate the revert that turns it red; for a seam keeper the `knip`/grep showing no production caller; for a copied inventory the generator or consumer that owns it; for a capability restatement the delivery test that owns the promise (none: `F`, not `D`); for near-duplicate cases the one table that keeps every old assertion (typecheck after). A misnamed test is re-marked by what its assertions check, never cut for its name. A mutation proves `D` only when the keeper goes red and the candidate stays green (cannot fail) or both go red (redundant); a candidate that is the ONLY red is `R`, or `C` into the keeper and re-run. Mutations run in Phase 4b, serially, by the orchestrator, never by a batch worker. A test-only production seam (export, flag, getter, reset hook) whose last test was deleted goes with it.
   - KEEP: everything under the retention bar (public API, protocol, config, migration, storage, security, platform, shipped-copy equality, Node-compat suites, issue regressions, machine-consumed text). A test that is red on the unchanged base is a product bug to report, never a deletion. Static or slow is never a reason to delete.

### Size
10. **Oversized modules** — any source file exceeding **250 pure LOC** (non-blank, non-comment lines). This is an architectural defect, not a style preference.
    - Measure (POSIX): `awk '!/^[[:space:]]*$/ && !/^[[:space:]]*(#|\/\/)/' <file> | wc -l`
    - Measure (Cross-platform Python): `python -c "import re,sys; print(sum(1 for l in open(sys.argv[1],encoding='utf-8') if l.strip() and not re.match(r'^\s*(#|//|--)',l)))" <file>`
    - Measure (PowerShell): `(Get-Content <file> | Where-Object { $_ -notmatch '^\s*$' -and $_ -notmatch '^\s*(#|//|--)' }).Count`

   **When found, do NOT just flag it. Execute a full modular refactoring:**
   1. List every oversized file in scope: run the LOC measure above on each source file. For `.py` files you may instead run the `programming` skill's Python checker (`uv run <programming skill dir>/scripts/python/check-no-excuse-rules.py <paths>`, rule `oversized-module`); it scans only `.py` files, so it never covers another language.
   2. For each oversized file, identify distinct responsibilities (single-responsibility principle).
   3. Plan the split: name each new file after the concept it owns (never `utils.py`, `helpers.py`, `common.py`, `part_1.py`).
   4. Present the split plan to the user before executing.
   5. Extract into clean modules with explicit `__init__.py` re-exports (re-exports ONLY, no logic in `__init__.py`).
   6. Verify: re-measure exactly as in step 1 — every file must be ≤250 pure LOC. Run tests, typecheck, lint.

   **Forbidden escapes**:
   - Counting blanks/comments toward budget.
   - Splitting by token count (`foo_1.py`, `foo_2.py`) — split by what each file DOES.
   - Catch-all dump files (`utils.py`, `helpers.py`, `service.py`).
   - "It's generated" — only valid if the file lives in a build output directory.
   - "230 LOC, close enough" — a 230-LOC file about to grow is already over. Split now.

   KEEP: genuinely self-contained single-responsibility scripts (e.g., a standalone CLI checker). Opt out with the language's SIZE_OK marker in the first 10 lines (`# noqa: SIZE_OK` in Python, the form the Python checker reads; `// allow: SIZE_OK` in `//`-comment languages) and a comment explaining why.
