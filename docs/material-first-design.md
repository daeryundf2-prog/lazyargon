# Universal Material-First Design Orchestration (LazyArgon × LazyArgon Workspace)

AI-generated artifacts look like "AI slop" across every medium (web UI, HTML/PDF reports, slide decks, diagrams, posters, and brand logos) when the model is told to produce the final surface in a single leap. Without separated causal specs and pre-built materials, the model falls back to its statistical average layout, rainbow badges, arbitrary gradients, and fabricated filler text.

Every design deliverable in the Lazy series follows four universal invariants:

1. **Three Separated Decisions (Purpose / Structure / Style)**: Never mix worldview, data schema, and visual tokens in one prompt.
2. **Material-First Gate (Data & Fixed/Variable Assets Before Surface)**: Build structured data (`JSON`/`TS`) and invariant-locked visual assets before writing layout code or rendering pages.
3. **Taxonomy + Bottom-Up Assembly (`■ Material` + `● Pattern Name` + `◆ Slot`)**: Assemble from smallest atomic exhibit/card to full page using exact taxonomy names rather than vague descriptions.
4. **Reverse-Order Iteration**: When a page or section feels empty, broken, or stranded across page breaks, fix the upstream structure/data spec first—never patch the final HTML/JSX/SVG ad-hoc.

---

## 1. Cross-Domain Material-First Matrix

| Domain & Skill | ① Purpose (`01-brief` + Exclusions) | ② Structure & Materials (`02-data` + Fixed/Variable Assets) | ③ Visual Tokens (`03-style`) | ④ Taxonomy & Bottom-Up Assembly |
| :--- | :--- | :--- | :--- | :--- |
| **Web UI & Brand Showcases**<br/>(`$frontend` → [`material-first-workflow.md`](../skills/frontend/references/design/material-first-workflow.md)) | 1-sentence worldview + **Explicit Exclusions** (e.g., no glass cards, no gradients, line-grid only) | `src/data/products.ts` (specs) + `src/data/content.ts` (hierarchical copy) + Fixed(A)/Variable(B) image pairs | `DESIGN.md` (color ramp, type scale, multi-stage state tokens) | `Card` → `Grid` (`SharedLayoutAnimation`) → `Section` (`LineGrid`, `HorizontalScroll`) → `App` |
| **HTML / PDF Paged Reports & Exhibits**<br/>(`$frontend` [`print-paged-media.md`](../skills/frontend/references/design/print-paged-media.md) + `$forensic-report` + `$forensic-timeline`) | Report scope lock + **Explicit Exclusions** (no rainbow badges, no legal speculation, no unrequested summary callouts) | Verified JSON materials first: `audit.json` (hashes/timestamps), `events.json` (timeline), STT/OCR transcripts, hierarchical section copy | `@page { size: A4; margin: 2cm }`, single-tone Navy/Slate (`#1B365D`/`#334155`), body `≥10pt`, table `≥9pt`, speaker `nowrap` | Atomic exhibits (`break-inside: avoid` on table/figure wrappers) → Sections → HTML → Headless Chrome PDF → `pdftoppm` PNG page-by-page QA |
| **Architecture & Data Diagrams**<br/>(`$diagram-design`) | 1-sentence causal claim the diagram proves + **Exclusions** (no dark neon glow, no shadows, max 2 coral nodes) | Node & Edge inventory table/JSON (≤9 nodes, ≤12 edges, zero invented numbers, `4px` grid coordinates) | `.diagram-design` / `style-guide.md` (`paper`, `ink`, `muted`, `accent`, Geist + Noto Sans KR) | Semantic Pattern (`Secure paved road`, `Fan-in queue`) + 39 Visual Types → orthogonal `r=8` arrows first → masked labels → nodes → bottom legend |
| **Posters, Editorial & Slide Decks**<br/>(`$image-prompt`) | Core message + **Exclusions** (Tier-0 all-positive scene framing, no SD-era buzzwords, no card-news clutter on posters) | `.jsonl` batch: **Fixed Slot A** (`Deck DNA`, HEX 3–5, lighting/camera result) + **Variable Slot B** (per-cut subject + quoted copy roles `headline`/`subhead`) | `look-presets.md` (`L1–L9`) + size lock (`1024x1536`, `1792x1024`, `2048x2048`) | Promo taxonomy (`P1–P8`), Typo-poster (`TP1–TP14`), Concept axes (`M1–M10`) → `check_prompt.mjs` → 1 row = 1 cut render |
| **Brand Logos & Identity Systems**<br/>(`$logo-design`) | 3–5 brand adjectives + **Category Cliché Exclusions** (e.g., no shields/globes for fintech) | Word map + 8–12 one-sentence concepts → top 3 selected + 3–5 reference SVGs from the 1,400+ library | `viewBox="0 0 256 256"`, solid black on white first, exact angles (`0/15/30/45/60/90°`), `evenodd` holes | Black SVG symbol → `svg_audit.py` & `preview_sheet.py` (`16px` test) → Concept Checkpoint → Lockups & `presentation_board.py` |

