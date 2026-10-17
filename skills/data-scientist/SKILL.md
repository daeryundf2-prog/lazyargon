---
name: data-scientist
description: "Processes and analyzes data with resident-kernel engines (DuckDB, Polars) and one-shot tools. Use for CSV/parquet/JSON analysis, group-by/join/aggregation, time series, distributions, cleaning, or plotting a dataset."
---

# Data Scientist: Hybrid-Engine Data Processing

Answer data questions through the cheapest engine and surface that can prove the answer, and
decide where the computation should live before touching the data.

## Execution surfaces: resident kernel first

A persistent REPL/eval kernel (many harnesses expose one for JavaScript and Python) is the
default surface. Reason: each one-shot process pays roughly a second of spawn-plus-import
overhead and re-scans the input file, while a resident connection amortizes both — after a
one-time load, repeat queries return in milliseconds. Exploration is repeat queries, so this
difference dominates the session.

1. **JavaScript kernel (Bun)**: run `scripts/ensure-js-deps.sh` once; it prints the absolute
   import path for `@duckdb/node-api`. Dynamic-import it, connect once, query across cells.
2. **Python kernel**: the default surface for Python work. duckdb/numpy/matplotlib are
   typically resident; Polars and pyarrow come from `scripts/ensure-py-deps.sh`, which
   installs them once into a user cache keyed to the kernel's interpreter —
   `sys.path.insert` the printed directory and import. The interpreter itself is never
   mutated.
3. **uv lane** (`uv run --with ...`): isolation for a heavy or crash-prone one-shot that
   should not take the kernel down.
4. **No kernel** (plain-shell harness): the same engines as one-shots — `bun -e` for
   DuckDB-js, `uv run python -c` for the Python stack — batching several questions per
   process.

Per-surface patterns and pitfalls: read `references/execution-surfaces.md` before first use.

## Engine selection

- **DuckDB** for SQL-shaped work: direct file queries, joins, aggregation, subqueries,
  window functions. It queries CSV/Parquet/JSON in place without loading, spills to disk
  past its memory limit, and reads remote files with the same syntax.
- **Polars** when the pipeline is DataFrame-shaped: expression-chain transforms, reshapes,
  streaming datasets past RAM — resident in the Python kernel via `ensure-py-deps.sh`.
  Read `references/polars-lane.md` — the current 1.x API differs from widely-memorized
  older spellings.
- **numpy** when numeric work goes beyond SQL/DataFrame aggregation: statistical tests,
  linear algebra, FFT, random sampling.
- **matplotlib** for every chart — read `references/visualization.md` first; it carries the
  quality bar and a mandatory visual check.

Performance folklore ("X is Nx faster at filtering") varies with data shape, cardinality,
and hardware. When the engine choice materially matters, measure on the actual data instead
of trusting remembered multipliers.

## Placement: decide where the computation lives

Probe before you compute — one cell: file size, free RAM, and (when unclear) a row count via
a direct scan. Then place the work:

- **Load into memory** when the working set stays within roughly a quarter of free RAM AND
  the session will run repeated queries: `CREATE TABLE t AS SELECT ...` (or a collected
  DataFrame) once, then iterate. One scan up front converts every later query from a file
  re-scan into milliseconds.
- **Query in place / stream** when the question is single-pass, or the data exceeds RAM:
  DuckDB reads files directly (`FROM 'data.csv'`); past RAM, cap DuckDB's memory and let it
  spill, or use Polars' streaming engine in the Python kernel. NEVER load a larger-than-RAM
  dataset fully into memory — swapping stalls the whole machine, while streaming merely
  takes longer.
- **Query remotely, in place** when the data lives elsewhere: DuckDB reads http(s)/S3
  Parquet and CSV with projection and predicate pushdown, so fetch the columns and rows the
  question needs, never the whole file. When data sits on another machine you can execute
  on, ship the query to the data and return the small result. Rule: result much smaller
  than data — move the query; repeated local iteration planned — move a pruned copy of the
  data once.

