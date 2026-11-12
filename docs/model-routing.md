# /ulw model routing by role

Source: orch-pilot lane (2026-11-12/13). Numbers are small-sample; treat them as a starting policy and re-measure.

| Role | Model | Why | Fallback |
|---|---|---|---|
| Plan, final review | Carbon medium | Best at catching errors (slip 4-9% on the dummy verdict benchmark); triage and logic checks | Argon high when the hard timeout (set ~300s, not the 10-min default) fires |
| Implementation, workers | Argon high | Most accurate and fastest on the same benchmark (exact 85% on 30 shared cases, median 32-39 s); only 13% timeouts | Argon medium |
| Long or flaky steps where finishing beats precision | Hydrogen high | 0% timeouts over 933 cases, median 78 s | none |
| pii, inject, docfmt checks | never Hydrogen | pii 61% slips, inject 19% exact, docfmt 31% exact, 34% false positives on clean files | Carbon or Argon |

Carbon high hit the 10-minute print timeout on 24-37% of cases (median 170-260 s), so Carbon is for short plan and review turns, not long execution.

Measured in the orch-pilot style comparison (8 cases, F06/F12/F13/F10): a split pipeline (Carbon plan, Argon medium implement, Carbon review) passed 6/8 against 4/8 for Flash worker plus Argon verifier. The gap was all F13 code fixes, where Flash made no edits (0/2). The split pipeline was about 2-3x slower. Neither style passed the long Korean report family (F12, 0/2).

Caveat: `invoke_subagent.Model` documents only `inherit`, `flash` and `flash_lite`. This table sets the session model. Whether explicit ids such as `gemini-4-argon-high` are accepted as the subagent `Model` is unverified.
