# Modern Ecosystem & Toolchain Canonical Defaults (2026)

| Language | Boundary Parse | Web / RPC | DB / ORM | Linter / Formatter | Test Runner |
|---|---|---|---|---|---|
| **Python** | Pydantic v2 | FastAPI | SQLAlchemy 2.x async | `ruff check` + `basedpyright` | `pytest` |
| **Rust** | `serde` + derive | axum | `sqlx` | `clippy -- -D warnings` | `cargo nextest` + `miri` |
| **TypeScript**| Zod v4 | Hono | Drizzle | Biome | `bun test` / `vitest` |
| **Go** | `validator/v10` | gin / connect-go | `sqlc` + `pgx/v5` | `golangci-lint v2` + `nilaway` | `go test -race` + `goleak` |

## Cross-Language Toolchain & CI Matrix

| Tool category | Python | Rust | TypeScript | Go |
|---|---|---|---|---|
| Package / project manager | **uv** (NEVER pip/poetry/conda) | **cargo** + `cargo-nextest` + `cargo-machete` + `cargo-deny` | **Bun** (runtime + package manager); pnpm if Node is forced | **`go modules`** + `go work` for monorepos |
| Type checker | **basedpyright** with `typeCheckingMode = "all"` | the Rust compiler with `-D warnings` + clippy `pedantic` + `nursery` + `cargo` groups | `tsc --noEmit` (or `tsgo` when available) with `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `verbatimModuleSyntax` | the Go compiler + **`golangci-lint v2`** with the strict bundle + **`nilaway`** (nil-deref static analysis) |
| Linter + formatter | **ruff** with `select = ["ALL"]` | `clippy` + `rustfmt` | **oxlint + oxfmt**, with the local copy and suppression-reason rules | **`gofumpt`** (stricter gofmt) + `goimports -local` + `golangci-lint v2` |
| Test runner | **pytest** | **cargo-nextest** | `bun test` / `vitest` | stdlib `go test -race -shuffle=on -count=1` + `goleak` |
| UB / soundness gate | (n/a) | **nightly miri** with strict provenance + Tree Borrows pass | (n/a) | **`nilaway`** + `-race` detector + `goleak` are the equivalent gate |
| Disposable scripts | **PEP 723** inline metadata + `uv run script.py` | **rust-script** with inline `Cargo.toml` block | `bun run script.ts` | `//go:build ignore` + `go run script.go` |
| Bootstrap a new project | `bun run scripts/python/new-project.ts` | `bun run scripts/rust/new-project.ts` | `bun run scripts/typescript/new-project.ts` | `bun run scripts/go/new-project.ts` |
| Pre-commit / CI gate | `ruff check . && basedpyright && pytest` | `cargo clippy --all-targets -- -D warnings && cargo nextest run && cargo test --doc && cargo +nightly miri nextest run` | `bunx oxlint --type-aware --deny-warnings && bunx oxfmt --check && bunx tsc --noEmit && bun test` | `gofumpt -l . && golangci-lint run ./... && nilaway ./... && go test -race -shuffle=on -count=1 ./...` |

For TS/JS, **use oxlint + oxfmt with these two rules by default**: `no-em-dash-copy` and `require-suppression-reason`. Strongly prefer this OXC toolchain for new projects; retain ESLint, Prettier, or Biome only when the repository already uses them. Load [`references/typescript/oxc-lint.md`](typescript/oxc-lint.md) for the complete configs, plugin, and type-aware support requirements. Rewrite paired em dashes as asides using parentheses or commas, not colon chains.
