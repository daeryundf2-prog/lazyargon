# ulw-research — lane role protocols

## Phase 2 — Saturation wave

Launch the entire first wave in a single turn via parallel `invoke_subagent` calls — every member briefed in its own flat `invoke_subagent` call starts in parallel; include bounded lanes in the same turn for the territories the axis owners cannot reach (read-only sweeps, blocked pages). Sequential launches and "start with one and see" defeat the mode.

**Budget first.** Before sizing the wave, write one line into `brief.md`: `예산: <N> 레인 / <M> 웨이브 / 세션 한도 추정 <%>`. Without a user-stated budget the default is **4 lanes per wave, 2 waves**; exceeding it needs the user's yes. Because `Gemini 3.8 Flash` shares the same host quota pool as `Gemini 4` while consuming `4.86x` more tokens per task, unify collection, skeptic, verification, and synthesis lanes on `Model: "inherit"` (`flash_lite` only for emergency quota fallback).

Recommended composition (not a floor — the budget line caps it; when the budget is smaller, drop lanes from the right-hand columns first and keep one browsing lane whenever `Browsing: yes`):

| Query scope | codebase lanes | web lanes | browsing lanes | repo-dive lanes | X lanes | wave members | recommended |
|---|---|---|---|---|---|---|---|
| Single topic, codebase only | 1 | 0 | 0 | 0 | 0 | 2 | 3 |
| Single topic, web only | 0 | 2 | 1 | 0 | 0 | 2 | 5 |
| Single topic, both | 1 | 2 | 1 | 0 | 0 | 2 | 6 |
| Multi-faceted | 1 | 3 | 1 | 1 | 0 | 3 | 9 |
| Full due diligence (user-approved budget) | 2 | 4 | 2 | 2 | 0 | 4 | 14 |

Every lane prompt carries the worker contract from `rules/AGENTS.md` (termination conditions, ≤40-line return, chunked writes) plus the `## EXPAND` tail; the EXPAND tail is capped at 5 leads per lane so the next wave stays inside the budget.

X lanes are 0 in Antigravity — `x_search` does not exist in this runtime (see the X/social role protocol below). When the brief says `X/social signal: yes`, substitute public web sources: `site:x.com`/`site:twitter.com` searches, nitter mirrors, and coverage of the account's statements by indexed outlets. Record the substitution in the brief.

The browsing column is BINDING, not advisory: when the brief says `Browsing: yes`, the roster names a browsing-lane owner armed with the session's actual browser tooling (e.g. the Playwright MCP browser when connected) before the first wave launches, and that lane is spawned in the same call as the rest of the wave. A run that reaches wave 2 with zero browsing lanes on a `Browsing: yes` brief has silently downgraded every source to what plain fetch happened to return. If no browser tool is connected at all, say so in the brief — `browsing: unavailable` — and cover render-dependent sources with archive copies.

**Disambiguate before you expand.** When the topic names something that could resolve several ways — a product, a person, a codename, a version — the first wave settles WHICH entity before any lane researches its history, benchmarks, or controversies: canonical name, first-party URL or account, whether it exists in the claimed category, and a confidence line. An unresolved entity never becomes a premise in a later wave's prompt; that is exactly how a run starts inventing facts about something that does not exist.

Role protocols — embed the relevant one in each member brief or lane prompt; every worker gets a unique angle. Full protocol texts (codebase, web, browsing, X/social-unavailable substitution, repo deep-dive): [references/role-protocols.md](references/role-protocols.md). Two are binding enough to restate: the browsing lane RENDERS pages (screenshots + rendered text, never fetch-only) and `x_search` does not exist in this runtime — X/social claims come from public-source substitution recorded in the brief, never from a claimed x_search call.

Lane ground rules:

- **Read-only.** Recon lanes must not write files. Never ask any worker to write the journal or any session file — every journal write is yours.
- **No recursion — lanes AND members.** Lanes cannot spawn their own subagents, and members must not re-orchestrate: a member researches its axis and reports; it never creates its own team, loads this skill, or fans out a research swarm of its own. Depth comes from YOUR expansion waves. Say so in every member brief — a member that starts its own research protocol burns the run's budget on duplicated orchestration and returns nothing you can cite.
- **Built-in brakes.** Workers ship with their own retrieval budgets ("stop when answered"). Your spawn prompt must explicitly lift the budget and demand the EXPAND tail, or the worker returns a thin single-pass answer with no leads.

## Role protocol texts

Embed the relevant protocol in each member brief or lane prompt; every worker gets a unique angle.

- **Codebase (`explore` lane or member).** Grep with 3+ keyword variations; structural/AST search; LSP definitions and references; file-name globs; `git log --all -S '<keyword>'` and `--grep` for history including deleted code. Cross-validate hits across tools. Report absolute file paths, patterns with `file:line`, and how findings connect.
- **Web (`librarian` lane or member).** At least 10 distinct websearch queries per worker, each with a different operator or angle (see Search craft); fetch the full page for every result that matters — snippets lie. grep.app and `gh search code|repos|issues` for real-world usage. Official docs via sitemap discovery (`<base>/sitemap.xml`), then targeted pages.
- **Browsing (member or lane, armed with the session's browser tool — e.g. Playwright MCP when connected).** This lane RENDERS pages, it does not re-fetch them: its standing deliverable is a full-page screenshot of every top source plus the rendered text that plain fetch could not reach; a lane that returns only `fetch`/`curl` text has not done its job. JS-rendered, login-gated, WAF-blocked, and screenshot-bearing sources all belong here rather than in the web lane. When no browser tool is connected, fall back to archive copies (Wayback, archive.today) and record `browsing: unavailable` in the brief rather than pretending fetch text is rendered truth. **Provenance is part of the claim**: when a source came back as an archive snapshot, cite it with its snapshot timestamp and never state it as the current live page; content from an untrusted proxy route needs a second independent route before any claim rests on it. When one blocked territory hides many leads, fan out more browsing lanes in parallel for breadth instead of serializing one worker through them.
- **X / social — `x_search` is UNAVAILABLE in Antigravity.** Do not claim it ran. Substitute public sources: `site:x.com`/`site:twitter.com` web searches, the account's public web profile, indexed coverage of the statements, and nitter mirrors where reachable; widen recency by phrasing queries as latest/recent. Every X-sourced claim enters the claim graph only after reconciliation against an independent web source. Record `x_search: unavailable — substituted public sources` in the brief.
- **Repo deep-dive (`librarian` lane).** Shallow-clone the most relevant repos to `${TMPDIR:-/tmp}`, pin the HEAD SHA, read core modules, follow call chains, return SHA-pinned permalinks.
