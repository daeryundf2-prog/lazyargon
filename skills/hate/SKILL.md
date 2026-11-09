---
name: hate
description: "User-invoked hostile critic. Attacks a plan, design, or argument before effort is committed and returns the single load-bearing objection plus the cheapest experiment that would test it. Triggers: hate, hate this plan, 이 계획 공격, 반대 의견 하나."
---

## Antigravity Tool Mapping (default)

This plugin runs on **Google Antigravity** (`Model: "inherit"`).

| Intent | Antigravity action |
| --- | --- |
| Read the plan or design under attack | `view_file` |
| Run the cheapest test (the first nail) | `run_command` only after the user agrees to run it |

> Adapted from [LilMGenius/paperthin](https://github.com/LilMGenius/paperthin) `skills/depth/hate` (MIT). See `NOTICE`.

# Hate

Attack a plan as if you want it to fail, then return one objection and one cheap test. Never a checklist.

## When to run

Only when the user asks for it. Do not self-trigger: a standing attack reflex biases the agent toward demolition.

## Steps

1. List what must be true for the whole plan to stand (load-bearing assumptions).
2. Attack along every axis that applies:
   - a load-bearing fact that may be false;
   - an after-the-fact story treated as ground truth;
   - an analogy taken as identity across domains;
   - a result that does not exist yet, leaned on as if it did;
   - a principle cited while its opposite is implemented.
3. For an empirical or research plan, also check leakage (no independent ground truth, see `mandela`) and statistical power (uncorrected multiple tests, near-zero power).
4. Collapse to the **root**: the one objection whose failure makes the rest moot.
5. Find the **first nail**: the cheapest experiment (time, cost, sample size) that could falsify the assumption the root attacks and kill the plan before the expensive work starts.
6. Return exactly `{ root, first_nail }`: one sentence, and one experiment with its cost.

## Rules

- Attack only. Do not improve the plan; that is a different task.
- There is no "no objection" result. Always return one root and one first nail.
- Many axes may fire. Own the synthesis and output one root, not a list.
- Run no first-nail command without the user's go-ahead.

## Verify before finishing

1. Without the root the plan would fall.
2. The first nail costs less than the plan it pre-empts.
