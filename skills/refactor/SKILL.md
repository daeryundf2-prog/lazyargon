---
name: refactor
description: "Intelligent refactor command. Triggers: refactor, refactoring, cleanup, restructure, extract, simplify, modernize."
---

## Antigravity Tool Mapping (default)

This plugin runs on **Google Antigravity** (`Model: "inherit"`).

| Intent | Antigravity action |
| --- | --- |
| Explore / research / plan / implement / QA / review | `invoke_subagent` + TASK/DELIVERABLE/SCOPE/VERIFY + role envelope |
| Wait / poll children | Stay in parent; re-invoke incomplete lanes |
| Child model hint | Pass `Subagents[].Model: "inherit"` (or `"flash_lite"` only for emergency quota fallback) |

Use Antigravity tools only (`invoke_subagent`). Do **not** invent foreign spawn/wait/goal APIs or OpenCode kwargs.

## Usage

```text
/refactor <refactoring-target> [--scope=<file|module|project>] [--strategy=<safe|aggressive>]

Arguments:
  refactoring-target: What to refactor. Can be:
    - File path: src/auth/handler.ts
    - Symbol name: "AuthService class"
    - Pattern: "all functions using deprecated API"
    - Description: "extract validation logic into separate module"

Options:
  --scope: Refactoring scope (default: module)
    - file: Single file only
    - module: Module/directory scope
    - project: Entire codebase

  --strategy: Risk tolerance (default: safe)
    - safe: Conservative, maximum test coverage required
    - aggressive: Allow broader changes with adequate coverage
```

## What This Command Does

Performs intelligent, deterministic refactoring with full codebase awareness. Unlike blind search-and-replace, this command:

1. **Understands your intent** — Analyzes what you actually want to achieve
2. **Maps the codebase** — Builds a definitive codemap before touching anything
3. **Assesses risk** — Evaluates test coverage and determines verification strategy
4. **Plans meticulously** — Creates an atomic step-by-step refactoring plan
5. **Executes precisely** — Step-by-step refactoring with `replace_file_content` and `sg` (`ast-grep` CLI)
6. **Verifies constantly** — Runs tests and typecheckers after each change to ensure zero regression

---

# PHASE 0: INTENT GATE (MANDATORY FIRST STEP)

**BEFORE ANY ACTION, classify and validate the request.**

## Step 0.1: Parse Request Type

| Signal | Classification | Action |
|--------|----------------|--------|
| Specific file/symbol | Explicit | Proceed to codebase analysis |
| "Refactor X to Y" | Clear transformation | Proceed to codebase analysis |
| "Improve", "Clean up" | Open-ended | **MUST ask**: "What specific improvement?" |
| Ambiguous scope | Uncertain | **MUST ask**: "Which modules/files?" |
| Missing context | Incomplete | **MUST ask**: "What's the desired outcome?" |

## Step 0.2: Validate Understanding

Before proceeding, confirm:
- [ ] Target is clearly identified
- [ ] Desired outcome is understood
- [ ] Scope is defined (file/module/project)
- [ ] Success criteria can be articulated

**If ANY of above is unclear, ask a clarifying question via `ask_question` or direct text:**

```text
I want to make sure I understand the refactoring goal correctly.

**What I understood**: [interpretation]
**What I'm unsure about**: [specific ambiguity]

Options I see:
1. [Option A] - [implications]
2. [Option B] - [implications]

**My recommendation**: [suggestion with reasoning]

Should I proceed with [recommendation], or would you prefer differently?
```

## Step 0.3: Lock Scope & Phase Checklist

**IMMEDIATELY after understanding the request, lock the 3-line scope (`목표 / 완료 조건 / 범위`) and track the 6 phases:**

- [ ] **PHASE 1**: Codebase Analysis — launch parallel explore subagents (3–4 lanes max by default)
- [ ] **PHASE 2**: Build Codemap — map dependencies and impact zones
- [ ] **PHASE 3**: Test Assessment — analyze test coverage and verification strategy
- [ ] **PHASE 4**: Plan Generation — create atomic refactoring plan with rollback steps
- [ ] **PHASE 5**: Execute Refactoring — step-by-step edits with continuous verification
- [ ] **PHASE 6**: Final Verification — full test suite, typecheck, and regression check

