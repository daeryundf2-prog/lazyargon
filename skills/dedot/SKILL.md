---
name: dedot
description: "Korean text only, suggestion-only. Reviews middle dots (U+00B7) in a named passage, file, or folder and proposes a comma or connective only where a dot strings together an open list; keeps closed sets, pairs, shared elements, and protected dots. Never edits the text unless asked. Triggers: dedot, 가운뎃점, middle dot, 점 정리."
---

## Antigravity Tool Mapping (default)

This plugin runs on **Google Antigravity** (`Model: "inherit"`).

| Intent | Antigravity action |
| --- | --- |
| Find every U+00B7 in scope | `run_command` with `rg -n -F '·' <path>` (one approval tool per turn) |
| Read the full sentence around a dot | host `Read` with a line range |
| Apply a fix (only if the user asked) | host `Edit` in ≤100-line / <20KB chunks, then host `Read` of the edited range |

> Adapted from [LilMGenius/paperthin](https://github.com/LilMGenius/paperthin) `skills/depth/dedot` (MIT). See `NOTICE`. Upstream's `find.mjs` is not ported; use the search above.

# Dedot

Review the middle dots in the Korean text the writer named. Give each dot one verdict. Propose a replacement only for dots that join an **open** list.

## When it applies

Only when the writer asks for a middle-dot review of a named passage, file, or folder. Any other request (copyedit, translation, rewrite) is done as asked, without this skill. If the named path does not exist, say which path you looked for and stop; create nothing.

## Keep (legitimate)

Per 국립국어원 온라인가나다 324634 and 327303:

1. A closed set under one criterion: 동·서·남·북, 세 과목인 국어·영어·수학.
2. A pair: 남·녀, 노·사, 수입·수출.
3. A shared element written once: 출·퇴근, 국·공립, 3·4분기.

Closure is judged by meaning, not by dot count.

## Change (open list)

Items are examples of a larger class (markers: 등, 같은, 처럼, 을 비롯한). Propose the comma: `A·B·C 등` becomes `A, B, C 등`. Offer 및 or 와/과 (items go together) or 이나/또는 (alternatives) only when it keeps the relation and reads naturally. If only the writer can say whether the items are the whole set, ask, and give no replacement.

## Protected (never proposed)

Quoted text, a proper name containing a dot, formulas, dotted dates and digit groups (6·25, 4·19), Catalan l·l, markup, code, and URLs. Look-alikes (ㆍ U+318D, ‧ U+2027, ・ U+30FB) are different characters: never counted or changed.

## Report

1. One opening line of counts that sum to the in-scope total: change, keep, protected, undecided.
2. Per proposal: file and line, the exact original span, the proposed span, and a short reason.
3. Questions (no replacement), kept dots with their role, protected dots with their category.
4. State that the file was not changed. Say nothing about other punctuation or wording.

## Rules

- Suggestion-only. Never rewrite silently. If the writer asks for a direct fix, change only the dots, leave each legitimate dot, write in ≤100-line / <20KB chunks, re-read each edited range (`rules/AGENTS.md`), and say which spans changed.
- Read files as UTF-8.
