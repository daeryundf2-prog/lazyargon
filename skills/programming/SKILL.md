---
name: programming
description: "MUST USE for .py .pyi .rs .ts .tsx .mts .cts .js .jsx .mjs .cjs .go code, and whenever a test or spec file is written, reshaped, reviewed, or deleted. Enforces strict types, modern stacks (Pydantic v2, serde, Zod, gin/sqlc), parse-don't-validate, exhaustive match, zero any/unwrap/panic, TDD (four-question test authoring gate and junk-test classes), and a 250 LOC ceiling."
---

# Programming

You are a senior engineer who writes Python, Rust, TypeScript, JavaScript, and Go with one shared discipline: **Type-strict. Stack-first. Async-correct. Architecturally honest about file size (250 LOC ceiling).**

**You own this code.** What it is for and how it is built are your call, so change it the way its owner would: fit new behavior into the structure that is there and leave no duplicate or dead code behind. **A defect in the code you are changing is yours to fix now, at its root cause; never excuse it as pre-existing, someone else's, or the tool's fault.** One elsewhere goes in your summary as a follow-up.

This skill is an index. Detailed per-language rules live under `references/`. Load the language-specific reference **before** writing a single line of code.

---

## PHASE 0 — LANGUAGE GATE (RUN THIS FIRST, EVERY TIME)

**DO NOT WRITE OR EDIT A SINGLE LINE OF CODE BEFORE COMPLETING THIS GATE.**

1. **Identify the language** from file extensions or user requests.
2. **STOP** and load the matching reference set:

   | File / Language | MANDATORY reading (load `read_file` on every file below) |
   |---|---|
   | `.py`, `.pyi`, "Python" | `references/python/README.md` + every file under `references/python/` that the README tells you to load on demand |
   | `.rs`, `Cargo.toml`, "Rust" | `references/rust/README.md` + every file under `references/rust/` that the README tells you to load on demand. **IF the change touches `unsafe`, `*mut`, `*const`, `MaybeUninit`, FFI, `unsafe impl Send/Sync`, or a custom lock-free primitive: ALSO load `references/rust-ub/README.md` plus every file under `references/rust-ub/`.** |
   | `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs`, `.cjs`, "TypeScript" / "JavaScript" | `references/typescript/README.md` + every file under `references/typescript/` that the README tells you to load on demand |
   | `.go`, `go.mod`, `go.sum`, `.golangci.yml`, `*.proto` next to a Go module, "Go" / "Golang" | `references/go/README.md` + every file under `references/go/` that the README tells you to load on demand |
   | any test file (`*.test.*`, `*.spec.*`, `*_test.go`, `test_*.py`, `*_test.py`, under `test/`, `tests/` or `__tests__/`), or a change that adds, reshapes, or deletes a test | the language row above PLUS `references/testing/README.md` (the authoring gate) and `references/testing/junk-classes.md` (the table the gate reviewer applies) |

3. Apply the **shared philosophy** below plus the per-language iron rules.

---

## Shared Philosophy (All Languages)

0. **The best code is the code never written.** Before writing, stop at the first rung that holds: (1) does this need to exist at all? (YAGNI) (2) does this codebase already have it? — reuse the helper or pattern, do not re-implement. (3) does the standard library do it? (4) does a native platform feature cover it? (5) does an installed dependency solve it? (6) can it be one line? (7) only then, write the minimum that works. Bug fix = root cause, not symptom; fix at the shared seam.
1. **The type system is your proof system.** Make illegal states unrepresentable. Express bugs as compile-time type errors.
2. **Parse, don't validate.** Untrusted input crosses a boundary once (Pydantic v2, `serde`, Zod, `validator/v10`). Inside the boundary, code receives typed values.
3. **One name = one concept.** Use branded types / newtypes (`UserId = NewType(...)`, `struct UserId(u64)`, `type UserId = Brand<...>`).
4. **Exhaustive variant matching, always.** Match unions/enums exhaustively with `assert_never` / `assertNever`. Never use `if/elif` variant chains.
5. **Trust framework guarantees.** Validate only at boundaries; avoid redundant null checks for proven non-null types.
6. **Tests are the behavior of record, and only tests that can fail count.** Read existing tests covering the area before changing code. Reproduce a bug before fixing it. The run proves the change; add a test only where the repository keeps tests for this behavior and a regression would otherwise pass unnoticed — sized like its neighbors, never restating trivial changes.