---

# PHASE 1: CODEBASE ANALYSIS (PARALLEL EXPLORATION)

## 1.1: Launch Parallel Explore Subagents

For multi-module refactors, dispatch up to 3–4 focused scouts simultaneously using `invoke_subagent` (`Model: "inherit"`):

```javascript
invoke_subagent({
  Subagents: [
    {
      TypeName: "self",
      Role: "Refactoring Target & Dependency Scout",
      Model: "inherit",
      Prompt: `TASK: Find all definitions, occurrences, and import/dependency chains of [TARGET].
DELIVERABLE: file paths, line numbers, usage patterns, and dependency graph.
SCOPE: repository read-only
VERIFY: parent re-reads cited paths`
    },
    {
      TypeName: "self",
      Role: "Pattern & Architecture Scout",
      Model: "inherit",
      Prompt: `TASK: Find similar code patterns, module boundaries, and architectural conventions around [TARGET].
DELIVERABLE: analogous implementations, layer structure, and design patterns in use.
SCOPE: repository read-only
VERIFY: parent cross-checks cited conventions`
    },
    {
      TypeName: "self",
      Role: "Test Coverage Scout",
      Model: "inherit",
      Prompt: `TASK: Find all test files and test cases related to [TARGET].
DELIVERABLE: test file paths, test case names, and coverage gaps.
SCOPE: repository read-only
VERIFY: parent runs discovered test files`
    }
  ],
  toolAction: "Exploring refactoring scope and impact",
  toolSummary: "Parallel refactoring scouts"
})
```

## 1.2: Direct Tool Exploration

For 1–2 file refactors or while subagents are running, use Antigravity native tools directly:

### Code Navigation & Diagnostics (`grep_search`, `view_file`, `run_command`):

```bash
# Check baseline typecheck / compiler diagnostics before starting
tsc --noEmit          # TypeScript
basedpyright          # Python
cargo check           # Rust
go vet ./...          # Go
```

### AST-Grep (`sg` CLI via `run_command`) for Structural Pattern Analysis:

```bash
# Find structural patterns across the codebase
sg run -p 'function $NAME($$$) { $$$ }' -l ts src/

# Preview structural rewrite (dry-run — outputs diff without modifying files)
sg run -p '[old_pattern]' -r '[new_pattern]' -l ts src/
```

### Exact Symbol & Text Search:
Use `grep_search` (ripgrep) and `find_by_name` to locate symbol definitions, imports, and references across `src/`.

## 1.3: Collect Subagent Results

Wait for subagent completion messages (`send_message` Reactive Wakeup — do not poll in a loop).

---

# PHASE 2: BUILD CODEMAP (DEPENDENCY MAPPING)

## 2.1: Construct Definitive Codemap

Based on Phase 1 results, build:

```markdown
## CODEMAP: [TARGET]

### Core Files (Direct Impact)
- `path/to/file.ts:L10-L50` - Primary definition
- `path/to/file2.ts:L25` - Key usage

### Dependency Graph
[TARGET]
├── imports from:
│   ├── module-a (types)
│   └── module-b (utils)
├── imported by:
│   ├── consumer-1.ts
│   ├── consumer-2.ts
│   └── consumer-3.ts
└── used by:
    ├── handler.ts (direct call)
    └── service.ts (dependency injection)

### Impact Zones
| Zone | Risk Level | Files Affected | Test Coverage |
|------|------------|----------------|---------------|
| Core | HIGH | 3 files | 85% covered |
| Consumers | MEDIUM | 8 files | 70% covered |
| Edge | LOW | 2 files | 50% covered |

### Established Patterns
- Pattern A: [description] - used in N places
- Pattern B: [description] - established convention
```

## 2.2: Identify Refactoring Constraints

Based on codemap:
- **MUST follow**: [existing patterns identified]
- **MUST NOT break**: [critical dependencies]
- **Safe to change**: [isolated code zones]
- **Requires migration**: [breaking changes impact]

---

# PHASE 3: TEST ASSESSMENT (VERIFICATION STRATEGY)

## 3.1: Detect Test Infrastructure

Inspect `package.json`, `pyproject.toml`, `Cargo.toml`, or `go.mod` via `view_file` or `find_by_name` to identify the project's test runner and typechecker.

