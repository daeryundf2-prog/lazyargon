---
name: factchk
description: "Verify reality-grounded claims against external sources in both directions before they ship: could the absurd be real, could the obvious be false. Use when prose, a design rationale, or a plan calls something plausible, absurd, novel, or impossible from intuition. Not for forensic or legal report verification against local evidence (use the workspace report-guard for that). Triggers: factchk, 통념 반증, 양방향 근거, 진짜 맞아."
---

## Antigravity Tool Mapping (default)

This plugin runs on **Google Antigravity** (`Model: "inherit"`).

| Intent | Antigravity action |
| --- | --- |
| Look up a source | `search_web` (≤8 per task) |
| Find the claim in local files | `run_command` with `rg -n '<claim text>' <path>` (one approval tool per turn), then host `Read` |
| Apply a clear correction (only when the user asked for fixes) | host `Edit` in ≤100-line / <20KB chunks, then host `Read` of the edited range |

> Adapted from [LilMGenius/paperthin](https://github.com/LilMGenius/paperthin) `skills/depth/factchk` (MIT). See `NOTICE`.

# Factchk

The author's sense of what is plausible, absurd, or new is the least reliable line in an artifact. Priors fail both ways: they exclude the real and normalize the impossible.

## Steps

1. Scan for claims asserted as true about the world, including sentences you are about to write.
2. Check each in both directions: could the "absurd" be real? Could the "obvious" or "novel" be false or long established? Look at local evidence first (repo files, logs, test output), then the web; at most 8 web searches per task (`rules/AGENTS.md`). Claims not checked because of the cap are 미확인.
3. If a lookup fails or no source can be reached, mark the claim 확인하지 못함 (never "없음"). Never assert it from intuition.
4. Default is report-only. Edit a file only when the user asked for fixes: then correct mechanically clear errors (wrong date, misattributed source, wrong number) with the cited source, in chunked writes per `rules/AGENTS.md`, and re-read the edited range. Contested or interpretive claims stay judgment calls; never rewrite them silently.
5. Report per claim: verdict, source, and which direction the claim failed.

## Rules

- This extends the plugin rule against unsourced numbers (`rules/AGENTS.md`: no number stated without a source; a failed lookup is "확인하지 못함", never "없음"). A checked claim carries its source; an unchecked one is marked 미확인.
- Skip deliberate fiction and declared in-world choices. If it is unclear whether a claim is a real-world assertion, flag it; do not fix it.
- For a claim about a person (title, role, school, age), read the person's own profile or record. Where two values are possible, state the one that cannot overstate.
- Flagging only the unrealistic catches half the errors. Check the "obviously true" ones too.
- A pass that finds nothing changes nothing.

## Verify before finishing

Every verdict traces to a citable source. The report separates fixes from flags.
