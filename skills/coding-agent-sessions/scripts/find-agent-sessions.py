#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# ///
# --- How to run ---
# python3 scripts/find-agent-sessions.py list --limit 20
# python3 scripts/find-agent-sessions.py search "commit" --from 7d
# python3 scripts/find-agent-sessions.py get <session-id>
from __future__ import annotations

import sys
sys.dont_write_bytecode = True
for _s in (sys.stdout, sys.stderr):
    if hasattr(_s, "reconfigure"):
        _s.reconfigure(encoding="utf-8", errors="replace")
import runpy
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))


if __name__ == "__main__":
    _ = runpy.run_module("agent_sessions.cli", run_name="__main__")
