#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""lazy_rag.py — Zero-Server AutoRAG + Korean Morpheme Hybrid RRF Engine."""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sqlite3
import sys
from pathlib import Path
from typing import Any

BUDGETS: dict[str, dict[str, int]] = {"direct": {"local": 2, "web": 4}, "explore": {"local": 3, "web": 10}, "compare": {"local": 5, "web": 18}}
PARTICLES_RE = re.compile(r"(?:은|는|이|가|을|를|의|에|에서|으로|로|와|과|도|만|에게|한테|이나|나|으로서|으로써)$")
PREDICATES_RE = re.compile(r"(?:되었습니|되었습니다|되었다|됩니다|된다|되다|하였습니|하였습니다|하였다|합니다|한다|하다|했습니|했습니다|했다|입니다|이다)$")
TOKEN_RE = re.compile(r"[가-힣a-zA-Z0-9一-龥]+(?:-[가-힣a-zA-Z0-9一-龥]+)*")
_MORPH_FN, _MORPH_LOADED = None, False


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


def extractive_compress(text: str, q_tokens: list[str]) -> str:
    sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n+", (text or "").strip()) if s.strip()]
    if len(sents) <= 3 or not q_tokens:
        return (text or "").strip()
    for idx, sent in enumerate(sents):
        sl = sent.lower()
        if any(t in sl for t in q_tokens):
            lo, hi = max(0, idx - 1), min(len(sents), idx + 2)
            return " ".join(sents[lo:hi])
    return " ".join(sents[:2])


def open_db(db_path: Path) -> sqlite3.Connection:
    from lazy_memory import init_db
    conn = init_db(db_path)
    conn.execute("PRAGMA busy_timeout=30000")
    return conn


def cmd_index(db_path: Path, args: argparse.Namespace) -> dict[str, Any]:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from lazy_memory import cmd_resolve, init_db
    conn = init_db(db_path)
    if args.content or args.subject:
        cmd_resolve(conn, args)
    conn.execute("BEGIN IMMEDIATE")
    rows = conn.execute("SELECT * FROM memories WHERE status='active'").fetchall()
    conn.execute("DELETE FROM memories_fts")
    for r in rows:
        morph = " ".join(extract_morphemes(f"{r['subject']} {r['predicate']} {r['object']} {r['content']}"))
        conn.execute("UPDATE memories SET morph_tokens=? WHERE id=?", (morph, r["id"]))
        conn.execute("INSERT INTO memories_fts VALUES(?,?,?,?,?)", (r["id"], r["content"], morph, r["subject"], r["object"]))
    conn.execute("COMMIT")
    conn.close()
    return {"ok": True, "indexed": len(rows)}


def cmd_query(db_path: Path, query: str, max_bytes: int, mode: str = "direct", top_k: int | None = None) -> dict[str, Any]:
    limit = top_k if top_k and top_k > 0 else BUDGETS.get(mode, BUDGETS["direct"])["local"]
    if not db_path.is_file():
        return {"ok": True, "query": query, "mode": mode, "results": []}
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    conn = open_db(db_path)
    q_tokens = extract_morphemes(query)
    q_set = set(q_tokens)
    active = {r["id"]: dict(r) for r in conn.execute("SELECT * FROM memories WHERE status='active'").fetchall()}
    fts_ranks: dict[str, int] = {}
    if q_tokens and active:
        fts_expr = " OR ".join('"' + t.replace('"', "") + '"' for t in q_tokens)
        try:
            fts_rows = conn.execute("SELECT id FROM memories_fts WHERE memories_fts MATCH ? ORDER BY bm25(memories_fts) ASC", (fts_expr,)).fetchall()
            for rank, r in enumerate([x for x in fts_rows if x["id"] in active], 1):
                fts_ranks[r["id"]] = rank
        except Exception:
            pass
    morph_scores: list[tuple[float, str]] = []
    for mid, r in active.items():
        d_set = set((r.get("morph_tokens") or "").split()) | set(extract_morphemes(f"{r.get('subject') or ''} {r.get('predicate') or ''} {r.get('object') or ''} {r.get('content') or ''}"))
        jacc = (len(q_set & d_set) / len(q_set | d_set)) if (q_set and d_set) else 0.0
        if jacc > 0:
            morph_scores.append((jacc, mid))
    morph_scores.sort(key=lambda x: (-x[0], x[1]))
    morph_ranks = {mid: rank for rank, (_, mid) in enumerate(morph_scores, 1)}
    scored: list[dict[str, Any]] = []
    for mid in set(fts_ranks.keys()) | set(morph_ranks.keys()):
        r_fts, r_morph = fts_ranks.get(mid), morph_ranks.get(mid)
        rrf = (1.0 / (60 + r_fts) if r_fts else 0.0) + (1.0 / (60 + r_morph) if r_morph else 0.0)
        rec = dict(active[mid])
        rec.update({"rrf_score": round(rrf, 6), "r_fts": r_fts, "r_morph": r_morph, "snippet": extractive_compress(rec.get("content") or "", q_tokens)})
        scored.append(rec)
    scored.sort(key=lambda x: (-x["rrf_score"], -(x.get("hit_count") or 0)))
    results, used_bytes = [], 0
    for rec in scored[:limit]:
        sb = len((rec.get("snippet") or "").encode("utf-8"))
        if max_bytes and max_bytes > 0 and used_bytes + sb > max_bytes:
            rem = max_bytes - used_bytes
            if rem <= 0 and results:
                break
            if rem > 0:
                rec["snippet"] = (rec.get("snippet") or "").encode("utf-8")[:rem].decode("utf-8", errors="ignore")
                sb = len(rec["snippet"].encode("utf-8"))
        used_bytes += sb
        conn.execute("UPDATE memories SET hit_count = COALESCE(hit_count, 0) + 1 WHERE id=?", (rec["id"],))
        rec["hit_count"] = (rec.get("hit_count") or 0) + 1
        results.append(rec)
    conn.commit()
    conn.close()
    return {"ok": True, "query": query, "mode": mode, "q_tokens": q_tokens, "results": results}


