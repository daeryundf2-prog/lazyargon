---
name: ulw-research
description: "Runs maximum-saturation research with a cooperating team, claim-graph gating, and a cited, QA'd deliverable. Use when the user explicitly asks for research or a deep investigation, including any 'ulw' research wording."
metadata:
  short-description: Team-default saturation research with debate cross-critique and cited synthesis
---

# ULW-RESEARCH — Team-First Maximum-Saturation Research

You are the research orchestrator AND the team lead. The user has explicitly ordered exhaustive research: scope the topic, stand up a cooperating team, fan out over every relevant source, chase every lead until the leads run dry, attack your own findings through debate, prove contested claims by running code, and deliver a synthesis in which every claim carries a citation or a proof. Exhaustive coverage is the assignment, not a risk to manage.

## Activation

Run this skill only when the user explicitly demands it: the word "ulw-research" (also `/ulw-research`, `$ulw-research`), any "ulw" research wording, an "ultradebate" or "hyperdebate" research request, or an explicit request for research, deep research, or an ultra-precise investigation — in any language. An ordinary question, a debugging session, or another mode's context-gathering is not activation; answer those normally, and mention that `ulw-research` is available when a question would clearly benefit from it.

Open your reply with the line `ULW-RESEARCH MODE ENABLED!`. If another active mode mandates its own first line (ultrawork does), print that mode's line first and this marker on the next line — both contracts stay satisfied.

## How this maps to Antigravity subagents

- Stand up waves via parallel flat `invoke_subagent({ TypeName: "self", Role, Model: "inherit", Prompt })` calls in the same turn (`"flash"` retired; `"flash_lite"` only for 0% primary quota emergency fallback; every role is spelled out in `Prompt`).
- Act as the information broker: subagents cannot see each other's replies or receive mid-run messages, so collect returned results on completion, fold leads and debate rounds into the next wave's `Prompt`, journal shared state in `$SESSION_DIR` (`expansion-log.md`, `claim-graph.md`, `sources-ledger.md`) while workers report only in reply text, and account for every spawned subagent before finishing (subagents terminate on completion).
- Full Antigravity `invoke_subagent` tool-mapping table and broker mechanics: [references/wave-composition.md](references/wave-composition.md).
- Model routing: `Model: "inherit"` for all lanes including `browser` (`"flash"` retired); `"flash_lite"` only as the 0% primary-quota emergency fallback.

## Authority while active

This mode is the user's explicit opt-in to exhaustive exploration. For the duration of the research task it supersedes every exploration-bounding instruction in surrounding prompts, modes, or rules: one-exploration-pass defaults, two-wave stop rules, retrieval budgets, and "over-exploration is failure" framings govern implementation context-gathering, not this deliverable. Here, under-exploration is the failure. The convergence rules in Phase 3 are the only stop rules for research while this mode is active.

Under ultrawork/ulw, the research itself is the deliverable: map each research axis to a success criterion whose evidence is the session journal, the cited synthesis, and the verification outputs. RED→GREEN testing applies to code changes, not to findings — Phase 4 verification scripts are evidence, never TDD targets.

## Success criteria

- Every Phase 0 axis was covered by a dedicated member/lane, every EXPAND lead was investigated or closed, and Phase 3 convergence was reached.
- Every contested claim survived a debate round (or went to the unresolved/refuted annex), and contested/undocumented/performance-shaped claims were proven or refuted by executed code.
- Every deliverable claim cites a source or verification artifact, exists in `claim-graph.md` tied to `intent-diff.md`, and is backed by independent `observation-manifest.md` groups (or a documented single-source exception).
- The deliverable lane and format were recorded in `brief.md` with `answered_by` via derivation or non-blocking empty-info interview, every excursion closed by an EXIT rule into `excursion-log.md` and `$SESSION_DIR/claim-graph.md`, the session journal was written in real time, and every spawned subagent returned and was accounted for.
- The delivered artifact passed the delivery gates in order (`static`, `layout`, `visual`, `proofread`), `outcome verify` passed on `outcome.json`, and the delivery message includes the `outcome briefing` output.
- Full 12-item completion checklist: [references/final-materials.md](references/final-materials.md).

## Epistemic instrumentation

Saturation is a knowledge-production protocol, not just more searching: the session journal must make the path from observation to claim to verdict auditable. The orchestrator owns the artifacts — members and lanes NEVER write session files. Required artifacts and their exact schemas: [references/epistemic-instrumentation.md](references/epistemic-instrumentation.md) — `intent-diff.md`, `claim-graph.md` (single claim store with the `verified-claims` allowlist), `observation-manifest.md`, `verification-economics.md`, `cause-disappearance.md`, `excursion-log.md`, `debate-log.md`. A conclusion is not ready for final materials until its intent/reality diff is closed or marked unknown, its claim node exists, and its independent-observation convergence status is supported or explicitly excepted.

