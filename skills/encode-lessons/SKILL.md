---
name: encode-lessons
description: "When the same correction or instruction comes up a second time, or a bug is being fixed, encode the lesson as a lint, test, type, hook or script instead of another rule-file line, and fix root causes, not symptoms. Use for 같은 실수 반복, 교훈 남기기, 근본 원인."
---

# Encode lessons in structure, fix root causes

Adapted from pstack's `principle-encode-lessons-in-structure` and `principle-fix-root-causes` (Lauren Tan, MIT), see the plugin NOTICE. The order of trust is: codebase shape, then static checks, then runtime verification, then prose (rules, skills, AGENTS.md), then human review. Prose is the last resort, not the first.

## When a correction repeats

1. Before adding a line to `AGENTS.md`, `GEMINI.md`, a skill or a memory file, ask whether a machine can catch it:
   - **Lint or static check** with an error message that tells the next agent the fix, not just the violation.
   - **Type or API shape** that makes the wrong call impossible (remove or wrap the hard-to-use API, separate modules that must not import each other by folder plus lint).
   - **Test** that fails on the wrong behavior.
   - **Hook, guard or script** that refuses the bad action at the moment it happens.
2. If one of these fits, write it and do not also write the prose. The prose is the symptom; the check is the fix.
3. Only if the lesson needs judgment and cannot be checked, write the instruction more prominently and add one concrete example of the failure.
4. Order: block new occurrences first (the check), then clean up existing ones in a separate change.

## When fixing a bug

- Reproduce first. Read the actual error and the actual state; instrument rather than guess.
- Ask "why" at each step until the answer is a wrong decision in code, not a consequence of an earlier one. The symptom is where the wrong state became visible; the root cause is the first place the system did something it should not do.
- Is the state that triggered the symptom legitimate? If yes, the code that broke on it is the root cause and handling it there is the fix. If no, a check at the crash site hides the bug: find what produced the state. Guards, retries, swallowed errors, clamped values and discarded state are the usual hiding places.
- If something fails only after a restart, suspect persisted state first: config files, caches, lock files, serialized state.
- Fix the pattern, not only the instance: find every place with the same fault.
- A workaround that needs a paragraph-long comment to justify it is wrong code. Fix the code, not the comment.
- If the deciding fact took a deep dig to find, propose the cheap, always-on signal (a log line, a doctor check, a metric) that would have shown it at first look.
