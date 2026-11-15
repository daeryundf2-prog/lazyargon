# ulw-research — wave composition, lifecycle, and member briefs

## How this maps to Antigravity subagents

This skill is authored against the Antigravity `invoke_subagent` tool surface. You coordinate everything with these tools:

| Purpose | Tool | Key arguments |
|---------|------|---------------|
| Stand up the research wave once | `invoke_subagent` | parallel flat `{ TypeName: "self", Role, Model, Prompt }` calls in the same turn — members start together |
| Send a lead / a debate round onward | next-wave `Prompt` | subagents cannot receive follow-up messages mid-run — fold the lead into the next wave's prompt text |
| Collect member replies | returned results | results arrive on completion; act on each as it lands |
| Track shared research state | `$SESSION_DIR` files | `expansion-log.md`, `claim-graph.md`, `sources-ledger.md` are the shared board — workers report in reply text, you journal |
| Spawn a bounded recon / expansion / verification lane | `invoke_subagent` entry | `Role` names the territory, `Model: "inherit"` for all lanes including `browser` (`"flash"` retired; `"flash_lite"` only for 0% primary quota emergency fallback), `Prompt` carries the full brief |
| End a lane | — | subagents terminate when their prompt is complete; no explicit teardown tool exists |
| Disband the wave at the end | — | no team object persists; "done" = every spawned subagent accounted for before the final answer |

Subagents return their findings in their final reply text; they cannot see each other's replies except through what you relay in the next wave's prompts. You are the information broker. Read-only recon lanes and premium attack lanes differ only by `Model` tier and `Prompt` — Antigravity has no curated-agent registry, so every role is spelled out in its `Prompt`.

## Phase 0 — Scope solo, organize the brief

Before spawning anything, decompose the query YOURSELF with your own direct tools: a handful of fast searches, a skim of the obvious codebase or doc territory, batching the independent lookups yourself. This is a scoping pass, not research — minutes, not waves. Start from "what must be true if the user's intent/spec is true?", not "what looks broken?"

```
<analysis>
Core question: <the actual information need>
Axes (3+ orthogonal): <axis — what to search, where, why> ...
Codebase relevant: <yes/no> · External: <yes/no> · Browsing: <yes/no> · Verification likely: <yes/no> · X/social signal: <yes/no>
Scale: <axis count, source territories, target document length> · Precision demand: <what a wrong claim costs here> → lifecycle: <single team | research team then refinement-debate team>
Debate need: <which claims will be contested, and which member perspectives attack them>
</analysis>
```

Then create the session directory and write the brief:

```bash
mkdir -p .lazyargon/ulw-research/$(date +%Y%m%d-%H%M%S)
```

This is `$SESSION_DIR`. Write `brief.md` into it: the analysis block, the axis list with one named owner per axis, the expected truths seeding `intent-diff.md`, and the team roster you are about to create. The brief is what the team is built FROM — a team stood up before the brief exists is a failure mode (see the table at the end).

## Phase 1 — Stand up the team (DEFAULT composition)

**When the user asked for MASS research, scale the waves, not the roster.** "mass ulw research", "mulw research", "ulw mass research" — in any language — order over-collection that a single wave cannot produce. Run collection as chained `invoke_subagent` waves at mass scale: an opening `Model: "inherit"` wave at the runtime's parallel ceiling covering every angle the topic has, each wave's EXPAND leads defining the next wave's `invoke_subagent` calls until convergence, and a synthesis that reduces through several parallel `Model: "inherit"` lanes into one final `Model: "inherit"` reducer. Everything else in this skill still binds: the deliverable interview, the journal, the claim graph, the convergence rules, and the delivery gates. Keep a dedicated `Model: "inherit"` attack wave for the debate rounds of Phase 3 — attack is a prompt role, and collection lanes do not critique themselves.

