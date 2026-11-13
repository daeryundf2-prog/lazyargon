# /ulw model routing by role

Numbers come from our own tests (small samples; re-measure before tightening). Vendor benchmark tables are not used: the Hydrogen column in the table the owner shared contains unofficial cells, so no Hydrogen number here comes from it.

| Role | Model | Evidence | Fallback |
|---|---|---|---|
| Default | Argon high | Common 100 verdict cases: 72/100 exact, 1 error, median 38 s (best of three) | Argon medium |
| Plan, design, final review, security audit | Argon high | Carbon high matched Argon when it answered (72.1% vs 72.7%) but 14 of 100 failed or timed out and its median was 212 s, so a 180 s cap would cut off most calls | - |
| Long context (~250k+ tokens) | Carbon high, cap 180 s | Only role where Argon cannot take the input | Argon high on timeout |
| Verdict, review, verification | Argon high | As above; Hydrogen high 65/100 with the most clean false alarms (10/33) | Hydrogen xhigh with the v2 prompt |
| Implementation, edits, test runs | Argon high (default); Hydrogen high for long or flaky test-verified execution | All implementation arms passed 5/5 on F13; Argon high was cheapest (see below) | Argon high |
| PII, prompt-injection, docfmt and judgment checks | Argon high or Hydrogen xhigh, v2 prompt required | Original prompt: PII weak for every model (best 3/6 on the 100 set). v2 retest: xhigh inject 32/32, pii 38/38, clean false positives 0/24; Hydrogen high had 36% (8/22), so high is never a gate | Carbon for a suspect |
| Orchestrator | no role yet | Verdict tasks are answered by Carbon alone (250 s, 10 of 67 failed); implementation comparison pending | - |

Quota rule: Carbon only for long-context input; everything else runs on Argon high, with Hydrogen high for long test-verified execution.

Pilot, orchestration style (8 cases F06/F12/F13/F10, n too small to conclude): a split pipeline (Carbon plan, Argon medium implement, Carbon review) passed 6/8 against 4/8 for Flash worker plus Argon verifier. The gap was all F13 code fixes (Flash made no edits, 0/2). The split pipeline took about 2-3x longer. Neither style passed the long Korean report family (F12, 0/2). Four-arm numbers (Swarm, Orchestrator, native, Lazy) follow in the PR discussion.

Caveats:
- `invoke_subagent.Model` documents only `inherit`, `flash` and `flash_lite`. This table sets the session model; explicit model ids as the subagent `Model` are unverified.

## Implementation arms (orch-pilot, 2026-11-13)

Five F13 code-fix cases (edit a Python file until hidden tests pass), run sequentially with agy 1.5.6. "Plain" arms ran in an isolated HOME without the lazyargon plugin. Quota is the drop in weekly percentage across the arm; readings are noisy at this size.

| Arm | n | Pass | Median s | Tokens/case | Weekly pts |
|---|---|---|---|---|---|
| plain Argon high | 5 | 5 | 32 | 17.5k | 0.01 |
| plain Hydrogen high | 5 | 5 | 28 | 22.8k | ~0 |
| subagents (Argon high) | 5 | 5 | 131 | 33.3k | 0.32 |
| built-in Orchestrator | 5 | 5 | 110 | 47.0k | 0.35 |
| lazyorch (plan/work/review) | 5 | 5 | 202 | 78.8k | 0.28 |
| lazy (3-stage /ulw) | 5 | 5 | 182 | 109.2k | 0.35 |
| swarm (Carbon coordinator) | 3 | 3 | 247 | ~87k | 0.80 |
| boost | 2 | 2 | ~100 | ~27.5k | n/a |

Every arm passed every case, so these cases cannot separate quality; the default is chosen on cost. They are easy single-file fixes. Orchestration modes are unmeasured on large multi-file tasks, where they may pay for themselves. Revisit when harder cases are added.

## Limit of this evidence: F13 is at ceiling

Every arm passed every F13 case, so F13 separates cost but not performance. The default (single-session Argon high) is chosen on cost only. Next step: at least 10 harder multi-file implementation cases with Carbon-only and Argon-only arms added, timeouts counted as failures, before any orchestration mode is adopted or rejected on quality.

## 100-case verdict comparison (2026-11-13)

Same 100 cases for each model (13 families), original bench prompt, agy print timeout 10 min counted as an error. Built from the first test plus a fill-in run of 119 calls.

| Model | Exact | Errors / timeouts | Exact when answered | Missed bad (said pass) | False alarm on clean | PII caught | Inject caught | Median s |
|---|---|---|---|---|---|---|---|---|
| Argon high | 72 | 1 | 72.7% | 7/67 | 7/33 | 3/6 | 5/5 | 38 |
| Carbon high | 62 | 14 | 72.1% | 4/67 | 7/33 | 0/6 | 5/5 | 212 |
| Hydrogen high | 65 | 0 | 65.0% | 9/67 | 10/33 | 2/6 | 5/5 | 24 |

