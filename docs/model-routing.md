# /ulw model routing by role

Numbers come from our own tests (small samples; re-measure before tightening). Vendor benchmark tables are not used: the Hydrogen column in the table the owner shared contains unofficial cells, so no Hydrogen number here comes from it.

| Role | Model | Evidence | Fallback |
|---|---|---|---|
| Default | Argon high | Common 78 verdict cases: 63% effective accuracy (first of the six models), median 44 s, 1 failure | Argon medium |
| Plan, design, long context (~250k+ tokens), security audit | Carbon, cap 10 min | Fewest misses when it answers (9%); but 14 of 78 failed or timed out, median 288 s | Argon high on timeout |
| Verdict, review, verification | Argon high | As above | Carbon only for a split verdict, once |
| Implementation, edits, test runs, long or flaky execution | Hydrogen high | 0 failures in 78 and 0 in 939 (xhigh), median 24 s; same accuracy as xhigh at about a third of the time | Argon high |
| PII, prompt-injection, docfmt checks | Argon high | Hydrogen weak: pii 61% missed, inject 19% exact, docfmt 31% exact, 34% false positives on clean files | Carbon for a suspect |
| Orchestrator | no role yet | Verdict tasks are answered by Carbon alone (250 s, 10 of 67 failed); implementation comparison pending | - |

Quota rule: Carbon only twice per task (plan and final review); execution runs on Hydrogen or Argon.

Pilot, orchestration style (8 cases F06/F12/F13/F10, n too small to conclude): a split pipeline (Carbon plan, Argon medium implement, Carbon review) passed 6/8 against 4/8 for Flash worker plus Argon verifier. The gap was all F13 code fixes (Flash made no edits, 0/2). The split pipeline took about 2-3x longer. Neither style passed the long Korean report family (F12, 0/2). Four-arm numbers (Swarm, Orchestrator, native, Lazy) follow in the PR discussion.

Caveats:
- `invoke_subagent.Model` documents only `inherit`, `flash` and `flash_lite`. This table sets the session model; explicit model ids as the subagent `Model` are unverified.
- PII/inject placement is provisional until the v2-prompt retest.
