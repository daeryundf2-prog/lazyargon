# /ulw model routing by role

Numbers come from our own tests (small samples; re-measure before tightening). Vendor benchmark tables are not used: the Hydrogen column in the table the owner shared contains unofficial cells, so no Hydrogen number here comes from it.

| Role | Model | Evidence | Fallback |
|---|---|---|---|
| Default | Argon medium | 41 hard round-3 cases (carbon-medium-1115): Argon medium 22/41 = Argon high 22/41, identical solved set, median 14 s vs 42 s, output tokens 52k vs 207k (see below) | Argon high |
| Plan, design, final review, security audit | Argon high (security audit also applies the v2 rule) | Accuracy is a tie: Carbon high 62/86 answered (72.1%) vs Argon high 72/99 (72.7%). Carbon is dropped for latency: p50 212 s, p95 526 s, and 14/100 hit the 10-minute cap. A 180 s cap with Argon fallback scores 71/100 against Argon alone 72/100 with twice the calls. Only Carbon high was measured; medium is unmeasured. | - |
| Long context (~250k+ tokens, unmeasured threshold) | Carbon high, cap 600 s | Cap covers Carbon p95 (526 s). The 250k threshold and Argon fallback at that size are assumptions: no case near that size was tested | Argon high on timeout (unverified at this size) |
| Verdict, review, verification | Argon medium | Same 41 cases as Default. Argon high: 72/100 exact on the common 100 cases (medium not run there); Hydrogen high 65/100 with the most clean false alarms (10/33) | Hydrogen xhigh with the v2 prompt |
| Implementation, edits, test runs | Argon high (default); Hydrogen high for long or flaky test-verified execution | All implementation arms passed 5/5 on F13; Argon high was cheapest (see below) | Argon high |
| PII, prompt-injection, docfmt and judgment checks | Argon high or Hydrogen xhigh, v2 prompt required | Two separate measurements: 100-case set with the original prompt (pii 7, inject 8 cases), PII weak for every model, best 3/6 caught; v2 retest (pii 38, inject 32 cases), 70/70 for Argon, Carbon and Hydrogen xhigh, clean false positives 0/24 for xhigh. Hydrogen high had 36% clean false alarms (8/22), so high is never a gate. docfmt scores are partly a bench artifact (binary documents shown as 256-byte hex) | Carbon for a suspect |
| Orchestrator | no role yet | Verdict tasks are answered by Carbon alone (250 s, 10 of 67 failed); implementation comparison pending | - |

Quota rule: Carbon only for long-context input; default and verdicts run on Argon medium, plan, final review, security audit, sensitive checks and implementation on Argon high (medium unmeasured for those), Hydrogen high for long test-verified execution.

Pilot, orchestration style (8 cases F06/F12/F13/F10, n too small to conclude): a split pipeline (Carbon plan, Argon medium implement, Carbon review) passed 6/8 against 4/8 for Flash worker plus Argon verifier. The gap was all F13 code fixes (Flash made no edits, 0/2). The split pipeline took about 2-3x longer. Neither style passed the long Korean report family (F12, 0/2). Four-arm numbers (Swarm, Orchestrator, native, Lazy) follow in the PR discussion.

Caveats:
- `invoke_subagent.Model` documents only `inherit`, `flash` and `flash_lite`. This table sets the session model; explicit model ids as the subagent `Model` are unverified.

## Argon medium vs high on hard verdicts (carbon-medium-1115, 2026-11-15)

The 41 round-3 cases (picked because other models got them wrong), same runner, prompts and grader as round 3; agy 1.5.9, isolated HOME, 15-minute cap per case. The Argon high arm reuses round 3; a 5-case drift check (seed 1115) reproduced it 5/5.

| Arm | Correct /41 | Confidently wrong | Timeouts | Median s | Total tokens | Output tokens |
|---|---|---|---|---|---|---|
| Argon medium | 22 | 19 | 0 | 14.3 | 572k | 52k |
| Argon high | 22 | 19 | 0 | 42.1 | 776k | 207k |
| Carbon medium | 20 | 21 | 0 | 118.1 | 1,514k | 610k |

Argon medium and high solved the identical set of cases. Sign test Carbon medium vs Argon high: 1 vs 3 cases, p = 0.625. The whole lane used about 1.6 weekly points. Limits: the case set is biased toward hard misses, and n = 41 cannot resolve a 2-case gap; medium is unmeasured on implementation, planning and the v2 sensitive checks.

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

The fill-in run used about 4 weekly points for 119 calls (about 0.034 per call). Carbon's errors were 10-minute print timeouts concentrated in image cases (7 of 14), so they measure latency, not accuracy; the 3 timeouts from the fill-in timed out again on a retry (2026-11-14). "Missed bad" excludes unanswered cases; counting them as misses, Carbon high missed 13/67 and Argon high 8/67. Bootstrap of the Argon minus Carbon exact gap (20,000 resamples): mean +10.0 points, 95% CI [+4, +17].

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

## Korean STT model (stt-models-1116, 2026-11-16)

Same 20 synthetic clips and grader as ocr-stt-1115 (14 natural voice, 6 robot TTS), isolated HOME, one agy call at a time. The cloud transcription model in the `tool_first` rule is `gemini-3.8-flash-high`; the local pass stays faster-whisper large-v3-turbo + VAD.

| Model | Natural CER | Natural numbers | All-clip CER | Hallucinated words | s per clip |
|---|---|---|---|---|---|
| gemini-3.8-flash-high | 0.0% | 100% | 2.2% | 0 | 108 |
| gemini-4-argon-high | 0.1% | 98.9% | 3.8% | 28 | 68 |
| gemini-4-argon-medium | 0.3% | 97.8% | 6.0% | 81 | 31 |
| gemini-4-hydrogen-high | 2.1% | 93.1% | 6.7% | 64 | 36 |
| gemini-4-hydrogen-xhigh | 0.4% | 96.8% | 25.4% | 333 | 232 |

The owner's note that Hydrogen transcribes Korean better was not confirmed here. Natural voice is nearly a tie between Flash High and Argon High; robot TTS and silence gaps separate them. Small synthetic set: re-measure on real recordings before tightening.

**Real speech (stt-real-1116, 2026-11-16).** OpenSLR SLR40 Zeroth-Korean (CC BY 4.0), 8 utterances from 5 speakers, each with numbers, dates or amounts; plus phone (8 kHz mu-law), pink noise at 10 dB and a two-speaker join: 13 clips, 26 serialized agy calls.

| Model | Raw CER | Digit-normalized CER | Numbers | Invented sentences | s per clip |
|---|---|---|---|---|---|
| gemini-3.8-flash-high | 0.3% | 0.0% | 28/28 | 0 | 95 |
| gemini-4-argon-high | 13.0% | 0.0% | 28/28 | 0 | 93 |
| faster-whisper large-v3-turbo + VAD (local) | 16.8% | 1.2% | 27/28 | 0 | 6.4 |

A tie at the ceiling: the raw gap is notation (the reference and Flash spell numbers in Hangul, Argon writes Arabic numerals), and the earlier 1.6x time gap did not show on real speech. `gemini-3.8-flash-high` stays; its edge rests on the synthetic robot-TTS and silence conditions. Still unmeasured: natural conversation, overlapping speech, dialects and long recordings, so the `tool_first` rule keeps faster-whisper next to any Gemini transcription and a person checks numbers and names in evidence transcripts against the audio. `classify-task.mjs` emits `stt_model` for transcription tasks, and a test keeps the rule text and `stt_model` naming the same model.