---

## 2. Deep Dive: HTML & PDF Reports (`print-paged-media` + `forensic-report`)

HTML/PDF reports suffer from two classes of AI slop: **content slop** (invented hashes/metrics, essay-style filler, editorializing) and **pagination slop** (tables sliced in half, headings orphaned at page bottom, or giant half-empty pages caused by overusing `break-inside: avoid`). Applying the Material-First workflow solves both:

### Step 1. Separate the Three Report Specs
1. **Purpose & Exclusions (`.lazyargon/ulw-scope.md`)**: Lock the exact target questions and forbid decorative AI habits (no rainbow status pills, no self-congratulatory badges like `[전수 검증 완료]`, no legal conclusion leaps).
2. **Structure & Verified Materials (`audit.json`, `events.json`, `report_data.json`)**:
   - Run deterministic scripts first (`audit_timestamps.py`, `local_stt.py`, `local_ocr.py`, `data-scientist` DuckDB/Polars queries).
   - Store all tables, timeline rows, and `<evidence>` quotes as structured data before writing HTML/Markdown prose. Missing data is explicitly marked `미확인` or `—`.
3. **Visual & Page-Box Tokens (`print-paged-media.md`)**:
   - Lock `@page { size: A4; margin: 2cm; }` and `preferCSSPageSize: true` + `printBackground: true`.
   - Lock typography floors: Korean body `≥10pt` (`13.3px+`), tables `≥9pt` (`12px+`), speaker/name/timestamp cells `white-space: nowrap`, prose cells `word-break: keep-all`.
   - Lock the single-tone editorial palette: Deep Navy (`#1B365D` / `#0F172A`) + Slate (`#334155` / `#64748B` / `#F8FAFC`).

### Step 2. Bottom-Up Atomic Exhibit Assembly
Instead of generating a 1,000-line monolithic HTML report at once (which hits host stream cutoffs and breaks pagination):
1. **Build Atomic Exhibits first**: Construct each data table (caption + `<table>` + source footnote), timeline card, or annotated figure inside a dedicated `.exhibit-atomic` wrapper with `break-inside: avoid`. Keep ordinary prose paragraphs breakable (`orphans: 3; widows: 3`).
2. **Compose Sections**: Combine atomic exhibits with short, high-density prose paragraphs (≤4 sentences per paragraph, report summary ≤10 lines) in ≤100-line chunks.
3. **Render & Inspect Page-by-Page (Reverse-Order Pagination Repair)**:
   - Render HTML to PDF via Headless Chrome (using an isolated `os.tmpdir()` profile), then convert PDF pages to PNG (`pdftoppm -png -r 150`).
   - If a page shows a **keep-together stranding defect** (a tall atomic exhibit pushed to the next page leaving >40% whitespace), do not shrink the font below `9pt`. Instead, go back to the **Structure layer**: split the oversized table into logical sub-tables in the data source, or remove forced `break-before: page` on short trailing sections.
