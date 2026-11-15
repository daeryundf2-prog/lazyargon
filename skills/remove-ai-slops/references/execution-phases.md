### Phase 2: Lock behavior with regression tests (NEW — non-negotiable)

For each in-scope source file:

1. Identify the public/observable behavior the file exposes (exported functions, HTTP handlers, CLI commands, classes used elsewhere).
2. Check whether existing tests cover that behavior. Use `git grep` / project test conventions to find related test files.
3. **If a behavior the cleanup could change is uncovered, write the narrowest test that passes the authoring gate (`../programming/references/testing/README.md`) BEFORE editing the file**, and name the behavior it guards. It asserts observable outputs at the real boundary, never the implementation shape the cleanup is about to change, and never a value derived from the code under test. A PROSE file (prompt/`SKILL.md`/rule/markdown) is exempt: its wording is not behavior; skip the test and rely on review, or assert only a machine-consumed value.
4. Run the test suite (or at minimum the relevant tests). A test that is red on the unchanged base is recorded as a bug (baseline-red list), excluded from every proof, and neither fixed in this pass nor deleted; everything else must be **green** before any cleanup begins.
5. Run the `programming` skill's static detector over every in-scope test file, the ones written in step 3 included: `bun run <programming skill dir>/scripts/typescript/check-test-junk.ts <test files>` (exit 1 lists `file:line` per junk class it can see: source grep, prose pin, fixed sleep, `.only`/`.skip`, self-comparison, lower-bound cardinality). Its findings are category-9 candidates for the Tests Ledger (marked `R`/`F`/`C`/`D` by the table once its proof runs), never automatic cuts, and a test from step 3 that it flags is rewritten before the pass continues.

Only a broken runner stops the pass: if the suite cannot run at all, STOP and report. Do not proceed with cleanup on unverified ground.

### Phase 3: Cleanup plan — existence first, then smells

The largest, safest deletion is code that should not have existed. **Before categorizing smells, run the deletion ladder on each changed unit:**

- **Delete entirely** — the behavior is not needed (YAGNI, speculative, dead on arrival); for a test, its contract is already owned by a keeper or it has none (category 9, with the proof).
- **Reuse** — an existing helper or pattern in this repo already does it; replace the reimplementation with a call to it.
- **Platform / stdlib / native / dependency** — the language stdlib, the runtime, or an already-installed dependency already does it (a hand-rolled date picker → `<input type="date">`, a custom query parser → `URLSearchParams`, a bespoke debounce → the util already imported).
- **Simplify in place** — it must exist; make it smaller.

Only code that lands on **Simplify in place** proceeds to the smell categories. This turns the pass from "find smells to trim" into "first decide whether the code should exist, then trim what survives." One function replaced by a platform call is a bigger, safer win than any in-place cleanup — and it needs no per-line smell analysis.

For a diff that **fixes a bug**, grep the callers of every shared function it touches. Prefer one root-cause fix at the shared seam over repeated guards at each caller — a per-caller patch that leaves a sibling caller broken is a partial fix, not a cleanup.

Then produce an explicit plan **before** spawning the removal agents:

```
File: src/foo.py
  Ladder: 2 units simplify-in-place; 1 unit delete (native <input> replaces custom picker)
  Categories: dead code, excessive complexity, performance
  Order: dead code → complexity → performance
  Risk: medium (touches caching layer)

File: src/bar.py
  Ladder: all simplify-in-place
  Categories: obvious comments, over-defensive
  Order: comments → defensive
  Risk: low
```

**Intentional shortcuts:** if the plan deliberately keeps a bounded simplification (a naive scan fine under N rows, a global lock, an O(n²) path), mark it in-code with a `debt:` comment naming the ceiling and the upgrade trigger, and list it under "Remaining Risks / Deferred" in the report. That section is the debt ledger — a simplification with a known ceiling and no marker is indistinguishable from a bug.

Order rule (safest → riskiest): comments → dead code → defensive → duplication → complexity → abstraction/boundary → performance → tests (`F` rows; `D`/`C` wait for Phase 4b) → oversized-modules. This minimizes blast radius of any one change.

### Phase 4: Parallel slop removal via `invoke_subagent` (`Model: "inherit"`) in batches of 3–5

