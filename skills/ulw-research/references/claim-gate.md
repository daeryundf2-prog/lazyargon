# Claim gate (Phase 4b, mechanical)

The orchestrator keeps two JSONL files in `$SESSION_DIR` next to `claim-graph.md`. `claim-graph.md` stays the readable view; these files are what the gate checks. Workers never write them: they report candidates in `## CLAIMS` reply blocks and you record them.

## sources.jsonl (one source per line)

```json
{"id":"S1","url":"https://www.law.go.kr/...","type":"statute","org":"law.go.kr","title":"...","observed_at":"2026-11-15"}
```

- `type` is the surface. Primary types: `standards_document`, `official_docs`, `official_blog`, `official_release`, `government`, `law_db`, `court_decision`, `statute`, `filing`, `sec_filing`, `peer_reviewed`, `primary`, `repository`, `api`, `dataset`. Anything else (`news`, `blog`, `forum`, `vendor_report`, ...) is secondary.
- `org` is optional. Without it the organization is inferred from the host (docs.python.org and peps.python.org are one organization; `*.co.kr`, `*.github.io`, `*.tistory.com` keep three labels).
- Every URL a counter-search opened is registered here too.
- `snapshot` is written by `claims snapshot`; do not fill it by hand.

## claims.jsonl (one claim per line)

```json
{"id":"C1","text":"...","risk":"high","claim_type":"numeric","source_ids":["S1","S4"],
 "evidence":[{"source_id":"S1","quote":"verbatim sentence copied from the page, 20-300 chars"}],
 "counter_search":{"query":"...","urls":["https://..."],"summary":"..."},
 "observed_at":"2026-11-15","valid_at":"2026-03-01"}
```

- Ids are `C<number>`; the report cites them as `[C12]`.
- `risk: "high"` for numeric, legal, dated, causal, financial and market claims, and anything the deliverable's conclusion rests on.
- `claim_type`: `numeric`, `legal`, `dated`, `causal`, `financial`, `executable`, `other`. `executable` claims carry `execution_proof: {script, output, env, verdict: confirmed|refuted|partial}` from Phase 4 instead of quotes.
- Optional: `conflicting: true` (unresolved disagreement), `counter_refuted: true` (the counter-search won), `single_source_exception: "<why one primary source is enough>"` (only honored when that source is primary).

## Gate rules

A claim is `verified` only when:

- at least 2 independent organizations back it (or a recorded single-source exception on a primary source);
- it is not marked conflicting or refuted;
- for high-risk claims, additionally: a structured counter-search (`{query, urls, summary}`; free text or none fails the whole gate as a procedure violation), a primary source type, at least 2 source surface types, and at least one evidence quote. Every quote must appear verbatim in the stored snapshot of its source (normalization: NFKC, straight quotes, markdown marks, whitespace, case; no fuzzy matching), the snapshot must still match its sha256, and a `numeric` claim needs a matched quote that contains one of its numbers.

Everything else is `unresolved` or `refuted` and may appear only under the synthesis Gaps, Contradictions or Debate record sections or an `Unresolved`/`Refuted` (미확정/반증/부록/Annex/Appendix) heading.

## Commands

```bash
node "$SKILL_DIR/scripts/report-tools.mjs" claims snapshot --session-dir "$SESSION_DIR"
node "$SKILL_DIR/scripts/report-tools.mjs" claims gate --session-dir "$SESSION_DIR"
node "$SKILL_DIR/scripts/report-tools.mjs" claims report --session-dir "$SESSION_DIR" --report "$SESSION_DIR/SYNTHESIS.md"
```

- `claims snapshot` fetches every source that a high-risk quote points at (`--all` for every quote, `--refresh` to refetch) and stores its text under `sources/snapshots/<id>.txt` with a sha256. HTML becomes its prose text. PDFs, scans and pages that block plain fetches are refused: open them with your own tools, save the text, and pass `--from S3=/path/to/text.txt` (an `.html` file is converted to text). A source that could not be stored leaves its quotes unverifiable, so its claims stay unresolved.
- `claims gate` writes `claim-status.json` and, only when it passes, `verified-claims.json`. A failed gate deletes any earlier `verified-claims.json` and writes `gate-failed.json`, so nothing can be synthesized from a failed run. Exit 1 = procedure violations to fix; exit 2 = malformed ledger (unknown source ids, evidence from a source the claim does not cite, unregistered counter-search URLs). A warning is printed when more than half the claims are unresolved.
- `claims report` checks the Markdown report: every `[C<n>]` outside an annex must be verified, unknown ids are ghosts, and at least one verified claim must be cited (`--min-coverage 0.6` to demand more). It fails while the gate has not passed.
