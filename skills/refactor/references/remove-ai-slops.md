# Remove AI Slops — Refactor Reference

Canonical protocol: **`skills/remove-ai-slops/SKILL.md`** (`$remove-ai-slops`). Read and execute that file in full whenever a refactor run includes AI-slop cleanup; this file is a compact checklist pointer, not a separate copy.

## Antigravity Tool Surface

- **Parallel cleanup / adversarial review**: flat `invoke_subagent({ TypeName: "self", Role, Model: "inherit", Prompt })` calls (batches of 3–5 files; `"flash_lite"` only for emergency quota fallback; wait for `send_message` notifications).
- **Direct file operations**: `read_file`, `edit_file`, `write_file` (≤100-line / <20KB chunks, re-read via `read_file`).
- **Search, AST & verification**: `run_command` with `rg`, `sg` (`ast-grep`), typecheckers (`tsc --noEmit`, `basedpyright`, `cargo check`, `go vet ./...`), and test runners (one approval-gated command per turn).

## Core Safety Invariant & Deletion Ladder

1. **Green baseline first**: lock observable behavior with regression tests before deleting or reshaping any code (prose/markdown files exempt).
2. **Deletion ladder before per-line cleanup**: (a) delete entirely (YAGNI/dead), (b) reuse existing repo helper, (c) replace with platform/stdlib/installed dependency, (d) simplify in place.

## 10 Slop Categories (Safest → Riskiest Order)

Apply in order: `comments → dead code → defensive → duplication → complexity → abstraction/boundary → performance → tests → oversized-modules`.

1. **Obvious comments** — remove WHAT restatements; keep WHY notes, ticket links, and BDD markers.
2. **Over-defensive code** — remove redundant internal guards and bare catch-alls; keep boundary validation unless an adversarial test proves redundancy.
3. **Excessive complexity** — flatten >3-level nesting, nested ternaries, `object` annotations, and `if/elif` variant chains (`match` + `assert_never`).
4. **Needless abstraction** — collapse pass-through wrappers, single-use helpers, and speculative interfaces.
5. **Boundary violations** — fix wrong-layer imports, leaky handlers, and hidden state coupling.
6. **Dead code** — delete unused imports, unreachable branches, stale flags, and debug prints.
7. **Duplication** — merge identical logic while preserving distinct domain intents.
8. **Performance equivalences** — apply only provably behavior-identical wins (`O(n²)→O(n)` set lookup, loop hoisting, batching).
9. **Missing tests** — pin uncovered runtime behavior with narrow regression tests.
10. **Oversized modules (>250 pure LOC)** — split by single responsibility using language `check-no-excuse-rules` scripts under `skills/programming/scripts/`.
