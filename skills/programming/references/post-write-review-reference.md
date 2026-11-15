# MANDATORY POST-WRITE REVIEW LOOP

**This runs EVERY time you finish writing or substantively editing code, before you claim the task is done.** No exceptions.

### Step 1 — measure

For every file you created or modified:

```bash
awk '!/^[[:space:]]*$/ && !/^[[:space:]]*(\/\/|#|--)/' <file> | wc -l
```

Or run the per-language checker the skill ships:

```bash
# Python
uv run scripts/python/check-no-excuse-rules.py <changed paths>
# Rust
bash scripts/rust/check-no-excuse-rules.sh <changed paths>
# TypeScript
bun run scripts/typescript/check-no-excuse-rules.ts <changed paths>
# Any language, test files you touched: the junk classes a regex can see (candidates for "test your test")
bun run scripts/typescript/check-test-junk.ts <changed test paths>
```

### Step 2 — interpret

| Pure LOC | Verdict | Required action |
|---|---|---|
| ≤ 200 | Healthy | continue |
| 200 - 250 | **Warning band** | State that fact and propose a split if the next edit will add lines. |
| > 250 | **DEFECT** | Do NOT commit new lines to this file. Refactor now: split the touched unit before adding lines, except for rare SIZE_OK or pure-data-table exceptions. |

### Step 3 — architectural self-review (always, even at 80 LOC)

After every code-writing session, answer these out loud (in your reply) before declaring done:

1. **Single responsibility?** Can I name what this file owns in one short noun phrase? If the answer needs the word "and", split.
2. **Boundary purity?** Did I parse untrusted input into a typed value at the boundary, or did I pass `dict[str, Any]` / `serde_json::Value` / `unknown` past the boundary? If the latter, fix it.
3. **Variant discrimination?** Did I use `if`/`elif`/`else` (or `switch` without `assertNever`, or `match` without `assert_never`) anywhere to discriminate on a tagged type or enum? If yes, rewrite as exhaustive match.
4. **Escape hatches?** Any `Any`, `# type: ignore`, `unwrap`, `expect` outside tests, `as` numeric cast, `!`, `@ts-ignore`, `@ts-expect-error`, a Rust `#[allow]` instead of `#[expect(lint, reason)]`? If yes, fix the type or document why with a comment.
5. **Defensive layer?** Any null check, try/except, or `isinstance` guarding a value the type system already proves? If yes, delete.
6. **Helpers for one-off?** Any function, class, or trait introduced for a single caller that will never get a second caller? If yes, inline — axiom 0 should have caught it pre-write; this is the backstop.
7. **Tests?** Does every test I added or reshaped answer the four-question authoring gate (`references/testing/README.md`), go red when I break its production owner, and match no row of `references/testing/junk-classes.md`? Where the repository keeps tests for a behavior I introduced and a regression would otherwise pass unnoticed, is it covered at its owner, not by a copy or a change certificate?
8. **Parameter bloat?** Any function I wrote or modified that takes more than 3 parameters — or smuggles them through a dict/kwargs/`...args`/throwaway options object? If yes, group related params into a typed value object. See [Smell 2](code-smells.md#smell-2--function-with-more-than-3-parameters).
9. **Redundant verification?** Did I perform a destructive action (delete, remove, clear) and then immediately re-query to "confirm" it worked? Did I call a setter then a getter to "verify"? If yes, delete the verification — the operation's contract IS the proof. See [Smell 3](code-smells.md#smell-3--redundant-verification-after-a-destructive-action).
10. **Negative naming?** Any variable, function, or flag named by the absence of a quality (`isNotValid`, `noErrors`, `DisableX`) when a positive name (`isValid`, `isClean`, `EnableX`) would work? If yes, rename to positive form and invert the branch. See [Smell 4](code-smells.md#smell-4--negative-form-names-and-conditions).
11. **Logging?** If I touched log lines, logger setup, or error boundaries: did I follow the project's existing practice (including its absence)? Is every new line leveled by its consumer, placed at a decision point, and message-stable with data in fields? See [`references/logging.md`](logging.md).

**If any answer fails, fix it before declaring done.** This loop is the difference between "the code compiles" and "the code is correct."

### Step 4 — if you need to refactor right now, invoke the right skill

- Any code smell from the [CODE SMELLS section](code-smells.md) fired (250+ LOC, >3 params, redundant verification, negative naming), or step 3 surfaced more than two issues: **load the `refactor` skill** and execute its safe-refactor protocol (codemap, plan, LSP-driven edits, test after each step). Do not improvise a refactor under time pressure — the refactor skill exists precisely so you do not corrupt behavior while reshaping structure.
- You inherited a branch with AI-generated patterns (broad `except`, redundant null checks, vague TODOs, oversized modules, dead helpers, redundant post-action verification): **load the `remove-ai-slops` skill** to do a categorized branch-scope cleanup with regression tests pinned first.

These two skills are not optional cosmetics. They are the recovery path for the smells this loop is designed to catch.

---

## Companion skills - explicit invocation triggers

| Trigger | Skill to load | Why |
|---|---|---|
| Any [code smell](code-smells.md) fires (250+ LOC, >3 params, redundant verification, negative naming), OR the post-write loop surfaces more than two issues, OR the user says "reshape this", "extract this", "clean this up" | `refactor` | Safe codemap-driven multi-step refactor with LSP + tests after each step. Never improvise a structural change. |
| Recent branch contains AI-authored patterns (broad except, dead helpers, vague comments, oversized files, redundant post-action verification, junk tests), OR the user says "remove slop", "clean AI code", "deslop" | `remove-ai-slops` | Behavior locked by gate-passing tests FIRST, then categorized parallel cleanup (junk tests included, each cut proven by a mutation), then quality gates. Behavior-preserving. |
| Rust code touches `unsafe`, `*mut`, `*const`, `MaybeUninit`, FFI, `unsafe impl Send/Sync`, or a custom lock-free primitive | `references/rust-ub/` | Full UB taxonomy + Miri strictness escalation. Every `unsafe` block must survive Miri Level 3 (strict provenance + symbolic alignment + preemption) and the Level 4 Tree Borrows pass before it ships. |
