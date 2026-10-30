import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const radarScript = join(root, "scripts", "upstream_radar.mjs");
const tuiScript = join(root, "scripts", "lazy_tui.mjs");
const binEntry = join(root, "bin", "lazyargon");

test("upstream_radar.mjs audit --json verifies all 20 sources and closure targets", () => {
	const res = spawnSync(process.execPath, [radarScript, "audit", "--json"], { encoding: "utf8" });
	assert.equal(res.status, 0, `stderr: ${res.stderr}`);
	const data = JSON.parse(res.stdout);
	assert.equal(data.schema, "skill_source_closure_audit/v1");
	assert.equal(data.ok, true);
	assert.equal(data.source_count, 20);
	assert.equal(data.missing_targets.length, 0);
	assert.ok(data.verified_targets >= 10);
});

test("upstream_radar.mjs audit negative path detects missing target and fails closed", () => {
	const tmp = mkdtempSync(join(tmpdir(), "radar-test-"));
	try {
		const badReceipts = join(tmp, "bad-receipts.json");
		writeFileSync(
			badReceipts,
			JSON.stringify({
				schema: "skill_source_closure_audit/v1",
				version: "1.0.0",
				updated_at: "2026-10-30T11:45:00Z",
				sources: [
					{
						repo: "example/missing-repo",
						url: "https://github.com/example/missing-repo",
						pinned_sha: "deadbeef",
						keyword: "missing",
						mapped_targets: ["scripts/does_not_exist_anywhere_999.mjs"],
					},
				],
			}),
		);
		const res = spawnSync(process.execPath, [radarScript, "audit", "--receipts", badReceipts, "--json"], { encoding: "utf8" });
		assert.equal(res.status, 1);
		const data = JSON.parse(res.stdout);
		assert.equal(data.ok, false);
		assert.ok(data.missing_targets.includes("scripts/does_not_exist_anywhere_999.mjs"));
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
});

test("upstream_radar.mjs poll --offline --json returns 20 pinned sources", () => {
	const res = spawnSync(process.execPath, [radarScript, "poll", "--offline", "--json"], { encoding: "utf8" });
	assert.equal(res.status, 0);
	const data = JSON.parse(res.stdout);
	assert.equal(data.mode, "offline");
	assert.equal(data.source_count, 20);
	assert.equal(data.drift_count, 0);
});

test("lazy_tui.mjs --once and --json render 4 panels with zero LLM calls", () => {
	const tmp = mkdtempSync(join(tmpdir(), "tui-test-"));
	try {
		const stateDir = join(tmp, ".lazyargon");
		mkdirSync(stateDir, { recursive: true });
		writeFileSync(
			join(stateDir, "ulw-dag.json"),
			JSON.stringify({ nodes: [{ id: "wave1", status: "verified" }, { id: "wave2", status: "running" }] }),
		);
		writeFileSync(join(stateDir, "pins.md"), "- [fact] hash: abc123\n- [fact] target: lazy_tui.mjs\n");
		writeFileSync(join(stateDir, "experiment-ledger.tsv"), "id\tname\tscore\n1\texp1\t0.72\n2\texp2\t0.91\n");

		const onceRes = spawnSync(process.execPath, [tuiScript, "--once", "--cwd", tmp], { encoding: "utf8" });
		assert.equal(onceRes.status, 0);
		assert.match(onceRes.stdout, /╭─/);
		assert.match(onceRes.stdout, /\[1\] HOST & RULES BUDGET/);
		assert.match(onceRes.stdout, /\[2\] DAG-ULW EXECUTION GRAPH/);
		assert.match(onceRes.stdout, /\[3\] MEM0 \+ LETTA \+ AUTORAG/);
		assert.match(onceRes.stdout, /\[4\] AUTORESEARCH & UPSTREAM RADAR/);
		assert.match(onceRes.stdout, /24,000B/);
		assert.match(onceRes.stdout, /20 sources tracked/);

		const jsonRes = spawnSync(process.execPath, [binEntry, "tui", "--json", "--cwd", tmp], { encoding: "utf8" });
		assert.equal(jsonRes.status, 0);
		const state = JSON.parse(jsonRes.stdout);
		assert.equal(state.llm_calls, 0);
		assert.equal(state.panels.dag_ulw.counts.verified, 1);
		assert.equal(state.panels.dag_ulw.counts.running, 1);
		assert.equal(state.panels.memory_rag.pins_count, 2);
		assert.equal(state.panels.autoresearch_radar.tracked_sources, 20);
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
});
