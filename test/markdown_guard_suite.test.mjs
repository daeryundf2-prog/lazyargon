import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The owner's 07:00 daily-sync runs this guard over skills/; run it in the suite so a broken table or
// truncated cell from an upstream sync fails here first (PR #17 slipped one through on 2026-11-15).
test("every Markdown file under skills/ passes the structure guard", () => {
	const res = spawnSync(process.execPath, [path.join(ROOT, "scripts", "markdown_structure_guard.mjs"), "--check", "skills"], { cwd: ROOT, encoding: "utf8" });
	assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
});
