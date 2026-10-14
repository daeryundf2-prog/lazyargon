#!/usr/bin/env python3
"""Package the skill as zip files for upload (e.g. claude.ai → Settings → Capabilities → Skills).

  python tools/package_skill.py          # dist/logo-design.zip (full) + dist/logo-design-lite.zip

The lite package leaves out the 1,400+ SVG files and gallery.html (catalog metadata, scripts and all
references are kept) for platforms with upload size limits.
"""
import argparse
import os
import sys
sys.dont_write_bytecode = True
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKILL = os.path.join(ROOT, "skills", "logo-design")
DIST = os.path.join(ROOT, "dist")
SKIP_DIRS = {"__pycache__", ".DS_Store"}


def build(name, lite, out_dir=DIST):
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, name)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for dirpath, dirnames, filenames in os.walk(SKILL):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
            rel_dir = os.path.relpath(dirpath, SKILL)
            if lite and rel_dir.replace(os.sep, "/").startswith("assets/library/svg"):
                continue
            for fn in filenames:
                if fn in SKIP_DIRS or fn.endswith(".pyc"):
                    continue
                if lite and fn == "gallery.html":
                    continue
                full = os.path.join(dirpath, fn)
                z.write(full, os.path.join("logo-design", os.path.relpath(full, SKILL)))
    print(f"{out}  {os.path.getsize(out) / 1e6:.1f} MB")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out-dir", default=DIST, help="Output directory for zip archives (default: dist/)")
    args = ap.parse_args()
    build("logo-design.zip", lite=False, out_dir=args.out_dir)
    build("logo-design-lite.zip", lite=True, out_dir=args.out_dir)