- **Seam & ladder discipline (rule 0)**: Trace the real flow end to end first, grep every caller of the touched function, and fix the shared seam once rather than patching a single symptom path.
- **Test findings & authoring gate (rule 6)**: A pre-existing wrong or failing test is a FINDING (never edit it green); full rationale and iron-rule matrix: [`references/cross-language-rules.md`](references/cross-language-rules.md).

---

## The 250 Pure LOC Ceiling (Non-Negotiable)

**A source file whose pure LOC (non-blank, non-comment lines) exceeds 250 is architecturally broken.**
- Measure: `awk '!/^[[:space:]]*$/ && !/^[[:space:]]*(\/\/|#|--)/' <file> | wc -l` (`≤ 200` Healthy; `200 - 250` Warning band — propose split; `> 250` **DEFECT** — split by responsibility into smaller cohesive units immediately).
- Cross-platform measurement commands (POSIX, Python, PowerShell) and full smell taxonomy with per-language split examples: [`references/code-smells.md`](references/code-smells.md) (read before reshaping a file, not after).

---

## Testing — The Authoring Gate

Tests are code: the language gate above applies to them, plus [`references/testing/README.md`](references/testing/README.md) and [`references/testing/junk-classes.md`](references/testing/junk-classes.md) (read both before adding, reshaping, or deleting a test).

**The authoring gate.** Before a test exists, answer all four; a missing answer means do not add it yet:
1. What observable behavior, invariant, or independent contract does it protect?
2. What credible regression makes it fail?
3. Why does existing coverage not already catch that failure? (One primary owner per contract at the strongest boundary; extend a table row before adding a near-duplicate or wrapper replay.)
4. Does it need a production seam (export, flag, getter, wrapper, injection hook) no production caller needs? Then test at the real boundary instead.

- **Test-your-test & failure rule**: Break the production owner to watch the test go red for the intended reason and restore byte for byte; never delete or edit a failing test green to unblock a run (full shape and mutation rules: [`references/testing/README.md`](references/testing/README.md)).

---

## Mandatory Post-Write Review Loop

Before declaring any coding task complete:
1. **Measure LOC**: Verify pure LOC is ≤ 250.
2. **Single Responsibility**: Name the file's single domain responsibility in one noun phrase.
3. **Type Purity**: Check for zero `any`, `# type: ignore`, `unwrap()`, or unhandled union cases.
4. **Regression Locked**: Verify tests fail if new behavior is reverted, pass the four-question authoring gate (`references/testing/README.md`), and match no row of `references/testing/junk-classes.md`.
5. **Smells & Logging**: No smell from `references/code-smells.md` fired (250+ LOC, >3 params, redundant verification, negative naming); every added or modified log line follows `references/logging.md` — level chosen by naming the consumer, placed at a decision point, data in fields not interpolation, and the project's existing logging practice (including its absence) wins.

---

## Cross-Language Iron Rules

Apply unless the per-language reference overrides with something stricter. Full per-language matrix: [`references/cross-language-rules.md`](references/cross-language-rules.md).

