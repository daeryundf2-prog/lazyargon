---
name: print-paged-media
description: "Layer A paged-media reference. Load it when output is a document that breaks into pages - a PDF report, a print stylesheet, a headless-Chrome print pipeline, or an HTML deck printed to paper - instead of a continuously scrolling screen. Owns the page box, fragmentation properties, the atomic-block set, and the keep-together side effect that strands a block on a near-empty page. Adds zero visual taste; the style skill and DESIGN.md still own color, type, and spacing."
---

# Paged Media

Screen layout has one viewport and infinite scroll. Paged media has a fixed page box and a fragmentation engine that cuts your content into pages whether or not you told it where. This file owns that cut. It stacks on top of a Layer A style skill and adds ZERO visual direction - color, type, radius, and spacing still come from the style skill and `DESIGN.md`.

Load this when the deliverable is a PDF report, a print stylesheet, a `chrome --headless --print-to-pdf` pipeline, a WeasyPrint render, or any HTML meant to land on paper.

## 1. The page box comes first

Declare the page before styling anything inside it. `@page { size: A4; margin: 2cm; }` sets the sheet and the content area; every measurement downstream is relative to what survives those margins.

- `@page:first` targets the cover alone. A full-bleed cover is `@page:first { margin: 0 }`, which also suppresses the running header and footer on page one.
- Running headers and footers live in the page margin boxes. In headless Chrome they come from `headerTemplate` / `footerTemplate` on `Page.printToPDF`, rendered into the margins that `@page` declared - not from a fixed-position element in the body.
- Pass `preferCSSPageSize: true` when printing through CDP so your `@page` rule wins over the caller's paper defaults. Without it, the size you declared and the size you get can differ.
- Body content flows through the page area. An element with a viewport unit (`100vh`) or a fixed position does not mean on paper what it means on screen; size page furniture in `mm` or `pt`.

## 2. Fragmentation vocabulary

Three properties decide every cut. Modern names first; the `page-break-*` aliases still work and appear in older pipelines.

| Property | Use it for |
|---|---|
| `break-before: page` | Start a section on a fresh page. |
| `break-after: avoid` | Keep a heading with the block that follows it (keep-with-next). |
| `break-inside: avoid` | Forbid a cut *through* one block: a table, a figure, a callout, a code listing. |
| `orphans` / `widows` | Minimum lines of a paragraph left at a page foot / carried to the next page. Set both to at least 2; 3 reads better in dense body copy. |

`break-inside: avoid` on a wrapper is what actually protects a table - apply it to the element that owns the whole exhibit, not to the `<table>` alone, or the caption and the rules can still separate from the rows.

## 3. The atomic set - keep it small on purpose

Mark as atomic only what is unreadable when split: a data table with its caption, a figure with its `figcaption`, a callout, a short code listing. Everything else - ordinary paragraphs, long prose lists, multi-page tables - should be allowed to break, because a block that cannot break and cannot fit is a defect generator, not a protected exhibit.

A block taller than the page area gets split regardless of what you declared. `avoid` is a request the engine honors only when honoring it is possible.

## 4. The keep-together side effect - the defect this file exists to prevent

This is the failure that looks like a bug in your CSS but is your CSS working exactly as written.

A block carrying `break-inside: avoid` reaches the bottom of a page with too little room left. The engine cannot split it, so it moves the WHOLE block to the next page. That is correct. The damage appears when the block is the LAST content of its section and the next section carries `break-before: page`: nothing can flow up to backfill the gap it left, and nothing can flow down beside it. You ship one page with a short box at the top and a column of whitespace under it, and one page before it with an unexplained gap at the foot.

Nothing in the cascade detects this. Both rules are locally correct; the artifact is their interaction with where the text happened to land.

How to prevent and repair it:

- **Shrink the atomic set.** Every unnecessary `break-inside: avoid` is one more block that can be stranded. Protect exhibits, not paragraphs.
- **Do not wrap a lead-in with its block** unless the pair reliably fits together. Binding more content into one unbreakable unit makes stranding more likely, not less.
- **Reconsider the forced section break.** `break-before: page` on every section is a strong default for a report and a poor one for short trailing sections; allowing a brief section to continue on the current page removes the trap entirely.
- **Editorial repair is legitimate.** Shortening the block by a line, or moving it a paragraph earlier, is a real fix - and often the correct one for a hand-tuned deliverable.
- **Detect it by ink, not by intent.** A page whose content coverage falls far below its neighbors is the signal. Ranking pages by rendered coverage finds stranded blocks faster than reading CSS does.