## 3.2: Analyze Test Coverage

```javascript
invoke_subagent({
  Subagents: [{
    TypeName: "self",
    Role: "Test Coverage Analyzer",
    Model: "inherit",
    Prompt: `Analyze test coverage for [TARGET]:
1. Which test files cover this code?
2. What test cases exist?
3. Are there integration tests?
4. What edge cases are tested?
5. Estimated coverage percentage?`
  }],
  toolAction: "Analyzing test coverage for refactoring target",
  toolSummary: "Test coverage analysis"
})
```

## 3.3: Determine Verification Strategy

Based on test analysis:

| Coverage Level | Strategy |
|----------------|----------|
| HIGH (>80%) | Run existing tests after each step |
| MEDIUM (50-80%) | Run tests + add safety assertions |
| LOW (<50%) | **PAUSE**: Propose adding tests first |
| NONE | **BLOCK**: Refuse aggressive refactoring |

**If coverage is LOW or NONE, ask user:**

```text
Test coverage for [TARGET] is [LEVEL].

**Risk Assessment**: Refactoring without adequate tests is dangerous.

Options:
1. Add tests first, then refactor (RECOMMENDED)
2. Proceed with extra caution, manual verification required
3. Abort refactoring

Which approach do you prefer?
```

## 3.4: Document Verification Plan

```markdown
## VERIFICATION PLAN

### Test Commands
- Unit: `bun test` / `npm test` / `pytest` / `cargo test` / `go test ./...`
- Integration: [command if exists]
- Type check: `tsc --noEmit` / `basedpyright` / `cargo check` / `go vet ./...`

### Verification Checkpoints
After each refactoring step:
1. Type check — zero new errors
2. Run test command — all pass
3. Linter check — clean

### Regression Indicators
- [Specific test that must pass]
- [Behavior that must be preserved]
- [API contract that must not change]
```

---

# PHASE 4: PLAN GENERATION

## 4.1: Generate Detailed Refactoring Plan

For complex multi-module refactors, invoke a planning subagent (`Model: "inherit"`), or draft the atomic plan directly for 1–2 file scopes:

```javascript
invoke_subagent({
  Subagents: [{
    TypeName: "self",
    Role: "Refactoring Plan Architect",
    Model: "inherit",
    Prompt: `Create a detailed refactoring plan:

