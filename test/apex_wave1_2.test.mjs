import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = {
	slop: join(PLUGIN_ROOT, "scripts", "lazy_slop_cleaner.mjs"),
	dag: join(PLUGIN_ROOT, "scripts", "dag_ulw.mjs"),
	codegraph: join(PLUGIN_ROOT, "scripts", "codegraph.mjs"),
	autoresearch: join(PLUGIN_ROOT, "scripts", "autoresearch_loop.mjs"),
};

function runCli(script, args = []) {
	const res = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
	let json = null;
	try {
		json = JSON.parse((res.stdout || "").trim());
	} catch {
		json = null;
	}
	return { status: res.status, stdout: res.stdout, stderr: res.stderr, json };
}

test("Wave 1-4: lazy_slop_cleaner.mjs rules-distill & ac-slop modes", () => {
	const tmp = mkdtempSync(join(tmpdir(), "lazyargon-slop-"));
	try {
		const rulesResult = runCli(SCRIPTS.slop, ["--mode", "rules-distill", "--target", PLUGIN_ROOT, "--json"]);
		assert.equal(rulesResult.status, 0);
		assert.equal(rulesResult.json.schema, "lazy_slop_audit/v1");
		assert.equal(rulesResult.json.mode, "rules-distill");
		assert.equal(rulesResult.json.within_budget, true);
		assert.ok(rulesResult.json.rules_total_bytes > 0 && rulesResult.json.rules_total_bytes <= 24000);

		const dirtyFile = join(tmp, "sample.mjs");
		writeFileSync(
			dirtyFile,
			[
				"// TODO: remove later",
				"// const oldVal = 42;",
				"var legacyFlag = true;",
				"const data1 = 123;",
				"try { doWork(); } catch (e) {}",
				"// 이 모듈은 혁신적인 그리고 심리스한 다면적인 아키텍처를 제공합니다. delve into details.",
			].join("\n"),
			"utf8",
		);
		const acRes = runCli(SCRIPTS.slop, ["--mode", "ac-slop", "--target", dirtyFile, "--json"]);
		assert.equal(acRes.status, 0);
		assert.equal(acRes.json.clean, false);
		const cats = new Set(acRes.json.findings.map((f) => f.category));
		assert.ok(cats.has("DEAD"));
		assert.ok(cats.has("NAMING"));
		assert.ok(cats.has("SIMPLIFY"));
		assert.ok(cats.has("MODERN"));
		assert.ok(cats.has("PROSE_SLOP"));
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
});

test("Wave 1-4: dag_ulw.mjs cycle check, write_scope conflict, 3-strike, evidence settle, prompt-pack", () => {
	const tmp = mkdtempSync(join(tmpdir(), "lazyargon-dag-"));
	const dagFile = join(tmp, "ulw-dag.json");
	try {
		// 1. Cycle detection -> exit 2
		const cyclicSpec = {
			goal: "Cyclic test",
			nodes: [
				{ id: "A", deps: ["B"], write_scope: ["src/a.mjs"] },
				{ id: "B", deps: ["A"], write_scope: ["src/b.mjs"] },
			],
		};
		const cycRes = runCli(SCRIPTS.dag, ["define", "--file", dagFile, "--spec", JSON.stringify(cyclicSpec)]);
		assert.equal(cycRes.status, 2);

		// 2. Node count > 48 -> exit 2
		const tooManyNodes = {
			goal: "Oversized",
			nodes: Array.from({ length: 49 }, (_, i) => ({ id: `N${i}`, deps: [], write_scope: [`src/f${i}.mjs`] })),
		};
		const capRes = runCli(SCRIPTS.dag, ["define", "--file", dagFile, "--spec", JSON.stringify(tooManyNodes)]);
		assert.equal(capRes.status, 2);

		// 3. Valid DAG with overlapping write_scope among ready candidates
		const validSpec = {
			goal: "Build Wave 1",
			budget: { lanes: 4, waves: 2 },
			nodes: [
				{ id: "n1", role: "Core", deps: [], write_scope: ["src/core"], verify_cmd: "npm test" },
				{ id: "n2", role: "SubCore", deps: [], write_scope: ["src/core/sub.mjs"], verify_cmd: "npm test" },
				{ id: "n3", role: "UI", deps: ["n1"], write_scope: ["src/ui"], verify_cmd: "npm test" },
			],
		};
		const defRes = runCli(SCRIPTS.dag, ["define", "--file", dagFile, "--spec", JSON.stringify(validSpec)]);
		assert.equal(defRes.status, 0);
		assert.equal(defRes.json.schema, "lazyargon_dag/v1");

		// Ready check serializes overlapping n2, or exits 2 under --strict-disjoint
		const readyRes = runCli(SCRIPTS.dag, ["ready", "--file", dagFile]);
		assert.equal(readyRes.status, 0);
		assert.deepEqual(readyRes.json.ready, ["n1"]);
		assert.deepEqual(readyRes.json.deferred, ["n2"]);
		assert.equal(readyRes.json.conflicts.length, 1);

		const strictRes = runCli(SCRIPTS.dag, ["ready", "--file", dagFile, "--strict-disjoint"]);
		assert.equal(strictRes.status, 2);

		// 4. Settle without evidence -> downgraded to reported_done
		const settleNoEv = runCli(SCRIPTS.dag, ["settle", "--file", dagFile, "--node", "n1", "--state", "verified"]);
		assert.equal(settleNoEv.status, 0);
		assert.equal(settleNoEv.json.downgraded, true);
		assert.equal(settleNoEv.json.node.state, "reported_done");

		// Settle with evidence -> verified
		const settleEv = runCli(SCRIPTS.dag, [
			"settle",
			"--file",
			dagFile,
			"--node",
			"n1",
			"--state",
			"verified",
			"--evidence",
			"node --test passed (12/12)",
		]);
		assert.equal(settleEv.status, 0);
		assert.equal(settleEv.json.node.state, "verified");

		// 5. 3-strike repair escalation
		assert.equal(runCli(SCRIPTS.dag, ["repair", "--file", dagFile, "--node", "n2"]).json.state, "running");
		assert.equal(runCli(SCRIPTS.dag, ["repair", "--file", dagFile, "--node", "n2"]).json.state, "running");
		const strike3 = runCli(SCRIPTS.dag, ["repair", "--file", dagFile, "--node", "n2"]);
		assert.equal(strike3.json.state, "ESCALATE_ARCHITECTURE");
		assert.equal(strike3.json.escalated, true);

		// 6. 4-Zone prompt pack
		const packRes = runCli(SCRIPTS.dag, ["prompt-pack", "--file", dagFile, "--node", "n3"]);
		assert.equal(packRes.status, 0);
		assert.ok(packRes.json.zones.zone1_shared_head.includes("lazyargon_dag/v1"));
		assert.ok(packRes.json.zones.zone2_unit.includes("src/ui"));
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
});

test("Wave 2-1: codegraph.mjs Personalized PageRank handoff & reverse-import test discovery", () => {
	const tmp = mkdtempSync(join(tmpdir(), "lazyargon-cg-"));
	try {
		mkdirSync(join(tmp, "src"), { recursive: true });
		mkdirSync(join(tmp, "test"), { recursive: true });
		writeFileSync(join(tmp, "src", "db.mjs"), "export function queryDb() { return []; }\n", "utf8");
		writeFileSync(
			join(tmp, "src", "service.mjs"),
			'import { queryDb } from "./db.mjs";\nexport function runService() { return queryDb(); }\n',
			"utf8",
		);
		writeFileSync(join(tmp, "src", "unrelated.mjs"), "export const UNUSED = 1;\n", "utf8");
		writeFileSync(
			join(tmp, "test", "service.test.mjs"),
			'import { runService } from "../src/service.mjs";\nrunService();\n',
			"utf8",
		);

		const handoff = runCli(SCRIPTS.codegraph, ["handoff", "--root", tmp, "--seeds", "src/db.mjs", "--top", "4"]);
		assert.equal(handoff.status, 0);
		assert.equal(handoff.json.ranked[0].file, "src/db.mjs");
		const topFiles = handoff.json.ranked.map((r) => r.file);
		assert.ok(topFiles.indexOf("src/service.mjs") < topFiles.indexOf("src/unrelated.mjs"));

		const impacted = runCli(SCRIPTS.codegraph, ["tests", "--root", tmp, "--changed", "src/db.mjs"]);
		assert.equal(impacted.status, 0);
		assert.deepEqual(impacted.json.tests, ["test/service.test.mjs"]);
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
});

test("Wave 2-3: autoresearch_loop.mjs immutable harness lock, KEEP/DISCARD, 4-rung idea ladder", () => {
	const tmp = mkdtempSync(join(tmpdir(), "lazyargon-ar-"));
	const ledger = join(tmp, "experiment-ledger.tsv");
	const evalScript = join(tmp, "eval.mjs");
	try {
		writeFileSync(evalScript, "console.log(100);\n", "utf8");
		const initRes = runCli(SCRIPTS.autoresearch, [
			"init",
			"--ledger",
			ledger,
			"--eval-script",
			evalScript,
			"--direction",
			"min",
		]);
		assert.equal(initRes.status, 0);
		assert.equal(initRes.json.lock.harness_mutable, false);

		const step1 = runCli(SCRIPTS.autoresearch, ["step", "--ledger", ledger, "--metric", "50.0", "--hypothesis", "baseline run"]);
		assert.equal(step1.json.verdict, "KEEP");
		assert.equal(step1.json.best_metric, 50);

		const step2 = runCli(SCRIPTS.autoresearch, ["step", "--ledger", ledger, "--metric", "55.0", "--hypothesis", "regressed change"]);
		assert.equal(step2.json.verdict, "DISCARD");
		assert.equal(step2.json.best_metric, 50);
		assert.ok(step2.json.idea_ladder.rung.includes("Rung 1"));

		writeFileSync(evalScript, "console.log(1); // rigged\n", "utf8");
		const mutated = runCli(SCRIPTS.autoresearch, ["step", "--ledger", ledger, "--metric", "10.0", "--hypothesis", "rigged eval"]);
		assert.equal(mutated.status, 2);
		assert.equal(mutated.json.status, "ABORT_MUTATED_HARNESS");
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
});