## 5. What the engine actually honors

Fragmentation support is uneven, and reading the stylesheet will not tell you what happened.

- `break-inside: avoid` inside flex, grid, and multi-column containers is partially implemented across engines; a constraint that holds in normal flow can be dropped inside a nested fragmentation context.
- Transformed, absolutely positioned, and `overflow`-clipped subtrees fragment differently from ordinary blocks, and sometimes not at all.
- Background colors and images on split blocks may or may not repaint on the continuation page. Chrome needs `printBackground: true` before any of it renders.

Treat every fragmentation rule as a hypothesis until you have seen the rendered page.

## 6. Verify by rendering every page & cleaning up temporary profiles

A paged deliverable is verified by looking at its pages. Render them to PNG (via `pdftoppm` or `PyMuPDF`/`fitz`) and inspect each page via `view_file`:

```bash
pdftoppm -png -r 150 report.pdf out/page   # or python -m fitz render
```

Read every page image with `view_file` (using absolute paths) for: blank or near-empty pages, a block stranded alone after a keep-together push, a table or figure split mid-exhibit, a heading orphaned at a page foot, clipped or overflowing text, bounding-box/highlight coordinate drift on annotated evidence images, and a running header or footer that drifted or vanished.

- **Headless Browser Profile Isolation & Cleanup**: When converting HTML to PDF via Headless Chrome/Edge (`--headless --print-to-pdf`), always pass `--user-data-dir` pointing to an isolated directory under `os.tmpdir()` (or `$env:TEMP`) and delete both the temporary profile directory and intermediate page PNGs (`verify_*.png`, `out/page*.png`) immediately after verification completes.

## 7. Korean A4 Print / Legal & Forensic Document Standards

When generating Korean A4 print deliverables (forensic reports, fact-finding briefs, transcript tables, estimates, and court exhibits):

- **Minimum Print Typography Floor**: Body copy must be at least **`10pt`** (`13.3px+`, line-height `1.55–1.65`) and data/evidence tables at least **`9pt`** (`12px+`). Never shrink Korean body or table text below `9pt` to force a single-page fit; readable multi-page flow always beats illegible micro-type.
- **Transcript & Speaker Column Wrapping (`white-space: nowrap`)**: In dialogue transcripts, call logs, and metadata tables, apply `white-space: nowrap` (and a fixed minimum width such as `min-width: 4.5em`) to speaker/name/timestamp/badge columns so 3–4 syllable Korean names (`홍길동`, `김분석관`, `박대리`) never wrap mid-name onto two lines. Apply `word-break: keep-all` on prose cells.
- **Restrained Single-Tone Palette (Navy / Slate)**: Use a unified deep navy (`#1B365D` / `#0F172A`) and neutral slate (`#334155` / `#64748B` / `#F8FAFC`) palette across headers, table rules, and badges. Avoid multi-colored rainbow badges, decorative gradients, or unrequested summary callout boxes.
- **Screenshot & Evidence Annotation Alignment**: When overlaying bounding boxes, redaction masks, or highlight callouts onto captured screenshots inside a paged report, render the final PDF to page-by-page PNGs and inspect via `view_file` to confirm that CSS/SVG/Canvas coordinates have not shifted relative to the underlying image during A4 scaling.
- **Material-First Report Assembly (Anti-Slop Paged Workflow)**: Follow [`docs/material-first-design.md`](../../../../docs/material-first-design.md). Never write a 1,000-line HTML report in a single leap:
  1. **Separate Purpose, Structure & Style**: Lock report exclusions (no rainbow badges, no legal speculation, no unrequested summary callouts), pre-build verified data files (`audit.json`, `events.json`, transcript tables), and lock `@page` + single-tone Navy/Slate tokens first.
  2. **Assemble Bottom-Up from Atomic Exhibits**: Build each data table (caption + `<table>` + footnote) and figure as an isolated `.exhibit-atomic` unit (`break-inside: avoid` on the wrapper), then weave short prose paragraphs (`≤4` sentences, `orphans: 3; widows: 3`) in `≤100`-line chunks.
  3. **Reverse-Order Pagination Repair**: When page-by-page PNG inspection reveals a stranded block (>40% empty page foot), never shrink font sizes below the `9pt` floor—go back to the data/structure layer and split oversized tables into logical sub-tables or relax forced `break-before: page` on short trailing sections.