Sizing heuristics and recipes: `references/placement.md`.

## Hard rules

- **NEVER use pandas.** DuckDB and Polars beat it decisively on every analytical workload this skill covers, and the environments this skill assumes do not ship it — `.df()` on a DuckDB result raises unless pandas is installed; convert with `.pl()` via Arrow instead.
- For analytical queries over large Excel inputs, convert or stream rows into SQLite/CSV/Parquet first; for **client-facing or court-submitted `.xlsx` deliverables**, format the final workbook with `openpyxl` (see below).

## Large-Scale Text / Subtitle (VTT/STT) & Excel Corpus Pipeline

When auditing thousands of subtitle files (`.vtt`, `.srt`, Whisper STT JSON/TXT), chat exports, or multi-sheet `.xlsx` logs:

1. **SQLite FTS5 Indexing (`sqlite3` stdlib)**:
   - Instead of re-scanning raw text/VTT/Excel files on every keyword query, parse once into a local SQLite database with an `fts5` virtual table (`CREATE VIRTUAL TABLE docs_fts USING fts5(source_file, timestamp_str, speaker, content)`).
   - Normalize timestamps at ingest time to integer `MM분 SS초` or `HH:MM:SS` (strip fractional seconds like `384.94s` or `.0초`).
   - Run Windows Python scripts with `$env:PYTHONUTF8="1"` via a temporary `.py` file (deleted right after execution) rather than complex nested-quote `python -c` one-liners in PowerShell.
2. **STT Phonetic False-Positive Filtering (음차 오인식·위양성 대조)**:
   - Whisper/auto-caption STT transcripts frequently contain homophone or phonetic transliteration errors for domain terms, proper nouns, and foreign words.
   - Query candidate phonetic variants broadly in FTS/regex first, then inspect surrounding context lines (`±3~5` utterances) and cross-check against primary documents/metadata to filter out false positives before citing any hit as evidence. Never expose internal multi-pass cross-check notes in the final user-facing report.
3. **Deliverable `.xlsx` Formatting (`openpyxl`)**:
   - Raw unstyled Excel dumps clip CJK text and look unfinished. Whenever producing a deliverable `.xlsx` workbook with `openpyxl`, apply:
     - **Header styling & freeze panes**: Navy/slate header fill (`PatternFill("solid", fgColor="1B365D")`), bold white font (`Malgun Gothic`, `10pt`), and `ws.freeze_panes = "A2"`.
     - **Line wrapping & vertical alignment**: `Alignment(wrap_text=True, vertical="top")` on all data cells so multi-line transcripts and notes are readable without manual resizing.
     - **CJK-aware auto column width**: Measure cell string lengths weighting Korean/CJK characters as `1.7–2.0x` ASCII width, clamp column widths to a sensible range (e.g. `min=12`, `max=65`), and set explicit row heights or auto-fit for wrapped rows.

## Output contract

Answer the question; report row counts and timing for anything heavy; then stop — no bonus
charts, no extra exploration passes beyond what the question needed. Chart when asked, or
when the answer is a shape (trend, distribution, comparison) that prose cannot carry — then
follow `references/visualization.md` including its visual QA step.

## References

| Read | When |
| --- | --- |
| `references/execution-surfaces.md` | before the first query on any surface: kernel patterns, one-shot recipes, escalation rules |
| `references/polars-lane.md` | DataFrame-shaped pipeline or data past RAM: current API, Arrow handoff, package sets |
| `references/placement.md` | before heavy or remote work: sizing probe, memory limits, remote reads |
| `references/visualization.md` | before any chart: type selection, quality bar, CJK fonts, visual QA |
| `references/uv-setup.md` | uv missing or broken on this machine |

## CLI fallback

When no kernel or REPL surface exists, `uv run scripts/quick-query.py <file> [SQL]`
(`--filter <polars-sql-expr>`, `--describe`) answers ad-hoc questions with zero code.
Supports CSV, Parquet, JSON, NDJSON.
