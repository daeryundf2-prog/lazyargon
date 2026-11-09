---
name: mandela
description: "Audit an eval, metric, experiment, or benchmark for leakage: does independent external ground truth enter, or do model, scorer, and designer just confirm each other. Read-only. Use before trusting any how-we-will-know-it-worked, or when a result feels too clean. Triggers: mandela, leakage audit, self-grading test, 검증 누수, 자기 채점."
---

## Antigravity Tool Mapping (default)

This plugin runs on **Google Antigravity** (`Model: "inherit"`).

| Intent | Antigravity action |
| --- | --- |
| Read the eval, test, or metric definition | host `Read`; `run_command` with `rg -n` to locate it (one approval tool per turn) |
| Optional blind auditor for high-stakes designs | `invoke_subagent` as one flat call `{ TypeName: "self", Role, Model: "inherit", Prompt }` (no `Subagents` array); the `Prompt` follows the worker prompt contract in `rules/AGENTS.md` (목표 / 완료 조건 / 범위 / 종료 조건 / 반환 형식 ≤40줄); state `예산: 1 레인 / 1 웨이브` first; pass only the validation design |

> Adapted from [LilMGenius/paperthin](https://github.com/LilMGenius/paperthin) `skills/depth/mandela` (MIT). See `NOTICE`.

# Mandela

A leaky validation has the shape of the Mandela effect: designer, model, and scorer confirm a result no outside truth ever produced.

## Steps

1. Identify the validation (eval, metric, A/B, holdout, "how we will know") and name its components: model, scorer, designer, dataset.
2. Ask the core question: does external ground truth enter **independently**?
3. Test all eight patterns. Report only the ones that fire, each by name:
   1. **Recall, not reason**: a memorized answer recited, not derived.
   2. **Wrong null**: an ablation removes a label but not the signal actually exploited.
   3. **Shared hallucination**: two components verify each other; circularity reported as a number.
   4. **Tautology**: a scorer grading buckets it drew itself.
   5. **Verifier = designer**: a private, unreproducible recipe dressed as a holdout.
   6. **Shared-pool bias**: train and holdout from one labeler pool.
   7. **Frame injection**: a question that hands the subject the hypothesis.
   8. **Demand characteristics**: subjects who know they are measured.
4. For each hit, give the independent-ground-truth fix.

## Rules

- Blinding the output value can still leak the collection recipe.
- Read-only. Name the leak and the fix; do not rewrite the experiment.
- For a high-stakes validation you may add one auditor with fresh context. Give it only the design, never this session's reasoning.

## Verify before finishing

1. Run patterns 3 to 5 on your own audit: are you grading buckets you drew, or the verifier of your own design?
2. A reader who did not run the audit could reach your verdict from the cited evidence alone.
3. The report names the root leak, not a laundry list.

## Related

- `gf-qa-computed-outputs` checks that numbers and references are internally consistent; `mandela` checks that the **grader itself** is independent. Passing the first says nothing about the second.
