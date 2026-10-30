#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""lazy_memory.py — Zero-Server Local Memory Engine (Mem0 + Letta Core/Dreaming)."""

from __future__ import annotations
import argparse, hashlib, importlib.util, json, re, sqlite3, sys, uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

MAX_PINS_LINES = 20
IMPERATIVE_RE = re.compile(r"(?:하라(?:\.|!|$|\s)|반드시\s+\S+.*해야|always\s+do\b|never\s+forget\s+to\b|you\s+must\b)", re.IGNORECASE)
PARTICLES_RE = re.compile(r"(?:은|는|이|가|을|를|의|에|에서|으로|로|와|과|도|만|에게|한테|이나|나|으로서|으로써)$")
PREDICATES_RE = re.compile(r"(?:되었습니|되었습니다|되었다|됩니다|된다|되다|하였습니|하였습니다|하였다|합니다|한다|하다|했습니|했습니다|했다|입니다|이다)$")
TOKEN_RE = re.compile(r"[가-힣a-zA-Z0-9一-龥]+(?:-[가-힣a-zA-Z0-9一-龥]+)*")
_MORPH_FN, _MORPH_LOADED = None, False


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def _stem_word(wl: str) -> list[str]:
    p = PREDICATES_RE.sub("", wl)
    if p != wl:
        return [p] if len(p) >= 2 else []
    s = PARTICLES_RE.sub("", wl)
    return [wl, s] if (s != wl and len(s) >= 2) else [wl]


def extract_morphemes(text: str) -> list[str]:
    global _MORPH_FN, _MORPH_LOADED
    if not _MORPH_LOADED:
        _MORPH_LOADED = True
        cand = Path(__file__).resolve().parents[2] / "lazyargon-workspace" / "scripts" / "korean_morph_grounding.py"
        if cand.is_file():
            try:
                spec = importlib.util.spec_from_file_location("korean_morph_grounding", cand)
                if spec and spec.loader:
                    mod = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(mod)
                    _MORPH_FN = getattr(mod, "extract_content_morphemes", None)
            except Exception:
                _MORPH_FN = None
    tokens: list[str] = []
    if _MORPH_FN is not None and text:
        try:
            tokens.extend(t.lower() for t in _MORPH_FN(text) if t and len(t) >= 2 and not PREDICATES_RE.search(t))
        except Exception:
            pass
    for w in TOKEN_RE.findall(text or ""):
        wl = w.lower()
        tokens.extend(_stem_word(wl))
        if "-" in wl:
            for part in wl.split("-"):
                if part:
                    tokens.extend(_stem_word(part))
    seen: set[str] = set()
    return [x for x in tokens if x and not (x in seen or seen.add(x))]


