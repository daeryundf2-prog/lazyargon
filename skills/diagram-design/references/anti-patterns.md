# Universal Anti-patterns

Routed from `SKILL.md` §4 (`## 4. Universal Anti-patterns`).

## 4. Universal Anti-patterns

These mark "AI slop" schematics of any type:

| Anti-pattern | Why it fails |
|---|---|
| Dark mode + cyan/purple glow | Looks "technical" without design decisions |
| JetBrains Mono as blanket "dev" font | Mono is for *technical* content — ports, commands, URLs. Names go in Geist sans. |
| Identical boxes for every node | Erases hierarchy |
| Legend floating inside the diagram area | Collides with nodes |
| Arrow labels with no masking rect | Bleeds through the line |
| Vertical `writing-mode` text on arrows | Unreadable |
| 3 equal-width summary cards as default | Generic grid — vary widths |
| Shadow on any element | Shadows are out. Borders are in. |
| `rounded-2xl` on boxes | Max radius 6–10px or none |
| Coral on every "important" node | Coral is 1–2 editorial accents, not a signaling system |
| Reproducing Mermaid's renderer layout | Imports automatic spacing and routing instead of making an editorial layout |
| Any breach of the six §6 connector rules | Automatic fail: diagonal slants, labels touching their stroke, masks clipped by a later node, overlapping paths, shared attach points, transit behind a non-endpoint box |
| Paragraphs inside nodes or callouts | A node label is ≤4 words (≤8 Korean characters); a callout is ≤2 lines. Argon's default is to explain inside the box — move the explanation to the summary card or cut it |
| Invented figures in summary cards or axes | Every number on the diagram traces to the brief or a data file; with no source, render the label with `—`, never a plausible value |
| One oversized `write_to_file` for the whole HTML | Files above ~100 lines are written in chunks and re-read; a single large write is dropped by the host mid-stream |

Type-specific anti-patterns live in each type reference linked in the guide.