Otherwise a parallel wave is the DEFAULT for ulw-research, not an option: a lead one member surfaces almost always reshapes what another should search next, and debate needs cooperating members, not fire-and-forget workers. Launch it immediately after the brief — emit parallel flat `invoke_subagent` calls in the same turn for the whole first wave:

```
invoke_subagent({ TypeName: "self", Role: "axis-owner-1", Model: "inherit", Prompt: "<member brief for axis 1 — see below>" })
invoke_subagent({ TypeName: "self", Role: "axis-owner-2", Model: "inherit", Prompt: "<member brief for axis 2>" })
invoke_subagent({ TypeName: "self", Role: "skeptic", Model: "inherit", Prompt: "<debate brief — see below>" })
```

All research, skeptic, attack/verification, synthesis, and `browser` lanes run on `inherit` (`flash` retired; `flash_lite` only for 0% primary quota emergency fallback). The total number of entries never exceeds the budget line in `brief.md`.

## Roster rules

- **One member per axis — by part, ownership, or perspective, never a job title.** Each Phase 0 axis is one member owning one concrete slice: a codebase part, a source territory, or a question lens. No two members share an angle. "Backend researcher" or "the web person" gives no real boundary and invites overlap — name what the member owns.
- **Scale the roster to the query.** Default parallel fan-out is 3–4 lanes per wave to protect session quota, or up to the runtime's parallel subagent ceiling when the user explicitly requests saturation (`ulw-research`, `mass-ulw`). If you need more axes covered, split the broadest one — by source territory, by time window, by perspective — across waves or parallel slots.
- **Unify model routing on `Model: "inherit"`.** Antigravity routes all substantive recon, contested analysis, attack lanes, and synthesis work with `Model: "inherit"` (Gemini 4 Argon). Use `Model: "flash_lite"` strictly for emergency quota fallback (never use `"flash"` or `"pro"`). Every `invoke_subagent` call is a flat `{ TypeName, Role, Model, Prompt }` object carrying its full brief in `Prompt` (never wrap in `Subagents: [...]` or pass `toolAction`/`toolSummary`).
- **Routing words from the user are literal.** "quick", "fast", "deep", "최대 병렬" are hard instructions, not mood. Route exactly as asked and journal `requested tier -> spawned model -> fallback reason` for every slot.
- **Debate members are mandatory for ultradebate/hyperdebate, default otherwise.** At least one skeptic/red-team member (`Model: "inherit"`) whose ONLY job is attack: cross-critique claims, evidence quality, source independence, synthesis structure, and report choices before they reach the deliverable. When the user says ultradebate or hyperdebate, run at least two attacking perspectives (e.g. a skeptic attacking evidence and a contrarian attacking framing) and give every contested claim a full round. Run debate as a dedicated wave (or via `send_message` to an idle debate subagent): collect claims in wave N, dispatch the attack wave in wave N+1 with the claims embedded in each prompt.
- **The raise law — every lead returns via `send_message` in the reply tail.** Member briefs order relentless reporting: every new lead, finding, contradiction, and dead end goes into the `## EXPAND` tail of the member's `send_message` report back to the parent, never hoarded. Act on each lead the moment its result lands (Phase 3) by folding it into the next wave's prompts.
- **Track shared state in the open.** Register the axes and major leads in `expansion-log.md` and `claim-graph.md` in `$SESSION_DIR` and keep them current so the run reconstructs after any context loss.

## Wave lifecycle — one wave sequence, or a staged lifecycle, decided by scale and precision

One research wave series is the floor, not the ceiling. Decide from the brief at Phase 0, and re-decide when the topic grows:

| Signal | Lifecycle |
|---|---|
| One deliverable, one domain, ordinary stakes | ONE wave series: research, debate, and synthesis in place. |
| 6+ axes, several source territories, or a long final document | Research waves first. Once the axes converge, launch a REFINEMENT wave of `Model: "inherit"` members whose only job is to attack and sharpen the synthesis before a word of the document is written. |
| A wrong claim is expensive (legal, medical, financial, procurement, public-facing) or the user asked for ultradebate/hyperdebate on the CONCLUSIONS | The same split, plus a dedicated writing pass: the refinement wave hands a locked claim set to the assembly lane, and nothing enters the document that the refinement round did not survive. |