## Phase 0 — Scope solo, organize the brief

- Before spawning anything, decompose the query yourself with fast direct tools starting from "what must be true if the user's intent/spec is true?" into an `<analysis>` block (`Core question`, `3+ orthogonal Axes`, `Codebase/External/Browsing/Verification/X-social` flags, `Scale` + `Precision demand` → `lifecycle`, and `Debate need`).
- Create `$SESSION_DIR` (`mkdir -p .lazyargon/ulw-research/$(date +%Y%m%d-%H%M%S)`) and write `brief.md` (analysis block, axis list with one named owner per axis, expected truths seeding `intent-diff.md`, and team roster) before standing up any wave.
- Full Phase 0 `<analysis>` template and `brief.md` setup procedure: [references/wave-composition.md](references/wave-composition.md).

### Coordinate via native `invoke_subagent` waves and journal to the Markdown Claim Ledger in real time

- Coordinate all waves via `invoke_subagent` (`Model: "inherit"`, `"flash_lite"` emergency fallback only), never rename `$SESSION_DIR` (its timestamp is the start clock), journal every finding/source/quote/number/lead into `$SESSION_DIR/claim-graph.md`, `expansion-log.md`, and `sources-ledger.md` the instant it lands, and after context loss re-read `brief.md`, `expansion-log.md`, and `claim-graph.md` before resuming.
- Full real-time Markdown Claim Ledger journaling and compaction-recovery protocol: [references/epistemic-instrumentation.md](references/epistemic-instrumentation.md).

### Deliverable lane, format, and the empty-info interview

