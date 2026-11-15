## Step 4 - Synthesize one verdict

When both passes return, merge them into a single report: one row per checklist item with its verdict and proving capture, then the non-checklist dimensions. For each FAIL or bad item, state what is wrong, where (file/line, hotspot grid, or capture line), and the concrete fix. Call out what is genuinely good so it is not regressed later. Any `[defect]` FAIL makes the verdict NEEDS WORK.

### Completion gate - bounded independent review on fresh evidence

This is a hard stop rule, not a guideline. Do not declare the UI done until both passes are satisfied, OR the remaining gaps are explicitly listed and accepted by the user. A high `similarityScore` with an open Pass A finding, for example a faked-image layout or a broken feature, is still a FAIL. The UI is done when ALL of these hold at once on the SAME current build:

- An independent read-only reviewer returned PASS, or only `[taste]` findings, on the current build.
- That reviewer judged a FRESH capture of every enumerated page from Step 2 - no stale artifacts, no skipped pages.
- Every `[defect]` finding is resolved in the rendered output, not merely noted.

The loop is bounded. The initial dual-oracle pass is round 1; each fresh re-review increments it. A low-risk surface (one component, a figure, a report page, a copy change) gets 2 rounds; a product surface gets 3. Record the round count and the wall-clock time per round in the report.

- `[product] [defect]`: fix the source, re-capture the pages the fix touched, and dispatch a FRESH reviewer (never a followup to the previous one - stale reviewer context re-litigates settled findings). This consumes a round.
- `[product] [taste]`: record it under "Recorded taste findings" and stop; a reviewer that reports only taste has passed the surface. Fix taste only when it rides along with a defect fix that is re-reviewed anyway. A reviewer that reclassifies a recorded taste finding as a defect must say what changed; otherwise it stays taste.
- `[evidence]`: the product is not implicated and no round is consumed; repair the capture pipeline, re-shoot only the defective artifacts, verify them against the live build, and re-dispatch without touching product code.

The final approving round judges a complete fresh capture set. Do not stop because the automated script reports zero issues - the script aims the reviewer, it does not replace it - or because an earlier pass approved an older build. When the budget is exhausted with a `[defect]` open: STOP, dispatch no further reviewer, report NEEDS HUMAN REVIEW with every open defect in Must fix, and continue only on explicit user acceptance or a new request; the budget grows only when the user asks. Never self-certify a silent PASS.

```markdown
# Visual QA - Verdict: GOOD | NEEDS WORK | NEEDS HUMAN REVIEW

Captured: {N pages} x {390, 1440[, 1920]} x {light, dark} + scrolled-end + motion frames, fresh as of {build}. Pages: {ids}.
Rounds: {k} of {budget} ({time per round}). Brief: {primary action; priorities 1-3} or NONE.

| Item | Verdict | Capture | Finding |
|---|---|---|---|
| A1 ... J2 | PASS / FAIL / N/A | path#region | [product|evidence] [defect|taste] what, where, fix - empty on PASS |

| Dimension | Pass | Verdict | Evidence |
|---|---|---|---|
| Design system real vs faked | A | good/bad | ... |
| Features work | A | good/bad | ... |
| Required content intact | A | good/bad | ... |
| Alpha / transparency | A+B | good/bad | ... |
| Visual fidelity to reference | B | good/bad | ... |
| Before/after: improvement visible, nothing required lost | B | good/bad | pair paths |
| CJK precision | B | good/bad | ... |

## Must fix
[Blocking defects, each with location and fix, in priority order]

## Recorded taste findings
[Noted, not re-reviewed; the user decides]

## Good, keep it
[Correct aspects that must not regress]

## Completion gate
[Satisfied within the budget, or the exact remaining gaps and who accepted them]
```

## Step 5 - Reference-fidelity mode (when the task has a concrete visual target)

Run this step IN ADDITION to Steps 1-4 when the original user task has a concrete visual target: "clone this site", "move this Figma design to code", "rebuild this screen", "make it look exactly like X", or "build this Imagen/Stitch/generated mockup and overview". For these tasks the normal dual-oracle is necessary but NOT sufficient. After it returns, run the following TWO additional MANDATORY verifications; their retries count against the same round budget as Step 4.

1. Pixel-perfect design-compare subagent (visual oracle). Dispatch a focused, read-only design-compare reviewer via `invoke_subagent` (`TypeName: "self"`, `Model: "inherit"`). It must crop/zoom BOTH the reference (target / Figma export / source-site screenshot / generated page snapshot) and the ACTUAL screenshot into matching regions and read them **pixel-by-pixel** - header, nav, each card, spacing, type ramp, color tokens - not at a glance. It must also compare the overview text or annotations against the rendered content and DOM text. Anchor every claim with the bundled tool:

```bash
node "$SKILL_DIR/scripts/visual-qa.mjs" image-diff <reference.png> <actual.png>
```

   It judges whether layout geometry, spacing, design tokens (color, type, radius, shadow), and the design itself are identical to the target, region by region. Anything off by more than rounding is a finding.

