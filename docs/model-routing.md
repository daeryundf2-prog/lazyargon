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