## 8. The 9 Whitespace, Density & Print-Engine Invariants (Eliminating Uncomfortable Whitespace & Adversarial Defects)

"Uncomfortable whitespace" and broken print geometry in HTML/PDF reports come from nine concrete geometric and engine-level defects. Apply these nine rules unconditionally:

1. **Dual-Mode Bottom Anchoring & Flex Fragmentation Cap (Zero Floating Bottom Voids)**:
   - **Mode A — Curated Fixed-Sheet Mode (`.a4-sheet` + `margin-top: auto`)**: When authoring structured 1-page-per-section sheets under `@page { size: A4; margin: 14mm 16mm; }`, set each `<section class="a4-sheet">` to `min-height: 267mm; display: flex; flex-direction: column; justify-content: space-between; break-after: page;` (`297mm - 28mm = 269mm` minus a `2mm` Blink subpixel safety buffer so a trailing blank page is never emitted; set `break-after: auto` on `:last-of-type`). Place a `.sheet-footer` as the last child with `margin-top: auto`.
   - **Never Overflow a Flex `.a4-sheet` Across 2 Pages**: If a `.a4-sheet` flex column overflows onto a 2nd page, Blink's LayoutNG Flex fragmentation drops the footer from Page 1, exhausts `min-height: 267mm` on Page 1 so Page 2's footer floats in mid-air, and ignores `break-inside: avoid` on child tables. Cap each curated `.a4-sheet` to **at most 4–5 2-tier records (or split into `<section class="a4-sheet">` per page at build time)**.
   - **Mode B — Flowing Multi-Page Mode (Chrome 131+ `@page` Margin Boxes)**: When a section flows across an unknown number of pages, keep `display: block; height: auto` on the section (never put multi-page flow inside a flex column) and use `@page` margin boxes (`@bottom-left`, `@bottom-right { content: counter(page) " / " counter(pages); }`) to anchor the bottom edge of every page.
2. **2-Tier Sub-Row Table Pattern (`tbody.row-group > tr.row-main + tr.row-sub`)**:
   - Never put 64-character `SHA-256` + `MD5` hashes, long file paths, or multi-sentence quotes into a narrow right-hand column next to 1-line metadata (`호증`, `파일명`, `크기`, `시각`). Doing so wraps the narrow column to 4 lines and leaves >70% vertical empty void inside every sibling cell (`layout_cell_void_imbalance`).
   - Instead, keep `tr.row-main` strictly to 1-line scannable attributes (`vertical-align: middle`), and place the full-width hash/detail bar inside `<tr class="row-sub"><td colspan="N">` (`background: #F8FAFC; font-size: 8.5pt; word-break: break-all;`). At `178mm` A4 printable width (`672px`), `8.5pt` monospace fits up to `95` characters on **one single line**, reducing cell vertical void to 0% and compacting table height by 35–45%.
   - **Never Exceed `178mm` (`672px`) with `white-space: nowrap` in Print Tables (Chromium Print Shrink-to-Fit Trap, `layout_print_shrink_risk`)**: If a `nowrap` cell or sub-row exceeds `95ch` (`>672px`), Chromium's print engine silently triggers **Print Shrink-to-Fit (`scale < 1.0`)**, scaling the entire page down (e.g., `0.689x`) and creating a `90mm+` blank void at the bottom of every page even when `min-height: 267mm` is set. Keep `tr.row-sub` under `95ch` (e.g., `[filename] SHA-256: <64-hex>` while keeping `MD5` in `tr.row-main`), restrict `.nowrap` strictly to short badges/timestamps/speaker names, and apply `.file-cell { overflow-wrap: anywhere; word-break: break-all; }` on filename/path/URL columns.
   - Wrap each record's `tr.row-main + tr.row-sub` pair inside `<tbody class="row-group" style="break-inside: avoid;">` so page breaks never sever a record from its hash bar.
3. **Print Background Fidelity & Multi-Page Box Clone (`print-color-adjust: exact` + `box-decoration-break: clone`)**:
   - Always declare `-webkit-print-color-adjust: exact; print-color-adjust: exact;` on `body, th, tr.row-sub td, .exhibit-caption, .exhibit-foot, .badge-ok, .ministry-box` so Chromium does not strip subtle `#F8FAFC`/`#F1F5F9` fills that visually separate `tr.row-main` from `tr.row-sub`.
   - Always declare `thead { display: table-header-group; break-inside: avoid; } tfoot { display: table-footer-group; break-inside: avoid; }` and `-webkit-box-decoration-break: clone; box-decoration-break: clone;` on bordered wrappers (`.exhibit-atomic`) so multi-page tables repeat their header and close top/bottom borders across page breaks.
