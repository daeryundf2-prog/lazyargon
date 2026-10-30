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

test("upstream_radar.mjs audit --json verifies all 32 sources and closure targets", () => {
	const res = spawnSync(process.execPath, [radarScript, "audit", "--json"], { encoding: "utf8" });
	assert.equal(res.status, 0, `stderr: ${res.stderr}`);
	const data = JSON.parse(res.stdout);
	assert.equal(data.schema, "skill_source_closure_audit/v1");
	assert.equal(data.ok, true);
	assert.equal(data.source_count, 32);
	assert.equal(data.missing_targets.length, 0);
	assert.ok(data.verified_targets >= 15);
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

test("upstream_radar.mjs poll --offline --json returns 32 pinned sources", () => {
	const res = spawnSync(process.execPath, [radarScript, "poll", "--offline", "--json"], { encoding: "utf8" });
	assert.equal(res.status, 0);
	const data = JSON.parse(res.stdout);
	assert.equal(data.mode, "offline");
	assert.equal(data.source_count, 32);
	assert.equal(data.drift_count, 0);
});

test("lazy_tui.mjs --once and --json render 4 panels with real memory.db stats, KEEP/DISCARD counts, and 0-runs sparkline", () => {
	const tmp = mkdtempSync(join(tmpdir(), "tui-test-"));
	try {
		const emptyRes = spawnSync(process.execPath, [tuiScript, "--once", "--cwd", tmp], { encoding: "utf8" });
		assert.equal(emptyRes.status, 0);
		assert.match(emptyRes.stdout, /─ \(0 runs\)/);

		const stateDir = join(tmp, ".lazyargon");
		mkdirSync(stateDir, { recursive: true });
		const dbPath = join(stateDir, "memory.db");
		const memScript = join(root, "scripts", "lazy_memory.py");
		spawnSync("python3", [memScript, "resolve", "--db", dbPath, "--op", "ADD", "--subject", "lazyargon", "--predicate", "uses", "--object", "argon4"], { encoding: "utf8" });
		spawnSync("python3", [memScript, "resolve", "--db", dbPath, "--op", "UPDATE", "--subject", "lazyargon", "--predicate", "uses", "--object", "argon4-high"], { encoding: "utf8" });

		writeFileSync(
			join(stateDir, "ulw-dag.json"),
			JSON.stringify({ nodes: [{ id: "wave1", state: "verified" }, { id: "wave2", status: "running" }, { id: "wave3", state: "reported_done" }] }),
		);
		writeFileSync(join(stateDir, "pins.md"), "- [fact] hash: abc123\n- [fact] target: lazy_tui.mjs\n");
		writeFileSync(
			join(stateDir, "experiment-ledger.tsv"),
			"iter\tcommit\tmetric\tdelta\tverdict\thypothesis\n1\tabc1234\t0.72\t0\tKEEP\tinit\n2\tdef5678\t0.91\t+0.19\tDISCARD\ttry2\n",
		);

		const onceRes = spawnSync(process.execPath, [tuiScript, "--once", "--cwd", tmp], { encoding: "utf8" });
		assert.equal(onceRes.status, 0);
		assert.match(onceRes.stdout, /╭─/);
		assert.match(onceRes.stdout, /\[1\] HOST & RULES BUDGET/);
		assert.match(onceRes.stdout, /\[2\] DAG-ULW EXECUTION GRAPH/);
		assert.match(onceRes.stdout, /\[3\] MEM0 \+ LETTA \+ AUTORAG/);
		assert.match(onceRes.stdout, /Active: 1 \| Superseded: 1 \| Edges: 1 \| Dreams: 0 \| Pins: 2개/);
		assert.match(onceRes.stdout, /\[4\] AUTORESEARCH & UPSTREAM RADAR/);
		assert.match(onceRes.stdout, /Runs: 2 \(KEEP: 1 \/ DISCARD: 1\)/);
		assert.match(onceRes.stdout, /32 sources tracked/);

		const jsonRes = spawnSync(process.execPath, [binEntry, "tui", "--json", "--cwd", tmp], { encoding: "utf8" });
		assert.equal(jsonRes.status, 0);
		const state = JSON.parse(jsonRes.stdout);
		assert.equal(state.llm_calls, 0);
		assert.equal(state.panels.dag_ulw.counts.verified, 1);
		assert.equal(state.panels.dag_ulw.counts.running, 1);
		assert.equal(state.panels.dag_ulw.counts.reported_done, 1);
		assert.equal(state.panels.memory_rag.active, 1);
		assert.equal(state.panels.memory_rag.superseded, 1);
		assert.equal(state.panels.memory_rag.edges, 1);
		assert.equal(state.panels.memory_rag.pins_count, 2);
		assert.equal(state.panels.autoresearch_radar.keep_count, 1);
		assert.equal(state.panels.autoresearch_radar.discard_count, 1);
		assert.equal(state.panels.autoresearch_radar.best_metric, 0.72);
		assert.equal(state.panels.autoresearch_radar.tracked_sources, 32);
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
});

test("bin/lazyargon routes all 11 subcommands and exits with code 2 on unknown subcommand", () => {
	const tmp = mkdtempSync(join(tmpdir(), "bin-route-"));
	try {
		const validFile = join(tmp, "ok.mjs");
		writeFileSync(validFile, "export const ok = 1;\n", "utf8");
		const dbPath = join(tmp, "mem.db");
		const dagFile = join(tmp, "dag.json");
		writeFileSync(dagFile, JSON.stringify({ schema: "lazyargon_dag_ulw/v1", goal: "test", budget: { lanes: 1, waves: 1 }, nodes: [] }), "utf8");

		const checks = [
			["tui", "--json", "--cwd", tmp],
			["doctor", "--json"],
			["radar", "audit", "--json"],
			["upstream", "list", "--json"],
			["dag", "status", "--file", dagFile],
			["codegraph", "build", "--root", tmp],
			["memory", "stats", "--db", dbPath, "--json"],
			["rag", "budget", "--mode", "direct", "--json"],
			["slop", "--mode", "prose", "--files", validFile, "--json"],
			["lsp", "check", "--files", validFile, "--root", tmp, "--json"],
			["calibrate", "--model", "gemini-4-argon", "--json"],
			["autoresearch", "status", "--ledger", join(tmp, "ledger.tsv")],
		];

		for (const args of checks) {
			const res = spawnSync(process.execPath, [binEntry, ...args], { encoding: "utf8" });
			if (args[0] === "doctor") {
				assert.ok(res.status === 0 || res.status === 1, `Subcommand doctor failed with status ${res.status}: ${res.stderr}`);
				assert.ok(Array.isArray(JSON.parse(res.stdout).checks));
			} else {
				assert.equal(res.status, 0, `Subcommand ${args[0]} failed with status ${res.status}: ${res.stderr}`);
			}
		}

		const bad = spawnSync(process.execPath, [binEntry, "unknown-subcmd-xyz"], { encoding: "utf8" });
		assert.equal(bad.status, 2);
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
});