def init_db(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(
        "CREATE TABLE IF NOT EXISTS memories(id TEXT PRIMARY KEY, kind TEXT, subject TEXT, predicate TEXT, object TEXT, content TEXT, morph_tokens TEXT, valid_from TEXT, valid_to TEXT, status TEXT, hit_count INTEGER DEFAULT 0, source_ref TEXT);"
        "CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(id UNINDEXED, content, morph_tokens, subject, object);"
        "CREATE TABLE IF NOT EXISTS entity_edges(src TEXT, rel TEXT, dst TEXT, memory_id TEXT, valid_to TEXT);"
        "CREATE TABLE IF NOT EXISTS dream_log(id INTEGER PRIMARY KEY AUTOINCREMENT, turn_count INTEGER, merged_count INTEGER, evicted_count INTEGER, promoted_pins INTEGER, created_at TEXT);"
    )
    return conn


def make_id(subject: str, predicate: str, obj: str, content: str, ts: str) -> str:
    return f"mem_{hashlib.sha256(f'{subject}|{predicate}|{obj}|{content}|{ts}'.encode('utf-8')).hexdigest()[:6]}_{uuid.uuid4().hex[:10]}"

def check_admission(kind: str, content: str) -> dict[str, Any] | None:
    if kind not in ("fact", "proc"):
        return {"ok": False, "rejected": "INVALID_KIND"}
    return {"ok": False, "rejected": "IMPERATIVE_SUMMARY"} if IMPERATIVE_RE.search(content or "") else None

def read_pins(pins_path: Path) -> list[str]:
    return [ln.strip() for ln in pins_path.read_text(encoding="utf-8").splitlines() if ln.strip()] if pins_path.is_file() else []

def write_pins(pins_path: Path, lines: list[str]) -> list[str]:
    capped = lines[:MAX_PINS_LINES]
    pins_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = pins_path.with_suffix(".tmp")
    tmp.write_text("\n".join(capped) + ("\n" if capped else ""), encoding="utf-8")
    tmp.replace(pins_path)
    return capped

def _match_existing(conn: sqlite3.Connection, mid_arg: str, subj: str, pred: str, content: str) -> list[sqlite3.Row]:
    if mid_arg:
        return conn.execute("SELECT * FROM memories WHERE id=? AND status='active' ORDER BY rowid DESC", (mid_arg,)).fetchall()
    if subj and pred:
        return conn.execute("SELECT * FROM memories WHERE subject=? AND predicate=? AND status='active' ORDER BY rowid DESC", (subj, pred)).fetchall()
    return conn.execute("SELECT * FROM memories WHERE subject=? AND status='active' ORDER BY rowid DESC", (subj,)).fetchall() if subj else conn.execute("SELECT * FROM memories WHERE content=? AND status='active' ORDER BY rowid DESC", (content,)).fetchall()


def cmd_resolve(conn: sqlite3.Connection, args: argparse.Namespace) -> tuple[dict[str, Any], int]:
    op, subj, pred, obj, mid_arg = (args.op or "").upper(), args.subject or "", args.predicate or "", args.object or "", getattr(args, "id", "") or ""
    content = args.content or (f"{subj} {pred} {obj}".strip())
    if op == "NOOP":
        return {"ok": True, "action": "NOOP"}, 0
    if op != "DELETE":
        rej = check_admission(args.kind or "fact", content)
        if rej:
            return rej, 2
    ts, existing = now_iso(), _match_existing(conn, mid_arg, subj, pred, content)
    if op == "DELETE":
        ids = [r["id"] for r in existing]
        for mid in ids:
            conn.execute("UPDATE memories SET status='deleted', valid_to=? WHERE id=?", (ts, mid))
            conn.execute("UPDATE entity_edges SET valid_to=? WHERE memory_id=? AND valid_to IS NULL", (ts, mid))
            conn.execute("DELETE FROM memories_fts WHERE id=?", (mid,))
        conn.commit()
        return {"ok": True, "action": "DELETED", "deleted_ids": ids}, 0
    if existing:
        top = existing[0]
        if ((obj and top["object"] == obj) or (not obj and top["content"] == content)) and op != "UPDATE":
            return {"ok": True, "action": "NOOP", "id": top["id"]}, 0
        for r in existing:
            conn.execute("UPDATE memories SET status='superseded', valid_to=? WHERE id=?", (ts, r["id"]))
            conn.execute("UPDATE entity_edges SET valid_to=? WHERE memory_id=? AND valid_to IS NULL", (ts, r["id"]))
            conn.execute("DELETE FROM memories_fts WHERE id=?", (r["id"],))
        action, sup_id = ("ADDED" if op == "ADD" else "UPDATED"), top["id"]
    else:
        action, sup_id = "ADDED", None
    mid, morph = make_id(subj, pred, obj, content, ts), " ".join(extract_morphemes(f"{subj} {pred} {obj} {content}"))
    conn.execute("INSERT INTO memories VALUES(?,?,?,?,?,?,?,?,?,'active',?,?)", (mid, args.kind or "fact", subj, pred, obj, content, morph, ts, None, args.hit_count or 0, args.source_ref or ""))
    conn.execute("INSERT INTO memories_fts VALUES(?,?,?,?,?)", (mid, content, morph, subj, obj))
    if subj and pred and obj:
        conn.execute("INSERT INTO entity_edges VALUES(?,?,?,?,NULL)", (subj, pred, obj, mid))
    conn.commit()
    return ({"ok": True, "action": action, "id": mid, "superseded_id": sup_id} if sup_id else {"ok": True, "action": action, "id": mid}), 0


def cmd_core(pins_path: Path, mode: str, args: argparse.Namespace) -> dict[str, Any]:
    lines, key, val = read_pins(pins_path), args.subject or "", args.object or args.content or ""
    entry = f"- {key}: {val}" if key else (val if val.startswith("- ") else f"- {val}")
    if mode == "core-replace" and key:
        idx = next((i for i, ln in enumerate(lines) if ln.startswith(f"- {key}:") or ln.startswith(f"{key}:")), -1)
        lines = (lines[:idx] + [entry] + lines[idx + 1:]) if idx >= 0 else (lines + [entry])
    elif entry not in lines:
        lines.append(entry)
    capped = write_pins(pins_path, lines[-MAX_PINS_LINES:] if len(lines) > MAX_PINS_LINES else lines)
    return {"ok": True, "mode": mode, "line_count": len(capped), "lines": capped}


def cmd_dream(conn: sqlite3.Connection, pins_path: Path, turn_interval: int, turn_arg: int | None = None) -> dict[str, Any]:
    last = conn.execute("SELECT turn_count FROM dream_log ORDER BY id DESC LIMIT 1").fetchone()
    last_turn = int(last["turn_count"] or 0) if last else None
    if turn_arg is not None and last_turn is not None and (turn_arg - last_turn) < turn_interval:
        return {"ok": True, "skipped": "TURN_INTERVAL_NOT_REACHED", "turn_count": turn_arg, "last_turn": last_turn}
    cur_turn = turn_arg if turn_arg is not None else ((last_turn or 0) + turn_interval)
    rows = [dict(r) for r in conn.execute("SELECT * FROM memories WHERE status='active' ORDER BY hit_count DESC, rowid ASC").fetchall()]
    merged, ts, dropped = 0, now_iso(), set()
    for i, a in enumerate(rows):
        if a["id"] in dropped:
            continue
        ta = set(extract_morphemes(a["content"] or "")) or set((a["morph_tokens"] or "").split())
        if not ta:
            continue
        for b in rows[i + 1 :]:
            if b["id"] in dropped:
                continue
            tb = set(extract_morphemes(b["content"] or "")) or set((b["morph_tokens"] or "").split())
            if not tb or (len(ta & tb) / len(ta | tb)) < 0.80:
                continue
            dropped.add(b["id"])
            merged += 1
            a["hit_count"] = (a["hit_count"] or 0) + (b["hit_count"] or 0)
            conn.execute("UPDATE memories SET hit_count=? WHERE id=?", (a["hit_count"], a["id"]))
            conn.execute("UPDATE memories SET status='merged', valid_to=? WHERE id=?", (ts, b["id"]))
            conn.execute("UPDATE entity_edges SET valid_to=? WHERE memory_id=? AND valid_to IS NULL", (ts, b["id"]))
            conn.execute("DELETE FROM memories_fts WHERE id=?", (b["id"],))
    pins, promoted = read_pins(pins_path), 0
    for r in rows:
        if r["id"] not in dropped and r["kind"] == "fact" and (r["hit_count"] or 0) >= 3:
            pin_line = f"- {r['subject']}: {r['object']}" if (r["subject"] and r["object"]) else f"- {r['content']}"
            if pin_line not in pins and len(pins) < MAX_PINS_LINES:
                pins.append(pin_line)
                promoted += 1
    if promoted:
        write_pins(pins_path, pins)
    evicted = len(dropped)
    conn.execute("INSERT INTO dream_log(turn_count,merged_count,evicted_count,promoted_pins,created_at) VALUES(?,?,?,?,?)", (cur_turn, merged, evicted, promoted, ts))
    conn.commit()
    return {"ok": True, "turn_count": cur_turn, "merged_count": merged, "evicted_count": evicted, "promoted_pins": promoted}


def cmd_recall(conn: sqlite3.Connection, args: argparse.Namespace) -> dict[str, Any]:
    q_tokens = extract_morphemes((getattr(args, "query", "") or "").strip())
    mems = [dict(r) for r in conn.execute("SELECT * FROM memories WHERE status='active' ORDER BY hit_count DESC, valid_from DESC").fetchall()]
    if q_tokens:
        mems = [m for m in mems if any(t in (m.get("content") or "").lower() or t in (m.get("morph_tokens") or "").lower() or t in (m.get("subject") or "").lower() for t in q_tokens)]
    episodes: list[dict[str, Any]] = []
    tp = getattr(args, "transcript", "") or ""
    if tp and Path(tp).is_file():
        for idx, line in enumerate(Path(tp).read_text(encoding="utf-8", errors="replace").splitlines()):
            try:
                obj = json.loads(line) if line.strip() else {}
            except Exception:
                obj = {}
            txt = str(obj.get("content") or obj.get("text") or obj.get("message") or "")
            if txt and (not q_tokens or any(t in txt.lower() for t in q_tokens)):
                episodes.append({"step_index": obj.get("step_index", idx), "type": obj.get("type", obj.get("role", "TURN")), "snippet": txt[:240]})
    return {"ok": True, "memories": mems, "episodes": episodes[-10:]}


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("cmd", choices=["resolve", "core-replace", "core-append", "dream", "recall", "stats"])
    for flag, dflt in (("--db", ".lazyargon/memory.db"), ("--pins", ".lazyargon/pins.md"), ("--kind", "fact"), ("--id", ""), ("--subject", ""), ("--predicate", ""), ("--object", ""), ("--content", ""), ("--op", ""), ("--source-ref", ""), ("--transcript", ""), ("--query", "")):
        p.add_argument(flag, default=dflt)
    p.add_argument("--hit-count", type=int, default=0)
    p.add_argument("--turn-interval", type=int, default=5)
    p.add_argument("--turn", type=int, default=None)
    p.add_argument("--json", action="store_true")
    args = p.parse_args(argv)
    if args.cmd in ("core-replace", "core-append"):
        out, code = cmd_core(Path(args.pins), args.cmd, args), 0
    else:
        conn = init_db(Path(args.db))
        if args.cmd == "resolve":
            out, code = cmd_resolve(conn, args)
        elif args.cmd == "dream":
            out, code = cmd_dream(conn, Path(args.pins), args.turn_interval, args.turn), 0
        elif args.cmd == "recall":
            out, code = cmd_recall(conn, args), 0
        else:
            cnt = {k: conn.execute("SELECT COUNT(*) FROM memories WHERE status=?", (k,)).fetchone()[0] for k in ("active", "superseded", "deleted", "merged")}
            out, code = {"ok": True, "counts": cnt, "edges": conn.execute("SELECT COUNT(*) FROM entity_edges WHERE valid_to IS NULL").fetchone()[0]}, 0
        conn.close()
    print(json.dumps(out, ensure_ascii=False))
    return code


if __name__ == "__main__":
    sys.exit(main())
