# coding-agent-sessions — Cross-Platform Session Finder (Python)

**Generated:** 2026-08-24 (f3642fcda)

## OVERVIEW

The only shared skill besides `ultimate-browsing` carrying a real sub-project: a Python package + CLI that finds, lists, searches, and reads local coding-agent session transcripts across ~25 platforms (Codex, Claude, OpenCode, OMO/Senpi/pi, Gemini/Antigravity, and a long tail), normalizing them into one `Session` model (24 files total, including 16 package modules under `scripts/agent_sessions/` and the `scripts/find-agent-sessions.py` entry point).

## STRUCTURE

```
coding-agent-sessions/
├── SKILL.md                      # router: platform table → references/<platform>.md
├── AGENTS.md                     # architecture and module overview
├── references/                   # codex, claude, opencode, senpi, all-platforms (store layouts per platform)
└── scripts/
    ├── find-agent-sessions.py    # thin shebang entry (PEP 723, >=3.11); runpy → agent_sessions.cli
    └── agent_sessions/           # the package (16 modules)
```

## PUBLIC API (`scripts/agent_sessions/`)

| Module | Key exports |
|--------|-------------|
| `scanners.py` | `scan`, `DEFAULT_PLATFORMS`, `PLATFORM_SCANNERS`, per-platform `scan_*` (codex, claude, opencode, senpi, oh_my_pi, gajae_code, …) |
| `types.py` | `Session`, `Options`, `Json`, `JsonMap` — imported across the package |
| `transcript.py` | parallel file reads, normalization, prompt cleaning (`clean_user_request`, `user_text`), timestamps, session ids; `recent`, `MAX_PLATFORM_FILES` |
| `cli.py` | command parsing, filtering, payload construction, JSON emission |
| platform adapters | `file_scanners.py` (file-backed providers including Gemini/Antigravity `brain` transcripts), `opencode.py` (CLI/SQLite/storage fallbacks), `sqlite_scanners.py`, `sqlite_optional_scanners.py`, `pi_family.py`, `aside_scanner.py`, `kiro_scanner.py`, `claude.py`, `codex.py` |

## CLI CONTRACT

`python3 scripts/find-agent-sessions.py <command>`; aliases `find`=`search`, `read`=`get`. Commands: `list`, `find`/`search` (repeated `--query` lanes, `--from 7d`, repeated `--platform`, `--workers`, `--cwd/--model`, `--include-subagents`, `--limit`), `get`/`read <session-id>`. Output is JSON with `match_reasons` and reconstructed first/last user prompts — that JSON shape is the stable contract.

## CONVENTIONS

- Stdlib-only Python (`>=3.11`), `from __future__ import annotations`, pathlib everywhere; no third-party deps at runtime.
- Probe-first, bounded discovery: platform-specific roots checked before broad globbing; optional platforms excluded from default search when they cannot reconstruct user prompts.
- Main sessions hide subagent children by default but report child counts; `--include-subagents` flips it. Parent/child linkage preserved and records deduplicated.

## ANTI-PATTERNS

- NEVER answer from normalized previews alone — pull the raw transcript (`read`/`get`) for exact evidence.
- Usage-only stores are NOT transcript sources.
- A Claude subagent's embedded `sessionId` is NOT its identity — use its `agentId` + parent-directory linkage.
- An Antigravity main session's post-`USER_INPUT` `SYSTEM_MESSAGE` (`sender=<child-uuid>`) is a child completion report (`SubagentResultEnvelope`), NOT a parent delegation prompt — only the initial `SYSTEM_MESSAGE` before any `USER_INPUT` establishes `parent_id`.
- Don't add a platform by globbing blindly; register it in `PLATFORM_SCANNERS`/`DEFAULT_PLATFORMS` with a bounded root probe.

## COMMANDS

```bash
# from skills/coding-agent-sessions/
python3 scripts/find-agent-sessions.py list --limit 20
python3 scripts/find-agent-sessions.py find "commit" --from 7d --platform senpi --platform opencode
python3 scripts/find-agent-sessions.py read <session-id>
```

- Parent: [`rules/AGENTS.md`](../../rules/AGENTS.md).