## Refactoring Goal
[User's original request]

## Codemap (from Phase 2)
[Insert codemap here]

## Test Coverage (from Phase 3)
[Insert verification plan here]

## Constraints
- MUST follow existing patterns: [list]
- MUST NOT break: [critical paths]
- MUST run tests after each step

## Requirements
1. Break down into atomic refactoring steps
2. Each step must be independently verifiable
3. Order steps by dependency (what must happen first)
4. Specify exact files and line ranges for each step
5. Include rollback strategy for each step
6. Define commit checkpoints`
  }],
  toolAction: "Generating detailed refactoring plan",
  toolSummary: "Refactoring plan generation"
})
```

## 4.2: Review and Validate Plan

After generating the plan:

1. **Verify completeness**: All identified files addressed?
2. **Verify safety**: Each step reversible?
3. **Verify order**: Dependencies respected?
4. **Verify verification**: Test commands specified?

---

# PHASE 5: EXECUTE REFACTORING (DETERMINISTIC EXECUTION)

## 5.1: Execution Protocol

For EACH refactoring step:

### Pre-Step
1. Read current file state via `view_file`
2. Confirm baseline tests and typecheck are green

### Execute Step
Use the appropriate Antigravity tool:

**For Pattern & Symbol Transformations (`sg` CLI via `run_command`):**
```bash
# 1. Preview first (dry-run diff)
sg run -p '[old_pattern]' -r '[new_pattern]' -l ts src/

# 2. If preview is exact, apply atomically
sg run -p '[old_pattern]' -r '[new_pattern]' -l ts --update-all src/
```

**For Precise File Edits:**
Use `replace_file_content` (or `write_to_file` when extracting a new module) with exact line ranges and target content.

### Post-Step Verification (MANDATORY via `run_command`)

```bash
# 1. Type check (must be clean or match baseline)
tsc --noEmit   # or basedpyright / cargo check / go vet ./...

# 2. Run test suite
bun test       # or npm test / pytest / cargo test / go test ./...
```

### Step Completion
1. If verification passes — proceed to next step
2. If verification fails — **STOP AND FIX**

## 5.2: Failure Recovery Protocol

If ANY verification fails:

1. **STOP** immediately
2. **REVERT** the failed change (`git checkout -- <file>` or `replace_file_content`)
3. **DIAGNOSE** what went wrong
4. **OPTIONS**:
   - Fix the issue and retry
   - Skip this step (if optional)
   - Dispatch a diagnostic subagent (`Model: "inherit"`) for root-cause analysis
   - Ask user for guidance

**NEVER proceed to next step with broken tests.**

## 5.3: Commit Checkpoints

When the user has requested commits at logical checkpoints:

```bash
git add [changed-files]
git commit -m "refactor(scope): description

[details of what was changed and why]"
```

---

# PHASE 6: FINAL VERIFICATION (REGRESSION CHECK)

## 6.1: Full Test Suite

```bash
bun test  # or npm test, pytest, cargo test, go test ./...
```

## 6.2: Type Check

```bash
tsc --noEmit  # or basedpyright, cargo check, go vet ./...
```

## 6.3: Lint Check

```bash
npx biome check .  # or eslint ., ruff check ., cargo clippy, golangci-lint run
```

## 6.4: Build Verification (if applicable)

```bash
bun run build  # or npm run build, cargo build, go build ./...
```

## 6.5: Generate Summary

```markdown
## Refactoring Complete

### What Changed
- [List of changes made]

### Files Modified
- `path/to/file.ts` - [what changed]
- `path/to/file2.ts` - [what changed]

### Verification Results
- Tests: PASSED (X/Y passing)
- Type Check: CLEAN
- Lint: CLEAN
- Build: SUCCESS

### No Regressions Detected
All existing tests pass. No new errors introduced.
```

---

# CRITICAL RULES

## NEVER DO
- Skip typecheck or test runs after changes
- Proceed with failing tests
- Make changes without understanding impact
- Use `as any`, `@ts-ignore`, `@ts-expect-error`, `# type: ignore`
- Delete tests to make them pass
- Commit broken code
- Refactor without understanding existing patterns

## ALWAYS DO
- Understand before changing (`view_file`, `grep_search`)
- Preview AST rewrites before applying (`sg run -p ... -r ...` without `--update-all` first)
- Verify after every change (`run_command` tests + typecheck)
- Follow existing codebase patterns
- Report issues immediately

## ABORT CONDITIONS
If any of these occur, **STOP and consult user**:
- Test coverage is zero for target code
- Changes would break public API
- Refactoring scope is unclear
- 3 consecutive verification failures
- User-defined constraints violated

---

# Tool Usage Philosophy

## Search & Navigation (`grep_search`, `find_by_name`, `view_file`)
- **Understand before changing**: Read definition and surrounding context with `view_file`.
- **Impact analysis**: Map all usages and imports across the workspace with `grep_search`.
- **Continuous verification**: Run the project's typechecker and test runner via `run_command` after every change.

## AST-Grep (`sg` CLI via `run_command`)
Use `sg run -p '<pattern>' -r '<rewrite>' -l <lang>` for structural transformations. Always preview without `--update-all` first, review the diff output, and then execute with `--update-all`.

## Subagents (`invoke_subagent`)
- Dispatch parallel read-only exploration, architectural planning, or verification lanes with `TypeName: "self"` (or `"research"`) and `Model: "inherit"` (default 3–4 lanes max).
- When encountering deprecated methods or library migrations, query official docs (`context7` MCP or web search) before modifying code, and **DO NOT auto-upgrade to latest major version** unless explicitly requested by the user.

---

# Antigravity Parallel Execution

Do **not** use OpenCode `team_*` or `Task(...)` tools on Antigravity. Dispatch independent refactor/verify lanes with `invoke_subagent` (`Model: "inherit"`, including `toolAction` and `toolSummary`). Stay in the parent and wait for `send_message` completion notifications.

## References

- [ast-refactor](references/ast-refactor.md) — symbol/call-graph-driven refactoring via `sg` CLI
- [remove-ai-slops](references/remove-ai-slops.md) — AI slop cleanup checklist across 10 categories