2. Code-level design-system fidelity (code oracle). Dispatch through Antigravity's `invoke_subagent` tool:

```
invoke_subagent({
  TypeName: "self",
  Role: "Clone & Design-System Fidelity Reviewer",
  Model: "inherit",
  Prompt: """
TASK: Act as a clone / design-system fidelity reviewer. Read-only.

Be skeptical but fair. The executor may have overstated success and may have faked the design — inspect the diff, source code, and reference artifacts before approving.

Input: goal, success criteria, changed files, full diff, reference/target design (screenshots, Figma exports, source-site captures), evidence paths.

Review for:
1. Real component tree: live, reused primitives and extensible state variants render the UI, NOT a pasted screenshot, raster image, or `background-image` standing in for live DOM elements.
2. Token-driven styling: design tokens drive colors, spacing, and typography, NOT hardcoded one-off pixel or hex values.
3. Layer and layout structure: the DOM hierarchy and layout match the target structure.
4. Visual fidelity: the rendered design itself matches the reference.

Return:
- recommendation: APPROVE or REQUEST_CHANGES.
- blockers: concrete issues with file/line references; empty if APPROVE.
- reportPath: evidence artifacts you inspected.

Do NOT suggest or implement fixes.
"""
})
```

RULE (mandatory, non-negotiable): the reference-fidelity task is NOT done until BOTH the pixel-compare AND the code-level design-system fidelity reviewer confirm that the **layer structure, the design system, and the design itself** match the target. If EITHER fails, re-implement the gaps and re-run BOTH verifications from the top on the same revision, within the budget; on exhaustion, NEEDS HUMAN REVIEW with the gaps listed. Never declare reference-fidelity complete on a single pass, on visual-only evidence, or on code-only evidence.

## Step 6 - Before/after mode (when changing an existing UI)

A redesign nobody can see beside its baseline cannot be judged, and a regression hidden in it ships. This mode starts BEFORE the first edit and feeds Pass B.

1. **Fix the cases before editing** and do not change them afterwards: the states that matter (typically empty, loading, populated, error, plus any state the change targets) x the widths (web: 390 and 1440, plus 1920 for page layouts; a TUI: the column counts it supports, such as 80 and 120; paged output: each page size it prints to) x the theme(s) the surface ships. A case discovered mid-work is added to both sides, never to `after` alone.
2. **Capture `before` on the pre-edit build**, one PNG per case with the Step 2 tooling, as `<case>-<state>-<width>-<theme>-before.png`. Seed or mock the data so every state is reachable on demand; the same seed produces `after`.
3. **Capture `after` under identical conditions** on the current build (tooling, viewport, scroll position, theme, data, state) as `<case>-<state>-<width>-<theme>-after.png`.
4. **Compose each pair** side by side into `<case>-<state>-<width>-<theme>-pair.png` (before left, after right, same scale, a one-line caption naming the case), and run `image-diff <before.png> <after.png>` to aim the reviewer at what moved.
5. **Hand the pairs to Pass B** (its BEFORE/AFTER PAIRS field) with the brief and the required-content list; its check 3 judges improvement and regression. The pairs go into the report and the PR body. `before` is never reconstructed after the fact.

## Korean A4 Print / PDF & Screenshot Annotation QA

When the deliverable is a printable HTML/PDF report, manual, or brochure (or contains annotated screenshots):

1. **Per-page rendered PNG inspection**: Convert the generated PDF to per-page PNGs (`pdftoppm -png -r 150` or `pypdf`/`pymupdf`) in `os.tmpdir()` and inspect every page with `read_file` before declaring completion.
2. **Annotation & bounding-box precision**: Verify that red highlight boxes, numbered callouts, and cropped regions accurately frame the target text/UI element without clipping characters or spilling outside the target row. Ensure cropped screenshots (`MD-RED`, mobile captures, logs) are magnified enough that detail text is legible when printed on A4.
3. **Typography & table cell flow**: Enforce body text `>= 10pt`, table cells `>= 9pt`, `word-break: keep-all` on Korean prose, and `white-space: nowrap` on speaker/name/badge columns so 3-syllable Korean names never wrap mid-name. Keep a unified single-hue palette (e.g., navy/slate) unless semantic status requires color.
4. **Page-break & whitespace hygiene (`print-paged-media.md` §8)**: Reject orphan headings, split callout cards, floating bottom voids (`> 30%` of page height; enforce `.a4-sheet` `min-height: 267mm` + `.sheet-footer { margin-top: auto }` or `@page` margin boxes, `layout_page_underfill`), intra-row cell vertical voids (`> 70%` empty height in sibling cells when 64-char hashes wrap in a narrow column; enforce 2-tier sub-rows `tbody.row-group > tr.row-main + tr.row-sub`, `layout_cell_void_imbalance`), and Chromium Print Shrink-to-Fit downscaling caused by `white-space: nowrap` lines exceeding `178mm` (`672px`, `>95ch` at `8.5pt` mono). Isolate headless browser `--user-data-dir` inside `os.tmpdir()` and delete temporary profiles and `verify_*.png` captures after verification.
