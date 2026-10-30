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

## 8. The 5 Whitespace & Density Invariants (Eliminating Uncomfortable Whitespace)

"Uncomfortable whitespace" in HTML/PDF reports comes from four concrete geometric defects: unanchored bottom voids, 4-line wrapping in one narrow column leaving 70%+ empty space in sibling cells, inverted padding/margin ratios, and unframed page edges. Apply these five rules unconditionally:

1. **Dual-Mode Bottom Anchoring (Zero Floating Bottom Voids)**:
   - **Mode A — Curated Fixed-Sheet Mode (`.a4-sheet` + `margin-top: auto`)**: When authoring structured 1-page-per-section sheets under `@page { size: A4; margin: 14mm 16mm; }`, set each `<section class="a4-sheet">` to `min-height: 268mm; display: flex; flex-direction: column; justify-content: space-between; break-after: page;` (`297mm - 28mm = 269mm` minus a `1mm` subpixel safety buffer so Blink never emits a blank trailing page; set `break-after: auto` on `:last-of-type`). Place a `.sheet-footer` (document ID, confidentiality/institution line, signature row, and `Page N / M`) as the last child with `margin-top: auto`. Regardless of body length, the footer locks flush to the `14mm` bottom margin line, framing the A4 sheet top-to-bottom.
   - **Mode B — Flowing Multi-Page Mode (Chrome 131+ `@page` Margin Boxes)**: When a single section flows across an unknown number of pages, keep `display: block; height: auto` on the section (never put multi-page flow inside a flex column) and use `@page` margin boxes (`@bottom-left`, `@bottom-right { content: counter(page) " / " counter(pages); }`) to anchor the bottom edge of every page.
2. **2-Tier Sub-Row Table Pattern (`tbody.row-group > tr.row-main + tr.row-sub`)**:
   - Never put 64-character `SHA-256` + `MD5` hashes, long file paths, or multi-sentence quotes into a narrow right-hand column next to 1-line metadata (`호증`, `파일명`, `크기`, `시각`). Doing so wraps the narrow column to 4 lines and leaves >70% vertical empty void inside every sibling cell (`layout_cell_void_imbalance`).
   - Instead, keep `tr.row-main` strictly to 1-line scannable attributes (`vertical-align: middle`), and place the full-width hash/detail bar inside `<tr class="row-sub"><td colspan="N">` (`background: #F8FAFC; font-size: 8.5pt; word-break: break-all;`). At `178mm` A4 printable width (`672px`), `8.5pt` monospace fits up to `95–100` characters on **one single line**, reducing cell vertical void to 0% and compacting table height by 35–45%.
   - **Never Exceed `178mm` (`672px`) with `white-space: nowrap` in Print Tables (Chromium Print Shrink-to-Fit Trap)**: If a `nowrap` cell or sub-row exceeds ~`95ch` (`>672px`), Chromium's print engine silently triggers **Print Shrink-to-Fit (`scale < 1.0`)**, scaling the entire page down (e.g., `0.689x`) and creating a `90mm+` blank void at the bottom of every page even when `min-height: 267mm` is set. Keep `tr.row-sub` under `95ch` (e.g., `[filename] SHA-256: <64-hex>` while keeping `MD5` in `tr.row-main`) and use `word-break: break-all` instead of `white-space: nowrap` on full-width hash bars.
   - Wrap each record's `tr.row-main + tr.row-sub` pair inside `<tbody class="row-group" style="break-inside: avoid;">` so page breaks never sever a record from its hash bar, and use `border-collapse: separate; border-spacing: 0` with unidirectional borders to prevent Blink multi-page border duplication.
3. **Gestalt Monotonic Spacing Scale (`Inner < Outer`)**:
   - Maintain a strictly increasing spacing hierarchy: `micro-gap (2–4pt) < cell/card inner-padding (4–7pt) < exhibit outer-gap (8–12pt) < section break (14–20pt)`.
   - **Heading Asymmetric Binding**: Every `h2` / `h3` must have `margin-top >= 1.8 × margin-bottom` (e.g., `margin: 10pt 0 4pt 0`) so it visually detaches from the preceding block and locks to the table or paragraph below it.
4. **Korean A4 Margin Profiles by Document Purpose**:
   - **High-Density Forensic / Analyst Report**: `@page { size: A4; margin: 14mm 16mm; }` (`178 × 269 mm`, `76.8%` printable area, body `10pt`, table `9pt`, mono `8.5pt`).
   - **W3C General Standard**: `@page { size: A4; margin: 20mm; }` (`170 × 257 mm`, `70.0%` printable area).
   - **MOIS Official Brief (행안부 공문서 표준)**: `@page { size: A4; margin: 30mm 20mm 15mm 20mm; }` (`170 × 252 mm`, `68.7%` printable area).
   - **Supreme Court ECFS Brief (대법원 전자소송 민사소송규칙 제4조)**: `@page { size: A4; margin: 45mm 20mm 30mm 20mm; }` (`170 × 222 mm`, `60.5%` printable area, body `12pt`, line-height `180–200%`).
5. **Automated Layout Gate Verification (`report-tools.mjs`)**:
   - `layout-probe.mjs` and `gates-layout.mjs` enforce `layout_page_underfill` (flagging non-cover, non-final pages whose in-flow body fills `<60%` of inner height) and `layout_cell_void_imbalance` (flagging table rows `>=84px` tall where `>=50%` of cells use `<=30%` of row height).