def build_recall_pack(db_path: Path, max_bytes: int) -> str:
    if not db_path.is_file():
        return ""
    try:
        conn = sqlite3.connect(str(db_path), timeout=30.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout=30000")
        mems = conn.execute("SELECT * FROM memories WHERE status='active' ORDER BY hit_count DESC, valid_from DESC LIMIT 10").fetchall()
        edges = conn.execute("SELECT src, rel, dst FROM entity_edges WHERE valid_to IS NULL LIMIT 8").fetchall()
        conn.close()
    except Exception:
        return ""
    if not mems and not edges:
        return ""
    lines = ["### 로컬 메모리 리콜 팩 (.lazyargon/memory.db)"]
    for r in mems:
        lines.append(f"- [{r['kind']}] {r['subject']} {r['predicate']} {r['object']}".strip() if r["subject"] else f"- [{r['kind']}] {r['content']}")
    if edges:
        lines.append("- 엔티티: " + ", ".join(f"{e['src']}->{e['rel']}->{e['dst']}" for e in edges))
    out, used = [], 0
    for ln in lines:
        b = len((ln + "\n").encode("utf-8"))
        if used + b > max_bytes:
            break
        out.append(ln)
        used += b
    return "\n".join(out)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("cmd", choices=["index", "query", "recall-pack", "budget"])
    p.add_argument("--db", default=".lazyargon/memory.db")
    p.add_argument("--query", default="")
    p.add_argument("--mode", choices=["direct", "explore", "compare"], default="direct")
    p.add_argument("--top", type=int, default=None)
    p.add_argument("--max-bytes", type=int, default=1200)
    for flag, dflt in (("--kind", "fact"), ("--subject", ""), ("--predicate", ""), ("--object", ""), ("--content", ""), ("--op", ""), ("--source-ref", "")):
        p.add_argument(flag, default=dflt)
    p.add_argument("--hit-count", type=int, default=0)
    p.add_argument("--json", action="store_true")
    args = p.parse_args(argv)
    db_path = Path(args.db)
    if args.cmd == "budget":
        b = BUDGETS[args.mode]
        print(json.dumps({"ok": True, "mode": args.mode, "local": b["local"], "web": b["web"]}, ensure_ascii=False))
        return 0
    if args.cmd == "recall-pack":
        md = build_recall_pack(db_path, args.max_bytes)
        if args.json:
            print(json.dumps({"ok": True, "markdown": md, "bytes": len(md.encode("utf-8"))}, ensure_ascii=False))
        elif md:
            print(md)
        return 0
    out = cmd_index(db_path, args) if args.cmd == "index" else cmd_query(db_path, args.query, args.max_bytes, args.mode, args.top)
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
