---
name: factchk
description: "Verify reality-grounded claims against external sources in both directions before they ship: could the absurd be real, could the obvious be false. Use when prose, a design rationale, or a plan calls something plausible, absurd, novel, or impossible from intuition. Triggers: factchk, fact check, 사실 확인, 진짜 맞아, 근거 확인."
---

## Antigravity Tool Mapping (default)

This plugin runs on **Google Antigravity** (`Model: "inherit"`).

| Intent | Antigravity action |
| --- | --- |
| Look up a source | `search_web`, `read_url_content` |
| Find the claim in local files | `grep_search`, `view_file` |
| Apply a clear correction | `replace_file_content` |

> Adapted from [LilMGenius/paperthin](https://github.com/LilMGenius/paperthin) `skills/depth/factchk` (MIT). See `NOTICE`.

# Factchk

The author's sense of what is plausible, absurd, or new is the least reliable line in an artifact. Priors fail both ways: they exclude the real and normalize the impossible.

## Steps

1. Scan for claims asserted as true about the world, including sentences you are about to write.
2. Check each against an external source, in both directions: could the "absurd" be real? Could the "obvious" or "novel" be false or long established?
3. If no source can be reached, flag the claim as 미확인. Never assert it from intuition.
4. Fix mechanically clear errors (wrong date, misattributed source, wrong number) with the cited source. Surface contested or interpretive claims as judgment calls; do not silently rewrite them.
5. Report per claim: verdict, source, and which direction the claim failed.

## Rules

- This extends the plugin rule against unsourced numbers (`rules/AGENTS.md`: no number stated without a source; a failed lookup is "확인하지 못함", never "없음"). A checked claim carries its source; an unchecked one is marked 미확인.
- Skip deliberate fiction and declared in-world choices. If it is unclear whether a claim is a real-world assertion, flag it; do not fix it.
- For a claim about a person (title, role, school, age), read the person's own profile or record. Where two values are possible, state the one that cannot overstate.
- Flagging only the unrealistic catches half the errors. Check the "obviously true" ones too.
- A pass that finds nothing changes nothing.

## Verify before finishing

Every verdict traces to a citable source. The report separates fixes from flags.
