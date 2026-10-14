#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "playwright",
#     "typer",
#     "rich",
# ]
# ///

# ─── How to run ───
# 1. Install uv (if not installed):
#      curl -LsSf https://astral.sh/uv/install.sh | sh
# 2. Chrome must already be installed locally:
#      The script uses channel="chrome"; it downloads no browser.
# 3. Run:
#      uv run lighthouse-audit.py https://example.com
#      uv run lighthouse-audit.py https://example.com --desktop-only
#      uv run lighthouse-audit.py https://example.com --threshold 95
# ──────────────────

"""Lighthouse audit via real Playwright Chrome.

Follows the frontend skill perfection ruleset:
  - NEVER use `lighthouse` CLI (uses headless-shell, not real Chrome)
  - Use Playwright with channel="chrome" (real Chrome stable)
  - Run lighthouse Node API via the Playwright CDP endpoint
  - Mobile preset (primary) + Desktop preset (secondary)
  - 100 in every category is the floor
"""

from __future__ import annotations

import json
import shutil
import socket
import subprocess
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True

import typer
from rich import print as rprint
from rich.table import Table


# Lighthouse config as Node.js script — run via subprocess
LIGHTHOUSE_RUNNER_JS = """\
const url = JSON.parse(process.argv[2]);
const port = parseInt(process.argv[3], 10);
const preset = process.argv[4]; // 'mobile' or 'desktop'

const config = {
  extends: 'lighthouse:default',
  settings: {
    formFactor: preset === 'desktop' ? 'desktop' : 'mobile',
    throttling: preset === 'desktop'
      ? { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 }
      : undefined,
    screenEmulation: preset === 'desktop'
      ? { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1 }
      : undefined,
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
  },
};

(async () => {
  const lhMod = await import('lighthouse');
  const lighthouse = lhMod.default || lhMod;
  const result = await lighthouse(url, { port, logLevel: 'error' }, config);
  const categories = result.lhr.categories;
  const output = {};
  for (const [key, cat] of Object.entries(categories)) {
    output[key] = Math.round(cat.score * 100);
  }
  console.log(JSON.stringify(output));
})();
"""


def _check_node_deps() -> bool:
    """Check if lighthouse is available locally or in NODE_PATH."""
    result = subprocess.run(
        ["node", "-e", "import('lighthouse').catch(() => process.exit(1))"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return result.returncode == 0


def _find_free_port() -> int:
    """Find a free ephemeral localhost TCP port for Chrome CDP."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _run_lighthouse_via_cdp(target_url: str, cdp_port: int, preset: str) -> dict[str, int]:
    """Run lighthouse against a CDP endpoint."""
    escaped_url = json.dumps(target_url)
    with tempfile.NamedTemporaryFile(mode="w", suffix=".js", delete=False, encoding="utf-8") as f:
        f.write(LIGHTHOUSE_RUNNER_JS)
        js_path = f.name

    try:
        if _check_node_deps():
            cmd = ["node", js_path, escaped_url, str(cdp_port), preset]
        elif shutil.which("npx"):
            cmd = [
                "npx",
                "--yes",
                "-p",
                "lighthouse",
                "node",
                js_path,
                escaped_url,
                str(cdp_port),
                preset,
            ]
        else:
            rprint(
                "[red]Lighthouse Node package not found.[/red] "
                "Install it locally via `npm install --save-dev lighthouse`."
            )
            raise SystemExit(1)

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=120,
        )
        if result.returncode != 0:
            rprint(f"[red]Lighthouse failed:[/red] {result.stderr}")
            raise SystemExit(1)

        return json.loads(result.stdout.strip())
    finally:
        Path(js_path).unlink(missing_ok=True)


def _run_with_playwright(target_url: str, preset: str) -> dict[str, int]:
    """Launch real Chrome via Playwright, run Lighthouse against CDP."""
    from playwright.sync_api import sync_playwright

    cdp_port = _find_free_port()
    with sync_playwright() as p:
        browser = p.chromium.launch(
            channel="chrome",
            headless=True,
            args=[f"--remote-debugging-port={cdp_port}"],
        )

        try:
            scores = _run_lighthouse_via_cdp(target_url, cdp_port, preset)
        finally:
            browser.close()

    return scores


def _print_scores(scores: dict[str, int], preset: str, threshold: int) -> bool:
    """Print scores as a rich table. Returns True if all pass."""
    table = Table(title=f"Lighthouse — {preset}")
    table.add_column("Category")
    table.add_column("Score", justify="right")
    table.add_column("Status")

    all_pass = True
    for category, score in scores.items():
        status = "[green]✓ PASS[/green]" if score >= threshold else "[red]✗ FAIL[/red]"
        if score < threshold:
            all_pass = False
        color = "green" if score >= threshold else "red"
        table.add_row(category, f"[{color}]{score}[/{color}]", status)

    rprint(table)
    return all_pass


def main(
    url: str = typer.Argument(help="URL to audit"),
    threshold: int = typer.Option(100, "--threshold", "-t", help="Minimum passing score"),
    desktop_only: bool = typer.Option(False, "--desktop-only", help="Skip mobile audit"),
    mobile_only: bool = typer.Option(False, "--mobile-only", help="Skip desktop audit"),
) -> None:
    """Run Lighthouse audit via real Playwright Chrome."""
    if not _check_node_deps() and not shutil.which("npx"):
        rprint(
            "[red]Missing Node dependency 'lighthouse'.[/red] "
            "Install locally with: [bold]npm install --save-dev lighthouse[/bold]"
        )
        raise SystemExit(1)

    all_pass = True

    if not desktop_only:
        rprint(f"\n[bold]Auditing (mobile):[/bold] {url}")
        mobile_scores = _run_with_playwright(url, "mobile")
        if not _print_scores(mobile_scores, "Mobile", threshold):
            all_pass = False

    if not mobile_only:
        rprint(f"\n[bold]Auditing (desktop):[/bold] {url}")
        desktop_scores = _run_with_playwright(url, "desktop")
        if not _print_scores(desktop_scores, "Desktop", threshold):
            all_pass = False

    if all_pass:
        rprint("\n[green bold]✓ All categories passed![/green bold]")
    else:
        rprint(f"\n[red bold]✗ Some categories below {threshold}. Not done yet.[/red bold]")
        raise SystemExit(1)


if __name__ == "__main__":
    typer.run(main)
