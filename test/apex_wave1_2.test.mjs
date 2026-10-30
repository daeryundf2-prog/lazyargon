import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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
		assert.equal(rulesResult.json.rules_total_bytes, 20328);

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

		// [SLOP-2] --strict returns exit 1 when clean === false
		const strictRes = runCli(SCRIPTS.slop, ["--mode", "ac-slop", "--target", dirtyFile, "--strict"]);
		assert.equal(strictRes.status, 1);

		// [SLOP-2] --trajectory extracts lessons with { cue, lesson, evidence }
		const trajFile = join(tmp, "transcript.jsonl");
		writeFileSync(
			trajFile,
			[
				JSON.stringify({ step_index: 1, status: "ERROR", tool: "run_command", content: "Error: command failed exit 2" }),
				JSON.stringify({ step_index: 2, status: "DONE", tool: "run_command", content: "Retried run_command after failure" }),
			].join("\n"),
			"utf8",
		);
		const trajRes = runCli(SCRIPTS.slop, ["--trajectory", trajFile]);
		assert.equal(trajRes.status, 0);
		assert.equal(trajRes.json.schema, "lazy_trajectory_distill/v1");
		assert.ok(trajRes.json.lessons.length >= 2);
		assert.ok(trajRes.json.lessons[0].cue && trajRes.json.lessons[0].lesson && trajRes.json.lessons[0].evidence);

		// [SLOP-2] --diff-only scans only added + lines from git diff -U0
		const gitDir = join(tmp, "repo");
		mkdirSync(gitDir, { recursive: true });
		spawnSync("git", ["init"], { cwd: gitDir });
		spawnSync("git", ["config", "user.email", "test@example.com"], { cwd: gitDir });
		spawnSync("git", ["config", "user.name", "Test"], { cwd: gitDir });
		const repoFile = join(gitDir, "mod.mjs");
		writeFileSync(repoFile, "// TODO: legacy committed line\nexport const cleanVal = 1;\n", "utf8");
		spawnSync("git", ["add", "."], { cwd: gitDir });
		spawnSync("git", ["commit", "-m", "init"], { cwd: gitDir });
		writeFileSync(repoFile, "// TODO: legacy committed line\nexport const cleanVal = 1;\nexport const nextVal = 2;\n", "utf8");
		const diffClean = runCli(SCRIPTS.slop, ["--mode", "code", "--target", repoFile, "--diff-only"]);
		assert.equal(diffClean.json.clean, true);
		writeFileSync(repoFile, "// TODO: legacy committed line\nexport const cleanVal = 1;\nvar badAdded = 3;\n", "utf8");
		const diffDirty = runCli(SCRIPTS.slop, ["--mode", "code", "--target", repoFile, "--diff-only"]);
		assert.equal(diffDirty.json.clean, false);
		assert.equal(diffDirty.json.findings.length, 1);
		assert.equal(diffDirty.json.findings[0].id, "LEGACY_VAR");
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

		// [DAG-1], [DAG-2], [DAG-3] glob/posix normalization, unverified dep guard, running lane/scope deduction
		const advDagFile = join(tmp, "adv-dag.json");
		const advSpec = {
			goal: "Advanced DAG guards",
			budget: { lanes: 2, waves: 2 },
			nodes: [
				{ id: "r1", deps: [], write_scope: ["./scripts/../scripts/*.mjs"], state: "running" },
				{ id: "c1", deps: [], write_scope: ["scripts/a.mjs"] },
				{ id: "c2", deps: [], write_scope: ["scripts/**"] },
				{ id: "c3", deps: [], write_scope: ["docs/guide.md"] },
				{ id: "c4", deps: [], write_scope: ["test/unit.mjs"] },
				{ id: "depChild", deps: ["c3"], write_scope: ["out/res.json"] },
			],
		};
		const advDef = runCli(SCRIPTS.dag, ["define", "--file", advDagFile, "--spec", JSON.stringify(advSpec)]);
		assert.equal(advDef.status, 0);
		assert.deepEqual(advDef.json.nodes[0].write_scope, ["scripts/*.mjs"]);

		// [DAG-2] settle depChild before c3 is verified -> UNVERIFIED_DEPENDENCY (exit 2)
		const prematureSettle = runCli(SCRIPTS.dag, [
			"settle",
			"--file",
			advDagFile,
			"--node",
			"depChild",
			"--state",
			"verified",
			"--evidence",
			"premature",
		]);
		assert.equal(prematureSettle.status, 2);
		assert.equal(prematureSettle.json.error, "UNVERIFIED_DEPENDENCY");

		// [DAG-3] r1 is running (1 of 2 lanes used), c1 & c2 conflict with r1's glob, so only c3 fits in remaining 1 lane
		const advReady = runCli(SCRIPTS.dag, ["ready", "--file", advDagFile]);
		assert.equal(advReady.status, 0);
		assert.equal(advReady.json.available_lanes, 1);
		assert.deepEqual(advReady.json.ready, ["c3"]);
		assert.deepEqual(advReady.json.deferred_conflicts, ["c1", "c2"]);
		assert.ok(advReady.json.deferred.includes("c4"));
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
		// [CG-3] Commented-out imports/exports must be ignored
		writeFileSync(
			join(tmp, "src", "unrelated.mjs"),
			'/* import { queryDb } from "./db.mjs"; */\n// import { runService } from "./service.mjs";\nexport const UNUSED = 1;\n',
			"utf8",
		);
		writeFileSync(
			join(tmp, "test", "service.test.mjs"),
			'import { runService } from "../src/service.mjs";\nrunService();\n',
			"utf8",
		);

		const built = runCli(SCRIPTS.codegraph, ["build", "--root", tmp]);
		assert.deepEqual(built.json.nodes["src/unrelated.mjs"].imports_internal, []);

		// [CG-2] Normalize absolute path and ./ relative path in handoff & tests
		const handoff = runCli(SCRIPTS.codegraph, ["handoff", "--root", tmp, "--seeds", join(tmp, "src", "db.mjs"), "--top", "4"]);
		assert.equal(handoff.status, 0);
		assert.equal(handoff.json.ranked[0].file, "src/db.mjs");
		const topFiles = handoff.json.ranked.map((r) => r.file);
		assert.ok(topFiles.indexOf("src/service.mjs") < topFiles.indexOf("src/unrelated.mjs"));

		const impacted = runCli(SCRIPTS.codegraph, ["tests", "--root", tmp, "--changed", "./src/db.mjs"]);
		assert.equal(impacted.status, 0);
		assert.deepEqual(impacted.json.tests, ["test/service.test.mjs"]);

		// [CG-1] tests --changed without argument auto-detects from git diff
		spawnSync("git", ["init"], { cwd: tmp });
		spawnSync("git", ["config", "user.email", "test@example.com"], { cwd: tmp });
		spawnSync("git", ["config", "user.name", "Test"], { cwd: tmp });
		spawnSync("git", ["add", "."], { cwd: tmp });
		spawnSync("git", ["commit", "-m", "init"], { cwd: tmp });
		writeFileSync(join(tmp, "src", "db.mjs"), "export function queryDb() { return [1]; }\n", "utf8");
		const autoImpacted = runCli(SCRIPTS.codegraph, ["tests", "--changed", "--root", tmp]);
		assert.equal(autoImpacted.status, 0);
		assert.deepEqual(autoImpacted.json.tests, ["test/service.test.mjs"]);
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
});

