# /ulw model routing by role

Numbers come from our own tests (small samples; re-measure before tightening). Vendor benchmark tables are not used: the Hydrogen column in the table the owner shared contains unofficial cells, so no Hydrogen number here comes from it.

| Role | Model | Evidence | Fallback |
|---|---|---|---|
| Default | Argon high | Common 78 verdict cases: 63% effective accuracy (first of the six models), median 44 s, 1 failure | Argon medium |
| Plan, design, long context (~250k+ tokens), security audit | Carbon, cap 180 s | Fewest misses when it answers (9%); but 14 of 78 failed or timed out, median 288 s | Argon high on timeout |
| Verdict, review, verification | Argon high | As above | Carbon only for a split verdict, once |
| Implementation, edits, test runs | Argon high (default); Hydrogen high for long or flaky test-verified execution | All implementation arms passed 5/5 on F13; Argon high was cheapest (see below) | Argon high |
| PII, prompt-injection, docfmt and judgment checks | Argon high or Hydrogen xhigh | omp-dori v2 retest: xhigh inject 32/32, pii 38/38, clean false positives 0/24; Hydrogen high had 36% (8/22), so high is never a gate | Carbon for a suspect |
| Orchestrator | no role yet | Verdict tasks are answered by Carbon alone (250 s, 10 of 67 failed); implementation comparison pending | - |

Quota rule: Carbon only twice per task (plan and final review); execution runs on Hydrogen or Argon.

Pilot, orchestration style (8 cases F06/F12/F13/F10, n too small to conclude): a split pipeline (Carbon plan, Argon medium implement, Carbon review) passed 6/8 against 4/8 for Flash worker plus Argon verifier. The gap was all F13 code fixes (Flash made no edits, 0/2). The split pipeline took about 2-3x longer. Neither style passed the long Korean report family (F12, 0/2). Four-arm numbers (Swarm, Orchestrator, native, Lazy) follow in the PR discussion.

Caveats:
- `invoke_subagent.Model` documents only `inherit`, `flash` and `flash_lite`. This table sets the session model; explicit model ids as the subagent `Model` are unverified.
- PII/inject placement is provisional until the v2-prompt retest.

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