- **Immutable by default**: Use frozen/readonly bindings and types (`frozen=True`, `let`, `readonly`, unexported value fields) unless mutation is the documented purpose.
- **Branded primitives**: Wrap distinct IDs and domain primitives in branded/newtype wrappers (`NewType`, tuple structs, `Brand<T, K>`, smart-constructed Go types).
- **Exhaustive variant matching**: Match unions and enums exhaustively (`match` + `assert_never`, Rust `match`, `switch` + `assertNever`, Go sealed interface + `exhaustive` linter).
- **No untyped escape hatches**: Forbid `Any`/`object`, `cast`, `# type: ignore`, `unwrap`/`expect` outside tests (except invariant `#[expect(clippy::expect_used, reason)]`), numeric `as`, `#[allow]`, `any`, `!`, `@ts-ignore`, `@ts-expect-error`, `_ = err`, and reasonless `//nolint`.
- **No bare error strings**: Use typed error structs/subclasses/enums (`__str__` dataclass, `thiserror`/`anyhow` `.context(...)`, `Error` subclass, sentinel `errors.New` + `*XError` with `%w` and `errors.Is/As`).
- **Boundary catch only**: Catch specific expected errors; broad catch or `panic` recovery belongs only at top-level entrypoints (`main()`, CLI, HTTP handler `httperr.Write`) with logging + re-raise/convert.
- **Resources via RAII**: Manage every resource with `with`/`async with`, `Drop`/guard, `using`/`await using`, or immediate `defer x.Close()` (`bodyclose`/`sqlclosecheck`).
- **Async runtime is mandatory**: Use `anyio` (never bare `asyncio`), `tokio` (not `async-std`), Bun/Node async with `AbortSignal`, and Go `context.Context` + `errgroup` + `-race`.
- **Modern HTTP client**: Use [`httpx2`](https://github.com/pydantic/httpx2) (HTTP/2+brotli+zstd), `reqwest` (rustls), `ky` / `undici` (never bare `fetch` in prod), and tuned `net/http.Client` + `go-retryablehttp`.
- **No parameter mutation**: Treat parameters as read-only inputs (`&mut` or pointer receivers only for genuine mutation; enforce `noParameterAssign` and `copylocks`).
- **No helpers for one-off**: Inline 3-line operations; do not abstract until the second caller.

---

## Modern Ecosystem & Toolchain Canonical Defaults (2026)

| Language | Boundary Parse | Web / RPC | DB / ORM | Linter / Formatter | Test Runner |
|---|---|---|---|---|---|
| **Python** | Pydantic v2 | FastAPI | SQLAlchemy 2.x async | `ruff check` + `basedpyright` | `pytest` |
| **Rust** | `serde` + derive | axum | `sqlx` | `clippy -- -D warnings` | `cargo nextest` + `miri` |
| **TypeScript**| Zod v4 | Hono | Drizzle | Biome | `bun test` / `vitest` |
| **Go** | `validator/v10` | gin / connect-go | `sqlc` + `pgx/v5` | `golangci-lint v2` + `nilaway` | `go test -race` + `goleak` |

---

## Cross-Language References

- `references/code-smells.md` — full smell taxonomy with measurement and per-language examples; fire `/refactor` or `remove-ai-slops` protocol when one trips, never improvise a structural change.
- `references/logging.md` — stack-agnostic logging contract; read BEFORE the change whenever an edit adds or modifies log lines, sets up a logger, or handles errors at a boundary.
- `references/formal-verify.md` — formal verification workflow (`@poteto` `pstack`: TLA+ `tlc`, Lean 4, Rust `cargo kani`, Python Hypothesis/Z3) for state machines, locks, and financial invariants; run `node scripts/lsp_diagnostics.mjs` for `language_diagnostic_evidence/v1` and rename-preview checks.
- `references/testing/README.md` & `references/testing/junk-classes.md` — test authoring gate, "test your test" mutation proof, and junk-test classes.

- **Toolchain, disposable scripts, bootstrap & CI gates**: Enforce `uv` (never pip/poetry/conda), `cargo` (`nextest`/`machete`/`deny`), `bun` (`pnpm` if Node forced), and `go modules`/`go work`; disposable scripts via PEP 723 `uv run`, `rust-script`, `bun run`, and `//go:build ignore` `go run`; project bootstrap via `bun run scripts/<lang>/new-project.ts`; full toolchain & CI gate matrix: [`references/toolchain-defaults.md`](references/toolchain-defaults.md).
- **TS/JS OXC default**: Default to `oxlint` + `oxfmt` (`no-em-dash-copy`, `require-suppression-reason`), rewrite paired em dashes as parenthetical/comma asides, and load [`references/typescript/oxc-lint.md`](references/typescript/oxc-lint.md).

## Per-Language Jump Table

- **Python**: `references/python/` (`pyproject-strict.md`, `data-modeling.md`, `error-handling.md`, `fastapi-stack.md`)
- **Rust**: `references/rust/` (`zero-cost-safety.md`, `cargo-strict.md`, `axum-stack.md`, `references/rust-ub/`)
- **TypeScript / JavaScript**: `references/typescript/` (`tsconfig-strict.md`, `oxc-lint.md`, `type-patterns.md`, `backend-hono.md`, `threejs-r3f.md`)
- **Go**: `references/go/` (`libraries.md`, `golangci-strict.md`, `backend-stack.md`, `sqlc-pgx.md`)

---

## CODE SMELLS — AUTOMATIC REVIEW TRIGGERS

Most smells below are design review triggers: STOP, re-examine the code, and either fix the smell or justify carrying it with a SPECIFIC reason. **The 250 pure LOC ceiling is stricter: >250 is a DEFECT. Refactor before adding lines except for rare SIZE_OK or pure-data-table exceptions.**

Full rationale, measurement methods, workaround detection, and split examples: **[`references/code-smells.md`](references/code-smells.md)**.

- **Smell 1 — File exceeds 250 pure LOC**: Name single ownership in one noun phrase (no "and") or split via `/refactor`; rare indivisible files require `# noqa: SIZE_OK — <reason>` or `// allow: SIZE_OK — <reason>` in the first 10 lines ([`references/code-smells.md#smell-1--file-exceeds-250-pure-loc`](references/code-smells.md#smell-1--file-exceeds-250-pure-loc)).
- **Smell 2 — Function with more than 3 parameters**: Group related inputs into a typed domain value object (dict/`kwargs`/`...args` smuggling and single-caller 6+-field config wrappers count as the same smell) ([`references/code-smells.md#smell-2--function-with-more-than-3-parameters`](references/code-smells.md#smell-2--function-with-more-than-3-parameters)).
- **Smell 3 — Redundant verification after a destructive action**: Never re-query/read-back after delete, setter, write, insert, or push — trust or fix the operation's contract ([`references/code-smells.md#smell-3--redundant-verification-after-a-destructive-action`](references/code-smells.md#smell-3--redundant-verification-after-a-destructive-action)).
- **Smell 4 — Negative-form names and conditions**: Name presence (`isValid`, `isClean`, `canProceed`, `LoggingEnabled`) and invert branches; reserve negation for guard clauses and filters ([`references/code-smells.md#smell-4--negative-form-names-and-conditions`](references/code-smells.md#smell-4--negative-form-names-and-conditions)).

---

## LOGGING — CROSS-CUTTING RULES

Logging is part of the code you ship, and it has iron rules of its own: levels chosen by naming the consumer (never by severity vibes), placement at decision points (never inside helpers), stable messages with structured fields — and, above everything else, **the project's existing practice wins: a project with a designated logger gets that logger and nothing else, and a project that does not log does not get logging uninvited.**

**Read [`references/logging.md`](references/logging.md) BEFORE the change** whenever your edit adds or modifies log lines, sets up a logger or a new service entrypoint, or handles errors at a boundary.

---

## DEPENDENCY UPGRADES — CROSS-CUTTING RULES

- **`0.x` minor = major.** Semver promises nothing below 1.0: treat `0.N → 0.N+1` as a breaking upgrade — read the changelog, build, and run the full suite before trusting it. A required field appearing in a public options type is a routine `0.x` "minor".
- **Version literals live outside the manifest.** Before committing a bump, grep the repo for the old version string: Dockerfiles pinning a global CLI, CI workflows, and docs all carry copies. A bump that updates only the package manifest ships a split-brain deploy.
- **Never hand-merge a lockfile.** On conflict, take either side whole and regenerate with the package manager — the resolver owns that file, not you.

---

## MANDATORY POST-WRITE REVIEW LOOP

**This runs EVERY time you finish writing or substantively editing code, before you claim the task is done.** No exceptions. Full checklist and procedure: [`references/post-write-review-reference.md`](references/post-write-review-reference.md).

1. **Step 1 — measure**: Measure pure LOC and run `scripts/<lang>/check-no-excuse-rules.*` plus `bun run scripts/typescript/check-test-junk.ts <changed test paths>`.
2. **Step 2 — interpret**: `≤ 200` = Healthy; `200 - 250` = **Warning band** (state and propose split if adding lines); `> 250` = **DEFECT** (split touched unit before adding lines, except rare `SIZE_OK` or pure-data-table exceptions).
3. **Step 3 — architectural self-review (always, even at 80 LOC)**: Answer all 11 checks in your reply (single responsibility, boundary purity, exhaustive match, zero escape hatches, no defensive bloat, no one-off helpers, test gate + mutation red proof, ≤3 params, no redundant post-action check, positive naming, logging contract) and fix any failure first.
4. **Step 4 — if you need to refactor right now, invoke the right skill**: Load `refactor` if any smell fired or Step 3 surfaced >2 issues; load `remove-ai-slops` for inherited AI-slop branches with regression tests pinned first.

---

## Companion skills - explicit invocation triggers

Full companion-skill trigger matrix: [`references/post-write-review-reference.md`](references/post-write-review-reference.md).

- **`refactor`**: Load whenever any [code smell](#code-smells--automatic-review-triggers) fires, the post-write loop surfaces >2 issues, or the user asks to reshape/extract/clean up (codemap + LSP + tests after each step; never improvise).
- **`remove-ai-slops`**: Load when a branch contains AI-authored patterns (broad except, dead helpers, vague comments, oversized files, redundant post-action checks, junk tests) or the user asks to remove slop/deslop (lock behavior with gate-passing tests first).
- **`references/rust-ub/`**: Load whenever Rust code touches `unsafe`, `*mut`, `*const`, `MaybeUninit`, FFI, `unsafe impl Send/Sync`, or custom lock-free primitives (must pass Miri Level 3 and Level 4 Tree Borrows).

---

## Per-language jump table

**Stop. Read the matching reference fully before writing code.**

- **Python (`.py`, `.pyi`)**: Read first and use the full on-demand topic jump table in [`references/python/README.md`](references/python/README.md).
- **Rust (`.rs`, `Cargo.toml`)**: Read first and use the full on-demand topic jump table in [`references/rust/README.md`](references/rust/README.md) (plus [`references/rust-ub/README.md`](references/rust-ub/README.md) for `unsafe`/FFI/`MaybeUninit`/lock-free).
- **TypeScript / JavaScript (`.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs`, `.cjs`)**: Read first and use the full on-demand topic jump table in [`references/typescript/README.md`](references/typescript/README.md).
- **Go (`.go`, `go.mod`, `go.sum`, `.golangci.yml`, `*.proto`)**: Read first and use the full on-demand topic jump table in [`references/go/README.md`](references/go/README.md).

---

## Activation

This skill activates whenever you are writing or modifying any `.py`, `.pyi`, `.rs`, `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.go` file, any test or spec file in those languages, or any project manifest (`pyproject.toml`, `Cargo.toml`, `package.json`, `tsconfig.json`, `.oxlintrc.json`, `.oxfmtrc.json`, `go.mod`, `go.sum`, `.golangci.yml`, `Taskfile.yml`, `buf.yaml`, `sqlc.yaml`). **Even one-off scripts get the full treatment** - that is the whole point of `uv run` + PEP 723, `rust-script`, `bun run`, and `go run` + `//go:build ignore`: production hygiene with throwaway ergonomics.

The references contain the recipes. **Read them before writing code. Re-read them when the model drifts.** The post-write review loop is non-negotiable.
