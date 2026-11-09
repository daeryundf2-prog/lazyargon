---
name: shower
description: "Cold-read an artifact from a fresh zero-context subagent to confirm it stands on its own. Use before a handoff, publish, or merge, or when a long session has worn away fresh eyes. Diagnoses only; the main session fixes. Triggers: shower, cold read, fresh eyes, 처음 보는 눈, 콜드 리드."
---

## Antigravity Tool Mapping (default)

This plugin runs on **Google Antigravity** (`Model: "inherit"`).

| Intent | Antigravity action |
| --- | --- |
| Fresh zero-context reader | `invoke_subagent` with `Model: "inherit"`; pass the artifact contents inline, no intent or history |
| Read the artifact | `view_file` |

> Adapted from [LilMGenius/paperthin](https://github.com/LilMGenius/paperthin) `skills/depth/shower` (MIT). See `NOTICE`.

# Shower

A long session hides what the artifact leaves unsaid. A subagent that never saw the conversation reads it and reports where a first-time reader stalls.

## Steps

1. Pin the artifact. If the scope is unclear, ask, or take the artifact just produced. Note its purpose and audience in one private line; the reader never sees it.
2. Launch one fresh `invoke_subagent`. Give it the artifact **contents** (inline or a copy), never a repo path, and tell it not to open README, docs, or neighbor files.
3. Ask it to report, from the artifact alone:
   - what it thinks the artifact is, does, and expects;
   - what is unclear, ambiguous, or assumed but unstated;
   - what it had to guess.
4. Compare its blind reading with your private intent. Every mismatch is an artifact defect, not a reader error.
5. Report defects with concrete fixes, worst blocker first, plus a verdict: stands on its own, minor gaps, or needs work.

## Rules

- The read must come from a separate subagent. Self-assessment in the author session does not count.
- Pass contents, never intent or reasoning.
- Read end to end. A pattern search misses stale references, dead links, and fact drift; never report "clean" from a pattern search alone, and say how much was actually read.
- One cold read can still be confidently wrong. Escalate to several independent reads only when the stakes justify it.
- Diagnose only. Do not edit the artifact.

## Related

- `gf-qa-behavioral-verification` checks that the artifact **runs**; `shower` checks that a newcomer can **understand** it. Use both before a handoff.