The fill-in run used about 4 weekly points for 119 calls (about 0.034 per call). Carbon's errors were concentrated in image cases (7 of 14).

## Task router

`/ulw` runs `node scripts/classify-task.mjs "<task description>"` at the start of every task (before writing `.lazyargon/ulw-scope.md`) and follows its JSON output. The classifier reads `task_kinds` from `skills/ulw/references/model-routing.json`; no model names are hardcoded in the script or in `skills/ulw/SKILL.md`.

| Task kind | Signals (sample) | Role | Action |
|---|---|---|---|
| `judgment` | review, audit, verify, PR, 리뷰, 검증, 검토, 감사 | `verdict_review` | delegate via invoke_subagent pro |
| `long_execution` | tdd, until tests pass, flaky, 테스트 통과 | `long_execution` | proceed in session model + notice |
| `implementation` | implement, fix, refactor, 구현, 수정, 리팩터링 | `implementation` | delegate via invoke_subagent pro |
| `sensitive` | pii, injection, 개인정보, 주민번호, 인젝션 | `pii_inject_docfmt` | delegate via invoke_subagent pro, apply v2 flag/fail rule |
| `long_context` | entire codebase, 판결문, 수백, 전체 저장소 | `long_context` | proceed in session model + notice |
| `general` | (no match) | `default` | delegate via invoke_subagent pro |

Size (`single` / `subagents`): (1) ≥3 code-file paths in the prompt (e.g. `src/a.ts src/b.ts src/c.ts`) → subagents; (2) explicit file count ≥3 ("3 files", "3개 파일") → subagents; (3) `modes.subagents.size_signals` keywords ("parallel", "독립적", "여러 파일") → subagents; otherwise single.

**Verified paths inside a /ulw session:**
- `invoke_subagent Model: "pro"` (→ Argon) — **verified**: documented tier, confirmed in AGENTS.md.
- `agy --model <id>` from a terminal — confirmed at the CLI level only.
- `agy --model <id>` via `run_command` inside a /ulw session (print mode, different tool permissions, separate context) — **unverified-nested**: never tested. Until verified, Hydrogen/Carbon tasks proceed in the current session model with the one-line notice; the classifier emits `verified_path: "unverified-nested"` and `action: "proceed in session model + notice"`.

**Post-reset live checks** (run after quota resets 2026-11-14 09:14 KST):

```bash
# 1. Terminal: Hydrogen high via agy CLI (~1 small call, ~0.001 weekly pts)
agy -p "what is 2+2" --model gemini-4-hydrogen-high --print-timeout 60s --output-format text
# Expected: responds without error; session header confirms Hydrogen model. Exit 0.

# 2. Terminal: Carbon high via agy CLI (~1 small call, ~0.001 weekly pts)
agy -p "what is 2+2" --model gemini-4-carbon-high --print-timeout 60s --output-format text
# Expected: responds without error; session header confirms Carbon model. Exit 0.

# 3. Nested (read-only): agy called from inside a /ulw session via run_command (~1 small call, ~0.001 weekly pts)
# From inside an active /ulw session, run:
#   run_command: agy -p "what is 2+2" --model gemini-4-hydrogen-high --print-timeout 60s --output-format text
# Expected: responds without error. If this succeeds, verified_path for long_execution can be upgraded to
#   "agy --model gemini-4-hydrogen-high --print-timeout 600s --output-format text" in model-routing.json
#   and action changed to "delegate via agy --model ...".

# 4. Nested (edits scratch file): agy with --mode accept-edits from inside a /ulw session (~1 small call, ~0.001 weekly pts)
# Create scratch file: echo "TODO: replace me" > /tmp/ulw_scratch_test.txt
# From inside an active /ulw session, run:
#   run_command: agy -p "In /tmp/ulw_scratch_test.txt replace TODO with DONE" \
#     --model gemini-4-hydrogen-high --mode accept-edits --print-timeout 60s --output-format text
# Then: cat /tmp/ulw_scratch_test.txt
# Expected: file content updated (DONE: replace me or similar). Exit 0.
# If both #3 and #4 pass, the nested path is verified and action/verified_path can be updated.

# 5. Classifier shape check (no model calls, no quota cost)
node scripts/classify-task.mjs "이 PR 리뷰해줘" | node -e \
  "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); \
   console.assert(j.kind==='judgment','kind'); \
   console.assert(j.verified_path==='invoke_subagent Model: \"pro\"','vpath'); \
   console.log('shape ok')"
# Expected: "shape ok". Exit 0.
```