test("Wave 2-3: autoresearch_loop.mjs immutable harness lock, KEEP/DISCARD, 4-rung idea ladder", () => {
	const tmp = mkdtempSync(join(tmpdir(), "lazyargon-ar-"));
	const ledger = join(tmp, "experiment-ledger.tsv");
	const evalScript = join(tmp, "eval.mjs");
	const targetCode = join(tmp, "algo.mjs");
	try {
		writeFileSync(evalScript, "console.log(100);\n", "utf8");
		writeFileSync(targetCode, "export const WEIGHT = 1;\n", "utf8");
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

		// [AR-1] --metric-cmd executes command, writes experiment-last.log, and parses last scalar
		const step1 = runCli(SCRIPTS.autoresearch, [
			"step",
			"--ledger",
			ledger,
			"--metric-cmd",
			`${process.execPath} -e "console.log('booting...'); console.log('score: 50.0')"`,
			"--hypothesis",
			"baseline run",
		]);
		assert.equal(step1.json.verdict, "KEEP");
		assert.equal(step1.json.best_metric, 50);
		assert.ok(existsSync(join(tmp, ".lazyargon", "experiment-last.log")));

		// [AR-2] DISCARD with --rollback-files restores file and sets rolled_back: true
		writeFileSync(targetCode, "export const WEIGHT = 999; // bad experiment\n", "utf8");
		const step2 = runCli(SCRIPTS.autoresearch, [
			"step",
			"--ledger",
			ledger,
			"--metric",
			"55.0",
			"--rollback-files",
			targetCode,
			"--hypothesis",
			"regressed change",
		]);
		assert.equal(step2.json.verdict, "DISCARD");
		assert.equal(step2.json.rolled_back, true);
		assert.equal(readFileSync(targetCode, "utf8"), "export const WEIGHT = 1;\n");
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

function runCliAsync(script, args = []) {
	return new Promise((resolvePromise) => {
		const child = spawn(process.execPath, [script, ...args], { stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (d) => { stdout += d.toString(); });
		child.stderr.on("data", (d) => { stderr += d.toString(); });
		child.on("close", (status) => {
			let json = null;
			try { json = JSON.parse((stdout || stderr).trim()); } catch {}
			resolvePromise({ status, stdout, stderr, json });
		});
	});
}

test("Pass 3 Regression: dag_ulw.mjs 10-way parallel settle, define boundary exit 2, codegraph broken symlink, autoresearch 10-way parallel step & failed rollback", async () => {
	const tmp = mkdtempSync(join(tmpdir(), "lazyargon-p3-"));
	try {
		// 1. dag_ulw define missing --spec and missing file -> exit 2 JSON error
		const missingDef = runCli(SCRIPTS.dag, ["define", "--file", join(tmp, "nonexistent.json")]);
		assert.equal(missingDef.status, 2);
		assert.equal(JSON.parse(missingDef.stderr.trim()).ok, false);

		// 2. dag_ulw 10-way parallel settle preserves all 10 verified states
		const parDagFile = join(tmp, "par-dag.json");
		const nodes = Array.from({ length: 10 }, (_, i) => ({ id: `n${i}`, deps: [], write_scope: [`src/f${i}.mjs`] }));
		assert.equal(runCli(SCRIPTS.dag, ["define", "--file", parDagFile, "--spec", JSON.stringify({ goal: "Par", nodes })]).status, 0);
		await Promise.all(
			nodes.map((n) => runCliAsync(SCRIPTS.dag, ["settle", "--file", parDagFile, "--node", n.id, "--state", "verified", "--evidence", `pass-${n.id}`])),
		);
		const finalDag = JSON.parse(readFileSync(parDagFile, "utf8"));
		assert.equal(finalDag.nodes.filter((n) => n.state === "verified").length, 10);

		// 3. codegraph broken symlink ignored cleanly & build --out atomic write
		const cgDir = join(tmp, "cg");
		mkdirSync(cgDir, { recursive: true });
		writeFileSync(join(cgDir, "ok.mjs"), "export const a = 1;\n", "utf8");
		symlinkSync(join(cgDir, "missing-target.mjs"), join(cgDir, "broken-link.mjs"));
		const cgOut = join(tmp, "cg-out.json");
		const cgRes = runCli(SCRIPTS.codegraph, ["build", "--root", cgDir, "--out", cgOut]);
		assert.equal(cgRes.status, 0);
		assert.ok(cgRes.json.nodes["ok.mjs"]);
		assert.equal(cgRes.json.nodes["broken-link.mjs"], undefined);
		assert.ok(existsSync(cgOut));

		// 4. autoresearch_loop 10-way parallel step preserves all 11 TSV lines + failed rollbackCmd -> rolled_back: false
		const arDir = join(tmp, "ar");
		mkdirSync(arDir, { recursive: true });
		const evalFile = join(arDir, "eval.mjs");
		const ledgerFile = join(arDir, "experiment-ledger.tsv");
		writeFileSync(evalFile, "console.log(100);\n", "utf8");
		assert.equal(runCli(SCRIPTS.autoresearch, ["init", "--ledger", ledgerFile, "--eval-script", evalFile]).status, 0);
		await Promise.all(
			Array.from({ length: 10 }, (_, i) =>
				runCliAsync(SCRIPTS.autoresearch, ["step", "--ledger", ledgerFile, "--metric", String(100 - i), "--hypothesis", `p${i}`]),
			),
		);
		const tsvLines = readFileSync(ledgerFile, "utf8").trim().split(/\r?\n/);
		assert.equal(tsvLines.length, 11);

		const failRb = runCli(SCRIPTS.autoresearch, [
			"step",
			"--ledger",
			ledgerFile,
			"--metric",
			"999",
			"--rollback-cmd",
			`${process.execPath} -e "process.exit(1)"`,
			"--hypothesis",
			"failed rollback",
		]);
		assert.equal(failRb.status, 0);
		assert.equal(failRb.json.verdict, "DISCARD");
		assert.equal(failRb.json.rolled_back, false);
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
});