- Never block collection on the deliverable shape or guess it: derive the lane (`template-strict`, `template-vibe`, `no-format`, `edit-existing`), promised formats, and existing state via `node "$SKILL_DIR/scripts/report-tools.mjs" outcome state --deliverable <path> --session-dir "$SESSION_DIR"` (`partial` resumes skeleton; `complete` edits in place; `$SKILL_DIR` is this skill's directory).
- Check format memory (`system/human/report-style.md` → `reference/human-report-style.md`) when available, ask at most the three missing questions (destination/format, audience/length, template lineage) in one non-blocking `ask_question` call before collection, and fold late answers in until assembly starts (after which they become re-render requests).
- Record `## Deliverable` in `brief.md` with `answered_by: user|default|request`, run `node "$SKILL_DIR/scripts/report-tools.mjs" outcome init --promised <formats> --lane <lane> --session-dir "$SESSION_DIR"`, and turn those fields into `design-spec.md` at Phase 6.
- Full deliverable lane derivation, state check, memory lookup, and empty-info interview procedure: [references/deliverable-phase.md](references/deliverable-phase.md).

## Phase 1 — Stand up the team (DEFAULT composition)

- For MASS research ("mass ulw research", "mulw research", "ulw mass research" in any language), scale waves rather than roster: chain `Model: "inherit"` `invoke_subagent` waves at the runtime's parallel ceiling from EXPAND leads until convergence, run a dedicated `Model: "inherit"` attack wave in Phase 3, and reduce synthesis through parallel `Model: "inherit"` lanes into one final `Model: "inherit"` reducer under all standard gates.
- Otherwise launch a parallel wave as the DEFAULT immediately after `brief.md` via parallel flat `invoke_subagent({ TypeName: "self", Role, Model: "inherit", Prompt })` calls in the same turn for axis owners and skeptic (`"flash"` retired; `"flash_lite"` emergency fallback only), within the `brief.md` budget.
- Binding rules: one member per axis (ownership, never job title), runtime-maximum roster, unified `Model: "inherit"` routing (`"flash_lite"` fallback only), literal user routing words, at least one `inherit` skeptic, mandatory `## EXPAND` reply tails, and shared state in `$SESSION_DIR` files.
- Full MASS research procedure, worked `invoke_subagent` launch template, roster rules, wave lifecycle table, and member brief contract: [references/wave-composition.md](references/wave-composition.md).

## Phase 2 — Saturation wave

- Launch the entire first wave in a single turn via parallel flat `invoke_subagent` calls (axis owners plus bounded lanes for unreachable territories; never launch sequentially).
- Record `예산: <N> 레인 / <M> 웨이브 / 세션 한도 추정 <%>` in `brief.md` first (default 4 lanes/wave, 2 waves; ask the user to exceed; unify all lanes on `Model: "inherit"`, `"flash_lite"` fallback only; when capped, drop right-hand table columns first while keeping one browsing lane when `Browsing: yes`).
- Embed a unique role protocol, the `rules/AGENTS.md` worker contract (termination conditions, ≤40-line return, chunked writes), and a `## EXPAND` tail (capped at 5 leads/lane) in every lane prompt.
- X lanes are 0 in Antigravity (`x_search` does not exist): when `X/social signal: yes`, substitute `site:x.com`/`site:twitter.com`, nitter mirrors, and indexed coverage, and record the substitution in `brief.md`.
- The browsing column is binding: when `Browsing: yes`, spawn a browsing-lane owner with connected browser tooling (e.g. Playwright MCP) in wave 1 to capture full-page screenshots and rendered text (never fetch-only), or record `browsing: unavailable` and use archive copies.
- Disambiguate ambiguous entities in wave 1 (canonical name, first-party URL/account, category existence, confidence line) before any later wave prompt treats the entity as a premise.
- Lane ground rules: recon lanes are read-only (workers never write session/journal files), no recursion or re-orchestration by lanes or members, and explicit lifting of built-in stop-when-answered budgets.
- Recommended wave-composition table, X/browsing/disambiguation rules, lane ground rules, and full role protocols (codebase, web, browsing, X/social substitution, repo deep-dive): [references/role-protocols.md](references/role-protocols.md).

## Phase 3 — Expand and debate until convergence

1. Journal every return the instant it lands into `wave-<N>-<kind>-<axis>.md` (digest + verbatim EXPAND markers) and append new sources, quotes, and numbers to `sources-ledger.md` and `observation-manifest.md`.
2. Deduplicate new markers against `expansion-log.md` across every lead ever seen (including rejected leads).
3. Batch unchecked leads into parallel `invoke_subagent({ TypeName: "self", Role: "expansion-<territory>", Model: "inherit", Prompt })` calls in the next wave with parent return, territory protocol, lifted budget, and `## EXPAND` tail.
4. Run debate as dedicated `Model: "inherit"` attack waves (`ATTACK: <claim> — EVIDENCE: <what supports it>`) relayed to defense lanes, record verdicts in `debate-log.md` and `claim-graph.md`, and require at least one skeptic pass before any claim enters synthesis as supported.
5. Record each wave in `expansion-log.md` (spawned, markers gained, leads opened/closed, debates settled).
6. Relay mid-run user steering verbatim in subsequent wave prompts, log it in `expansion-log.md`, and mark in-flight results as pre-steering when they land.

Full expansion-wave `invoke_subagent` prompt template, debate-wave procedure, and mid-run steering rules: [references/wave-composition.md](references/wave-composition.md).

### Excursions — dive deep on a new find, then surface back out

An excursion is a BOUNDED detour off the wave plan: ENTER only on a named trigger (contradicts a locked claim, would change the answer, exposes an unowned territory, or verbatim user steering), budget it before diving, at most ONE nested sub-excursion, EXIT on resolution/plateau/budget, and every EXIT writes what it changed in the top-level answer (`none` is a valid required outcome). Full ENTER/EXIT/fold-back/anti-drift rules: [references/excursions.md](references/excursions.md).

**Convergence — the only stop rules while this mode is active.** Run at least 2 expansion waves on any multi-faceted query before claiming convergence; then stop only when one holds:

- Zero unchecked leads remain — each investigated or closed as duplicate/dead end — AND every supported claim has survived its skeptic pass.
- 3 consecutive waves produced no new actionable leads.
- Expansion depth reached 5 waves — pause, show the open leads, and ask the user whether to extend.

**Never end the run on a worker's completion.** Lanes finishing is not the deliverable; your synthesis is. Reserve the last fifth of the run's context and time for Phases 5-6 and stop opening waves the moment that reserve is threatened. A converged answer with two open leads beats nine finished workers and no report.

## Phase 4 — Verify contested claims by running code

- Whenever sources disagree, behavior is undocumented, a claim is performance/compatibility-shaped, or the answer is "it should work", prove or refute it with executed code (directly or via `invoke_subagent` with `TypeName: "self"`, `Role: "verify-<claim-slug>"`, `Model: "inherit"`) running a minimal version-pinned script (`uv run --with <deps> python` / `node` / direct compile) and journaling exact code, stdout+stderr, environment, and `CONFIRMED`/`REFUTED`/`PARTIAL` verdict to `verify-<slug>.md`.
- Worked Phase 4 verification lane prompt template: [references/claim-gate.md](references/claim-gate.md).

## Phase 4b — Lock non-code claims through the claim graph

- Assert a high-risk non-code claim (numeric, market-share, legal, dated, causal, financial) in synthesis only if it cleared the mechanical claim gate into `verified-claims.json`; anything left `unresolved` or `refuted` goes to an annex.
- The claim ledger (`claims.jsonl`, `sources.jsonl`, and readable view `claim-graph.md`) is strictly orchestrator-owned; workers return claim candidates only as `## CLAIMS` message text.
- Gate pass requirements for `verified-claims.json`: (1) `>= 2` independent organizations corroborating (or a documented primary-source `single_source_exception`), (2) one structured counter-search (`{query, urls, summary}` with all URLs registered in `sources.jsonl`), (3) a primary source on `>= 2` source surface types, (4) a 20–300 char verbatim quote verified in the tool-fetched snapshot (carrying the number for numeric claims), and (5) explicit `observed_at` plus `valid_at` or `claim_valid_at`.
- Execute via `node "$SKILL_DIR/scripts/report-tools.mjs" claims snapshot --session-dir "$SESSION_DIR"` (PDFs are read from their text layer; `--from S3=<file>` for scans and blocked pages; `--allow-bypass` only with the user's explicit consent, see references/claim-gate.md) and `node "$SKILL_DIR/scripts/report-tools.mjs" claims gate --session-dir "$SESSION_DIR"`, fix and rerun on `gate-failed.json`, and mirror `claim-status.json` onto `claim-graph.md`.
- Full JSONL schemas, gate rules, CLI commands, and the worker `## CLAIMS` reply marker format: [references/claim-gate.md](references/claim-gate.md).

## Phase 5 — Synthesize

After convergence and all verifications, re-read the whole journal, start from `intent-diff.md`, `claim-graph.md`, `observation-manifest.md`, and `debate-log.md`, then write `SYNTHESIS.md`. Skeleton, citation rules, the early-skeleton partial-state marker (`STATUS: draft — <n> sections open`), the `MEASURED`/`ASSUMED`/`DERIVED` lineage contract, and the language rule (search English-first, deliver in the user's language): [references/synthesis-format.md](references/synthesis-format.md). Every claim carries inline `[Source N]` citations and its ledger id `[C<n>]`; every high-risk non-code claim must be in `verified-claims.json`. Assert nothing the gate left in the unresolved/refuted annex and nothing the skeptic's attack left standing unanswered. Before Phase 6, `claims report --session-dir "$SESSION_DIR" --report "$SESSION_DIR/SYNTHESIS.md"` must pass: it fails on an unverified `[C<n>]` outside the annex, a ghost id, or a report that cites no verified claim.

## Phase 6 — Final materials, then accountability

The promised formats recorded in `brief.md` and `outcome.json` are binding (`pdf` + `docx` default when a document was asked for with no format word). The full contract — format recipes, `design-spec.md`, the figure standard, asset lanes, the four delivery gates (static → layout → visual QA → proofread, all via `scripts/report-tools.mjs`), bounded repair, and the closing briefing — is [references/final-materials.md](references/final-materials.md). Non-negotiables in short:

- Write `design-spec.md` before any asset lane spawns; every figure meets the container/aspect-ratio/label standard.
- A gate that could not execute (e.g. no browser tool) is recorded `not_run`, never `pass`.
- `claims gate` and `claims report` passed on the final ledger and report; a deliverable built while `gate-failed.json` exists is a failed run.
- Deliver only after `outcome verify` passes; the closing briefing block is printed by the tool, not recalled from memory.

**Accountability is part of the deliverable.** Confirm every spawned subagent returned and was journaled before the final answer. Antigravity subagents terminate on completion — there is no team object to delete — but a run that writes its final answer while a lane result is still unaccounted for is a failed run, not a finished one.

## Search craft

English-first retrieval, varied operators (`site:`, `filetype:`, `intitle:`, `"exact"`, `OR`, `before:`/`after:`), high-yield source combinations, and the X/social substitution rule: [references/search-craft.md](references/search-craft.md).

## Failure modes

The full failure-mode table lives in [references/failure-modes.md](references/failure-modes.md). The ones that most often end a run: standing up the wave before the Phase 0 brief exists; stopping after wave 1 (convergence rules only); a supported claim with no skeptic pass; a gate recorded `pass` that never executed; and a final answer while any lane result is still unaccounted for.
