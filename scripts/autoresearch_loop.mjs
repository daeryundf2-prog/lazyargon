#!/usr/bin/env node
/**
 * autoresearch_loop.mjs — Immutable-Harness Measured Optimization Loop (v2.0 Wave 2-3)
 * Inspired by karpathy/autoresearch + OMH Measured Loop Discipline
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TSV_HEADER = "iter\tcommit\tmetric\tdelta\tverdict\thypothesis";

const IDEA_LADDER = [
	{ stall: 1, rung: "Rung 1 (Local Parameter/Constant Tuning)", advice: "Adjust threshold, batch size, or local heuristic weight without changing interfaces." },
	{ stall: 2, rung: "Rung 2 (Data Structure / Representation Swap)", advice: "Replace linear scan with hash/index lookup or precompute hot invariant." },
	{ stall: 3, rung: "Rung 3 (Algorithmic / Pipeline Simplification)", advice: "Delete redundant pass, fuse stages, or invert control flow." },
	{ stall: 4, rung: "Rung 4 (Orthogonal Architecture Pivot / Stop)", advice: "3+ consecutive discards: question root assumption, consult second oracle, or halt loop." },
];

export function sha256File(filePath) {
	const raw = readFileSync(resolve(filePath));
	return createHash("sha256").update(raw).digest("hex");
}

function getShortCommit() {
	const res = spawnSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" });
	return !res.error && res.status === 0 ? (res.stdout || "").trim() || "working" : "working";
}

function resolveLockPath(ledgerPath) {
	return join(dirname(resolve(ledgerPath)), "experiment-lock.json");
}

export function initExperiment({ ledgerPath = ".lazyargon/experiment-ledger.tsv", evalScript, direction = "min" }) {
	if (!evalScript || !existsSync(evalScript)) {
		return { ok: false, code: 2, error: `Evaluation script not found: ${evalScript}` };
	}
	const absEval = resolve(evalScript);
	const evalSha256 = sha256File(absEval);
	const lockPath = resolveLockPath(ledgerPath);
	mkdirSync(dirname(resolve(ledgerPath)), { recursive: true });
	const lockData = {
		schema: "lazyargon_experiment_lock/v1",
		eval_script: absEval,
		eval_sha256: evalSha256,
		direction: direction === "max" ? "max" : "min",
		harness_mutable: false,
		best_metric: null,
		stall_count: 0,
	};
	writeFileSync(lockPath, `${JSON.stringify(lockData, null, 2)}\n`, "utf8");
	writeFileSync(resolve(ledgerPath), `${TSV_HEADER}\n`, "utf8");
	return { ok: true, lock_path: lockPath, ledger_path: resolve(ledgerPath), lock: lockData };
}

export function stepExperiment({
	ledgerPath = ".lazyargon/experiment-ledger.tsv",
	evalScript,
	metric,
	direction,
	hypothesis = "experiment step",
}) {
	const lockPath = resolveLockPath(ledgerPath);
	if (!existsSync(lockPath)) {
		return { ok: false, code: 2, status: "LOCK_MISSING", error: `Experiment lock not found at ${lockPath}` };
	}
	const lock = JSON.parse(readFileSync(lockPath, "utf8"));
	const targetEval = evalScript ? resolve(evalScript) : lock.eval_script;
	if (!existsSync(targetEval)) {
		return { ok: false, code: 2, status: "ABORT_MUTATED_HARNESS", error: "Evaluation script missing" };
	}
	const currentSha = sha256File(targetEval);
	if (currentSha !== lock.eval_sha256) {
		return {
			ok: false,
			code: 2,
			status: "ABORT_MUTATED_HARNESS",
			error: `Immutable harness violation: expected ${lock.eval_sha256}, got ${currentSha}`,
		};
	}

	const numMetric = Number(metric);
	if (!Number.isFinite(numMetric)) {
		return { ok: false, code: 2, error: `Invalid numeric metric: ${metric}` };
	}
	const dir = direction || lock.direction || "min";
	const prevBest = lock.best_metric;
	const improved = prevBest === null || (dir === "min" ? numMetric < prevBest : numMetric > prevBest);
	const delta = prevBest === null ? 0 : Number((numMetric - prevBest).toFixed(6));
	const verdict = improved ? "KEEP" : "DISCARD";

	if (improved) {
		lock.best_metric = numMetric;
		lock.stall_count = 0;
	} else {
		lock.stall_count = (lock.stall_count || 0) + 1;
	}
	writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");

	const existingLines = existsSync(ledgerPath)
		? readFileSync(ledgerPath, "utf8").trim().split(/\r?\n/)
		: [TSV_HEADER];
	const iter = Math.max(1, existingLines.length);
	const commit = getShortCommit();
	const cleanHyp = String(hypothesis).replace(/[\t\r\n]+/g, " ").trim();
	const row = `${iter}\t${commit}\t${numMetric}\t${delta >= 0 ? `+${delta}` : delta}\t${verdict}\t${cleanHyp}`;
	writeFileSync(resolve(ledgerPath), `${existingLines.join("\n")}\n${row}\n`, "utf8");

	const ladderEntry =
		lock.stall_count > 0 ? IDEA_LADDER[Math.min(lock.stall_count, IDEA_LADDER.length) - 1] : null;
	const summary_line = `[ITER ${iter}] verdict=${verdict} metric=${numMetric} best=${lock.best_metric} delta=${delta} (${cleanHyp})`;

	return {
		ok: true,
		iter,
		commit,
		metric: numMetric,
		best_metric: lock.best_metric,
		delta,
		verdict,
		stall_count: lock.stall_count,
		idea_ladder: ladderEntry,
		summary_line,
	};
}

export function statusExperiment(ledgerPath = ".lazyargon/experiment-ledger.tsv") {
	const lockPath = resolveLockPath(ledgerPath);
	const lock = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, "utf8")) : null;
	const rows = existsSync(ledgerPath) ? readFileSync(ledgerPath, "utf8").trim().split(/\r?\n/).slice(1) : [];
	return { ok: true, lock, total_iterations: rows.length, recent: rows.slice(-5) };
}

function main() {
	const args = process.argv.slice(2);
	const cmd = args[0] || "status";
	const getOpt = (f, d = "") => {
		const i = args.indexOf(f);
		return i >= 0 && args[i + 1] ? args[i + 1] : d;
	};
	const ledgerPath = getOpt("--ledger", ".lazyargon/experiment-ledger.tsv");
	if (cmd === "init") {
		const res = initExperiment({
			ledgerPath,
			evalScript: getOpt("--eval-script"),
			direction: getOpt("--direction", "min"),
		});
		console.log(JSON.stringify(res, null, 2));
		if (!res.ok) process.exit(res.code || 2);
	} else if (cmd === "step") {
		const res = stepExperiment({
			ledgerPath,
			evalScript: getOpt("--eval-script"),
			metric: getOpt("--metric"),
			direction: getOpt("--direction"),
			hypothesis: getOpt("--hypothesis", "experiment step"),
		});
		console.log(JSON.stringify(res, null, 2));
		if (!res.ok) process.exit(res.code || 2);
	} else {
		console.log(JSON.stringify(statusExperiment(ledgerPath), null, 2));
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main();
}