Sequencing beats stuffing — a fresh premium wave reading a finished journal reasons better than the same researchers grading their own homework. Build each wave from a written brief, run its round, and account for every result before the next wave starts.

## Member brief contract

Every member `Prompt` contains, in order:

1. `TASK:` — one imperative line naming the role and the owned axis.
2. The budget lift: "This is an explicit exhaustive-research assignment. Your default retrieval budget and stop-when-answered rules do not apply — run the full protocol below and raise every lead."
3. Scope — the axis, the sources to hit, and what a complete answer contains.
4. The role protocol (see `role-protocols.md`).
5. The raise law and the `send_message` reply tail. EXPAND markers, observation candidates, and claim candidates travel back in the subagent's `send_message` payload to the parent, never as files. Every substantial report ends with:

```
## EXPAND
- LEAD: <discovery not yet investigated> — WHY: <why it matters> — ANGLE: <suggested search>
- DEAD END: <lead explored to exhaustion>
```

A member with nothing to expand returns `## EXPAND` followed by `none — <one-line reason>`. A report missing the tail is incomplete: that axis is not covered — respawn or message the lane in the next wave with the tail requirement spelled out again.

## Phase 3 — Expand and debate until convergence

This loop is what makes the mode research rather than search. Collect returns as subagents complete — there is no mid-run peek or follow-up message in Antigravity, so wave size stays small enough that no lane runs long enough to stall the loop — and act on each raised lead the moment it arrives:

1. Journal the return the moment it lands, never at the end of the wave: digest plus verbatim EXPAND markers into `wave-<N>-<kind>-<axis>.md`, and append each new source, quote, and number to `sources-ledger.md` and `observation-manifest.md` in the same beat. Real-time journaling is what makes the run survivable — after a compaction the journal, not your memory, is the state.
2. Deduplicate new markers against `expansion-log.md` — every lead ever seen, not just confirmed ones, or rejected leads resurface each wave.
3. Route each new unchecked lead in the next expansion wave: batch the leads that arrived this round into parallel `invoke_subagent` calls in the same turn — one call per territory, the lead embedded in its prompt:

```
invoke_subagent({ TypeName: "self", Role: "expansion-<territory>", Model: "inherit",
Prompt: "TASK: expansion wave <N> — investigate: <lead>.
PARENT: <which return surfaced it>. This is an explicit exhaustive-research assignment; budgets do not apply.
<role protocol for the lead's territory>
End your reply with the ## EXPAND tail." })
```

4. **Debate rounds (the ultradebate/hyperdebate engine).** Subagents cannot receive mid-run messages, so debate runs as dedicated waves: collect contested, high-risk, or surprising claims from the round's returns, then dispatch a `Model: "inherit"` attack wave — "ATTACK: <claim> — EVIDENCE: <what supports it> — find the weakest assumption, the missing counter-source, the independence failure." Relay the attack output back to a defense lane (fresh subagent carrying both sides, or the original claim embedded for re-examination), collect both sides, then record your verdict in `debate-log.md` and update the claim node. A claim that never drew an attack still gets one skeptic pass before it may enter the synthesis as supported.
5. Record the wave in `expansion-log.md`: spawned, markers gained, leads opened/closed, debates settled.
6. **Relay the user's steering to every subsequent wave.** When the user changes scope, cadence, target sources, language, or format mid-run, embed the exact wording in the next wave's prompts and record it in `expansion-log.md` — already-running subagents cannot be re-briefed, so mark their in-flight results as pre-steering when they land. Steering only you saw silently splits the wave's assignment from the user's actual ask.