4. **Vertical Column Alignment Across Stacked Tables (`table-layout: fixed` + `<colgroup>`)**:
   - When two or more tables appear on the same page, default `table-layout: auto` shifts vertical column borders by `15–40px` between upper and lower tables depending on cell text length.
   - Enforce `table { table-layout: fixed; width: 100%; }` and explicit `<colgroup><col style="width: ..."></colgroup>` presets (e.g., 5-column forensic exhibit table: `11% / 22% / 11% / 24% / 32%`) so vertical column dividers align across stacked tables on the same page.
5. **Right-Aligned Tabular Numerals for Byte/Currency/Count Columns (`.num`)**:
   - Never left-align byte sizes (`33,442 B`, `6,221 B`, `211,252 B`), currency amounts, or counts. Apply `.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }` on both `th.num` and `td.num`, and standardize unit spacing (`33,442 B` with a space and comma separator) across all tables and prose.
6. **Orphan Heading Lock (`.section-lead`)**:
   - Blink ignores `h2 { break-after: avoid }` inside flex containers or when the immediately following `.exhibit-atomic` is pushed to the next page by `break-inside: avoid`. Wrap `h2` + introductory paragraph + the first `.exhibit-atomic` (or table header + first `tbody.row-group`) in `<div class="section-lead" style="break-inside: avoid;">` so a heading is never stranded alone at the bottom of a page.
7. **Gestalt Monotonic Spacing Scale (`Inner < Outer`, `layout_heading_spacing_inversion`)**:
   - Maintain a strictly increasing spacing hierarchy: `micro-gap (2–4pt) < cell/card inner-padding (4–7pt) < exhibit outer-gap (8–12pt) < section break (14–20pt)`.
   - **Heading Asymmetric Binding**: Every `h2` / `h3` preceded by a flow block must have `margin-top >= 1.8 × margin-bottom` (enforced by `layout_heading_spacing_inversion` at `< 1.5x`) so it visually detaches from the preceding block and locks to the content below it.
8. **Korean A4 Margin Profiles & ECFS Stamp / Bates Collision Guard**:
   - **High-Density Forensic / Analyst Report**: `@page { size: A4; margin: 14mm 16mm; }` (`178 × 269 mm`, `76.8%` printable area, body `10pt`, table `9pt`, mono `8.5pt`).
   - **W3C General Standard**: `@page { size: A4; margin: 20mm; }` (`170 × 257 mm`, `70.0%` printable area).
   - **MOIS Official Brief (행안부 공문서 표준)**: `@page { size: A4; margin: 30mm 20mm 15mm 20mm; }` (`170 × 252 mm`, `68.7%` printable area).
   - **Supreme Court ECFS Brief (대법원 전자소송 민사소송규칙 제4조)**: `@page { size: A4; margin: 45mm 20mm 30mm 20mm; }` (`170 × 222 mm`, `60.5%` printable area, body `12pt`, line-height `180–200%`).
   - **Court Evidence Stamp (`stamp_evidence.py`) & Bates Safe Zone**: `stamp_evidence.py` stamps the `[갑 제O호증]` box in the top-right (`y = 20pt..44pt`, `x = right - 140pt..right - 25pt`) and Bates page numbers (`P-0001`) at the bottom-center (`y = height - 34pt..-6pt`). When a `14mm` (`39.7pt`) top/bottom margin PDF will be stamped, either (a) use `@page { margin: 18mm 16mm 16mm 16mm; }` (`min-height: 261mm`) or reserve a top-right `.stamp-safe-zone` so the stamp never collides with `.doc-header .meta-line`, and (b) use a **2-column left/right `.sheet-footer`** (leaving the center `200pt` clear so bottom-center Bates numbers never collide with footer text).
9. **Automated Layout Gate Verification (`report-tools.mjs`)**:
   - `layout-probe.mjs` and `gates-layout.mjs` enforce `layout_page_underfill` (unwrapping `.sheet-body` / `flex-grow > 0` containers and checking all page boxes regardless of `CAP`), `layout_cell_void_imbalance` (using `TreeWalker` tight text-node bounds and requiring a height-driving sibling cell in the same row), `layout_print_shrink_risk` (flagging tables `>674px` or `nowrap` cells `>95ch`), and `layout_heading_spacing_inversion` (flagging `h2/h3` with `margin-top < 1.5 × margin-bottom`).
