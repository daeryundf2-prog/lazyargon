# Cross-Language Iron Rules

## Shared Philosophy (All Languages)

0. **The best code is the code never written.** Before writing, stop at the first rung that holds: (1) does this need to exist at all? (YAGNI) (2) does this codebase already have it? — reuse the helper or pattern, do not re-implement. (3) does the standard library do it? (4) does a native platform feature cover it? (5) does an installed dependency solve it? (6) can it be one line? (7) only then, write the minimum that works. Bug fix = root cause, not symptom; fix at the shared seam.
1. **The type system is your proof system.** Make illegal states unrepresentable. Express bugs as compile-time type errors.
2. **Parse, don't validate.** Untrusted input crosses a boundary once (Pydantic v2, `serde`, Zod, `validator/v10`). Inside the boundary, code receives typed values.
3. **One name = one concept.** Use branded types / newtypes (`UserId = NewType(...)`, `struct UserId(u64)`, `type UserId = Brand<...>`).
4. **Exhaustive variant matching, always.** Match unions/enums exhaustively with `assert_never` / `assertNever`. Never use `if/elif` variant chains.
5. **Trust framework guarantees.** Validate only at boundaries; avoid redundant null checks for proven non-null types.
6. **Tests are the behavior of record, and only tests that can fail count.** Read existing tests covering the area before changing code. Reproduce a bug before fixing it. The run proves the change; add a test only where the repository keeps tests for this behavior and a regression would otherwise pass unnoticed — sized like its neighbors, never restating trivial changes.

## Shared Philosophy Rationale (Rule 0 & Rule 6)

- **Seam & ladder discipline (rule 0)**: Climb the ladder *after* you understand the problem and trace the real flow end to end — the smallest diff in the wrong place is a second bug. The ladder is a fast decision, not a written essay: pick the rung and move. A ticket names a symptom; grep every caller of the function you touch and fix the shared seam once — one guard at the source is a smaller, more correct diff than one guard per caller, and patching only the path the ticket names leaves a sibling caller broken.
- **Test findings & authoring gate (rule 6)**: Before changing code, check whether existing tests encode the intent, cover this path, and pass; a test that is wrong or failing before your change is a FINDING — never edit it green. The authoring gate and the junk-class table live in `references/testing/`.

## Per-Language Iron Rules Matrix

Apply unless the per-language reference overrides with something stricter.

| Rule | Python | Rust | TypeScript | Go |
|---|---|---|---|---|
| Immutable by default | `@dataclass(frozen=True, slots=True)` / Pydantic `frozen=True` | every binding is `let` (not `let mut`) unless mutation is the documented purpose | every field is `readonly`; arrays are `readonly T[]` | value types, unexported fields, no mutation methods unless mutation is the purpose |
| Branded primitives | `UserId = NewType("UserId", int)` | `struct UserId(u64);` (newtype tuple) | `type UserId = Brand<string, "UserId">` | `type UserID string` + smart constructor with unexported field |
| Exhaustive variant matching | `match` + `assert_never` | `match` (compiler-enforced) | `switch` + `assertNever` | sealed interface + type switch + **`exhaustive` linter** (the compiler will not help) |
| No untyped escape hatches | no `Any` in public sigs, no `cast`, no `# type: ignore` | no `unwrap`/`expect` outside tests (invariant `expect` only behind `#[expect(clippy::expect_used, reason)]`), no numeric `as`, no `#[allow]` (silence with `#[expect(lint, reason)]`) | no `any`, no `as` (except `as const`, `satisfies`), no `!`, no `@ts-ignore`, no `@ts-expect-error` | no `interface{}` / bare `any` in domain sigs; no `_ = err`; no `//nolint` without reason |
| No bare error strings | typed exception dataclass with `__str__` | `thiserror` enum (lib) or `anyhow` with `.context(...)` (app) | `Error` subclass with typed fields | sentinel `errors.New` + typed `*XError` struct; wrap with `%w`; check via `errors.Is/As` |
| Boundary catch only | catch the exact exception you expect; broad `except Exception` only at a top-level boundary (`main()`/CLI entry, HTTP handler), with logging + re-raise | `?` everywhere; never `panic!` in library code | `catch` must narrow with `instanceof` and re-throw or convert; no empty catch | every `(T, error)` checked; `panic` only in `main`/tests; one `httperr.Write` funnel in handlers |
| Resources via RAII | `with` (sync) / `async with` (async) | `Drop` impl or RAII guard | `using`/`await using` (TC39 explicit resource management) | `defer x.Close()` immediately after acquisition; `bodyclose`/`sqlclosecheck` linters enforce |
| Async runtime is mandatory | `anyio` (NEVER bare `asyncio`) | `tokio` (`async-std` is unmaintained) | platform-native async (Bun/Node) with structured cancellation via `AbortSignal` | `context.Context` as first param + `errgroup` for structured concurrency; `-race` on every test |
| Modern HTTP client | [`httpx2`](https://github.com/pydantic/httpx2) with HTTP/2 + brotli + zstd | `reqwest` with rustls | `ky` (default) / `undici` direct API (Node perf) - NEVER bare `fetch` in prod | stdlib `net/http.Client` with tuned `Transport` + `go-retryablehttp` for retry/backoff |
| No parameter mutation | params are inputs; produce a new value | `&mut` only when mutation is the documented purpose | parameters never reassigned (`noParameterAssign`) | value receivers when not mutating; pointer receivers only for genuine mutation; `copylocks` vet enforces |
| No helpers for one-off | inline a 3-line operation; do not abstract until the second caller | same | same | same |