Files are processed by subagents (`Model: "inherit"`), **batched up to 3–5 at a time in parallel** via parallel flat `invoke_subagent` calls in the same turn. `Model: "inherit"` gives the agent high speed and thoroughness to correctly evaluate the 10 categories and respect the KEEP rules without slipping into surface fixes; the 3–5 batch size is the sweet spot — more than 5 creates result-merging noise and context contention, fewer wastes parallelism.

**Batching protocol** (strict):

1. Slice the in-scope file list into chunks of up to 3–5 files.
2. For each chunk, launch all subagents **in parallel in a single turn** with one flat `invoke_subagent({ TypeName, Role, Model, Prompt })` call per file (never wrap in `Subagents: [...]` or pass `toolAction`/`toolSummary`).
3. Stop tool calling to end your turn. Reactive wakeup will trigger when each subagent finishes via `send_message`.
4. Once all in the batch complete, collect results and proceed to the next batch. Repeat until every file is processed.
5. If total files ≤ 5, launch all in one batch.

**Never** launch all files at once when there are more than 5; **never** launch them serially when more than one remains in the current batch.

**Per-file `invoke_subagent` call** (flat top-level arguments):

```json
{
  "TypeName": "self",
  "Role": "Slop Remover",
  "Model": "inherit",
  "Prompt": "TASK: Remove AI slops from: {file_path}\n\nFirst run the deletion ladder from Phase 3 on this file (delete entirely / reuse existing repo code / platform-stdlib-native / simplify in place); only code that must exist proceeds to smell removal.\n\nThen evaluate EVERY category defined in this skill's 'Categories (what counts as slop)' section, applying that section's KEEP and REFACTOR rules verbatim — the Categories section you have loaded is canonical, do not work from a restated subset. For a test file, do NOT cut yet: mark every declaration R/F/C/D against `programming/references/testing/junk-classes.md` and return one ledger row per D/C/F (`| test | mark | keeper or reason | proposed proof |`), where the proposed proof names the class's proof kind and, for a mutation, the owner file, the exact find/replace, and the keeper to run. This worker applies `F` rows in the test file it owns and reports them in the ledger as applied; `D`/`C` rows are returned uncut; it never mutates any file to prove a test - the orchestrator runs the proofs in Phase 4b.\n\nApply changes in this order (safest → riskiest): comments → dead code → defensive → duplication → complexity → abstraction/boundary → performance → tests (`F` rows; `D`/`C` wait for Phase 4b) → oversized-modules.\n\nHard constraints:\n- Behavior MUST be preserved. When equivalence is not obvious, SKIP.\n- Do NOT change public API signatures.\n- Do NOT remove type hints.\n- Do NOT introduce new abstractions or dependencies.\n- Diff stays minimal and scoped to slop removal.\n\nDELIVERABLE: Report changes grouped by category with before/after, why-slop, why-safe. For each skipped issue, give reason. For a test file, end with the ledger rows.\nSCOPE: {file_path}\nVERIFY: Run tests and typecheck."
}
```

### Phase 4b: Prove the test cuts, serially, then cut

After the last batch finishes and no worker is running, the orchestrator takes the collected ledger rows. For each row whose proof is a mutation, run the `programming` skill's `bun run <programming skill dir>/scripts/typescript/mutation-proof.ts --file <owner> --find <text> --replace <text> --test 'candidate=<argv>' --test 'keeper=<argv>'` (add `--json` for the ledger; each `--test` value is split on spaces with no quoting, so a filter that contains a space needs a wrapper script or a file-path target instead): it applies the find/replace to the production owner, runs the candidate and the keeper on the unmodified test tree, records both verdicts, and restores the owner byte for byte (sha256-checked) before the next row. One mutation at a time, never while another worker or test run is live, and never two on the same file; a mutation touches a file outside the diff only transiently and is never committed. Rows proven per the table become the cuts; a D or C whose proof fails or was not run is an R. Non-mutation proofs (prose pin, change certificate, seam keeper, copied inventory, capability restatement, near-duplicate cases) are checked here too, from the row's evidence.

**Batch failure handling**: When a subagent completes without the deliverable, returns ack-only after follow-up, reports `BLOCKED: <reason>`, or fails, retry once. Do NOT block the remaining files in the batch; collect successful results and retry the failed file once later. If retry also fails, escalate that file under "Issues Found & Fixed" in the final report.
