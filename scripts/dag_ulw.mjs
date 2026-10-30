#!/usr/bin/env node
/**
 * dag_ulw.mjs — Explicit DAG Orchestration & Disjoint Write-Scope Enforcer (v2.0 Wave 1-4)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_NODES = 48;
const VALID_STATES = new Set(["not_run", "running", "reported_done", "verified", "failed", "ESCALATE_ARCHITECTURE"]);

function normalizeScope(p) {
	return String(p || "").replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

export function scopesOverlap(scopeA = [], scopeB = []) {
	for (const rawA of scopeA) {
		const a = normalizeScope(rawA);
		if (!a) continue;
		for (const rawB of scopeB) {
			const b = normalizeScope(rawB);
			if (!b) continue;
			if (a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`)) return true;
		}
	}
	return false;
}

export function detectCycleKahn(nodes) {
	const inDeg = new Map();
	const adj = new Map();
	for (const n of nodes) {
		inDeg.set(n.id, 0);
		adj.set(n.id, []);
	}
	for (const n of nodes) {
		for (const d of n.deps || []) {
			if (!adj.has(d)) throw new Error(`Unknown dependency '${d}' in node '${n.id}'`);
			adj.get(d).push(n.id);
			inDeg.set(n.id, (inDeg.get(n.id) || 0) + 1);
		}
	}
	const queue = [];
	for (const [id, deg] of inDeg.entries()) {
		if (deg === 0) queue.push(id);
	}
	let visited = 0;
	while (queue.length > 0) {
		const cur = queue.shift();
		visited += 1;
		for (const nxt of adj.get(cur) || []) {
			inDeg.set(nxt, inDeg.get(nxt) - 1);
			if (inDeg.get(nxt) === 0) queue.push(nxt);
		}
	}
	return visited !== nodes.length;
}

export function validateAndNormalizeDag(spec) {
	if (!spec || typeof spec !== "object") return { ok: false, code: 2, error: "Invalid DAG spec" };
	const nodes = Array.isArray(spec.nodes) ? spec.nodes : [];
	if (nodes.length === 0 || nodes.length > MAX_NODES) {
		return { ok: false, code: 2, error: `Node count ${nodes.length} violates cap (1..${MAX_NODES})` };
	}
	const ids = new Set();
	const normalizedNodes = [];
	for (const n of nodes) {
		if (!n.id || ids.has(n.id)) return { ok: false, code: 2, error: `Duplicate or missing node id: ${n.id}` };
		ids.add(n.id);
		const st = n.state || "not_run";
		if (!VALID_STATES.has(st)) return { ok: false, code: 2, error: `Invalid state: ${st}` };
		normalizedNodes.push({
			id: String(n.id),
			role: String(n.role || n.id),
			model: String(n.model || "inherit"),
			deps: Array.isArray(n.deps) ? n.deps.map(String) : [],
			write_scope: Array.isArray(n.write_scope) ? n.write_scope.map(String) : [],
			verify_cmd: String(n.verify_cmd || ""),
			state: st,
			repairs: Number.isInteger(n.repairs) ? n.repairs : 0,
			extensions: Number.isInteger(n.extensions) ? n.extensions : 0,
			evidence: n.evidence ?? null,
		});
	}
	try {
		if (detectCycleKahn(normalizedNodes)) {
			return { ok: false, code: 2, error: "Cycle detected in DAG (Kahn topological check failed)" };
		}
	} catch (err) {
		return { ok: false, code: 2, error: err.message };
	}
	return {
		ok: true,
		dag: {
			schema: "lazyargon_dag/v1",
			goal: String(spec.goal || "ULW Task"),
			budget: {
				lanes: Number(spec.budget?.lanes) || 4,
				waves: Number(spec.budget?.waves) || 2,
			},
			nodes: normalizedNodes,
		},
	};
}

export function computeReadyBatch(dag, strictDisjoint = false) {
	const stateMap = new Map(dag.nodes.map((n) => [n.id, n.state]));
	const candidates = dag.nodes.filter(
		(n) => n.state === "not_run" && (n.deps || []).every((d) => stateMap.get(d) === "verified"),
	);
	const selected = [];
	const deferred = [];
	const conflicts = [];
	for (const cand of candidates) {
		const hit = selected.find((sel) => scopesOverlap(cand.write_scope, sel.write_scope));
		if (hit) {
			conflicts.push({ node: cand.id, conflicts_with: hit.id, write_scope: cand.write_scope });
			deferred.push(cand.id);
		} else if (selected.length < (dag.budget?.lanes || 4)) {
			selected.push(cand);
		} else {
			deferred.push(cand.id);
		}
	}
	if (strictDisjoint && conflicts.length > 0) {
		return { ok: false, code: 2, error: "Disjoint write_scope violation among ready nodes", conflicts };
	}
	return { ok: true, ready: selected.map((n) => n.id), deferred, conflicts };
}

export function applySettle(dag, nodeId, targetState, evidence) {
	const node = dag.nodes.find((n) => n.id === nodeId);
	if (!node) return { ok: false, code: 2, error: `Node '${nodeId}' not found` };
	const cleanEv = typeof evidence === "string" ? evidence.trim() : "";
	if (targetState === "verified" && !cleanEv) {
		node.state = "reported_done";
		return { ok: true, downgraded: true, node, note: "Missing empirical evidence; state capped at reported_done" };
	}
	node.state = targetState;
	if (cleanEv) node.evidence = cleanEv;
	return { ok: true, downgraded: false, node };
}

export function applyRepair(dag, nodeId) {
	const node = dag.nodes.find((n) => n.id === nodeId);
	if (!node) return { ok: false, code: 2, error: `Node '${nodeId}' not found` };
	node.repairs = (node.repairs || 0) + 1;
	if (node.repairs > 2) {
		node.state = "ESCALATE_ARCHITECTURE";
		return { ok: true, escalated: true, state: node.state, repairs: node.repairs, node };
	}
	node.state = "running";
	return { ok: true, escalated: false, state: node.state, repairs: node.repairs, node };
}

export function buildPromptPack(dag, nodeId) {
	const node = dag.nodes.find((n) => n.id === nodeId);
	if (!node) return { ok: false, code: 2, error: `Node '${nodeId}' not found` };
	const zones = {
		zone1_shared_head: `[STATIC_ORCHESTRATION_INVARIANTS]\nSchema: ${dag.schema}\nBudget: ${dag.budget.lanes} lanes / ${dag.budget.waves} waves\nRules: Chunked writes <=100 lines, empirical verify before completion.`,
		zone2_unit: `목표: ${dag.goal} (${node.role})\n완료 조건: ${node.verify_cmd || "단위 검증 통과"}\n범위: ${node.write_scope.join(", ") || "지정 범위"} — 외부 파일 수정 금지`,
		zone3_tail: `종료 조건: 같은 도구 3회 반복 / 도구 호출 40회 / 무진척 2턴 → 즉시 UNKNOWN 반환\n반환 형식: ≤40줄 — 결과·실행 명령·관찰 출력·미해결 항목만`,
		zone4_append: `Node: ${node.id} | Model: ${node.model} | Repairs: ${node.repairs} | Deps: ${node.deps.join(",") || "none"}`,
	};
	return { ok: true, node: node.id, zones, prompt: `${zones.zone1_shared_head}\n\n${zones.zone2_unit}\n${zones.zone3_tail}\n\n${zones.zone4_append}` };
}

function loadDag(file) {
	if (!existsSync(file)) {
		console.error(`DAG file not found: ${file}`);
		process.exit(2);
	}
	return JSON.parse(readFileSync(file, "utf8"));
}

function saveDag(file, dag) {
	mkdirSync(dirname(resolve(file)), { recursive: true });
	writeFileSync(file, `${JSON.stringify(dag, null, 2)}\n`, "utf8");
}

function main() {
	const args = process.argv.slice(2);
	const cmd = args[0] || "status";
	const getOpt = (f, d = "") => {
		const i = args.indexOf(f);
		return i >= 0 && args[i + 1] ? args[i + 1] : d;
	};
	const file = getOpt("--file", ".lazyargon/ulw-dag.json");
	if (cmd === "define") {
		const spec = JSON.parse(getOpt("--spec", "") || readFileSync(file, "utf8"));
		const res = validateAndNormalizeDag(spec);
		if (!res.ok) {
			console.error(JSON.stringify(res));
			process.exit(res.code || 2);
		}
		saveDag(file, res.dag);
		console.log(JSON.stringify(res.dag, null, 2));
		return;
	}
	const dag = loadDag(file);
	const handlers = {
		ready: () => computeReadyBatch(dag, args.includes("--strict-disjoint")),
		settle: () => applySettle(dag, getOpt("--node"), getOpt("--state", "verified"), getOpt("--evidence", "")),
		repair: () => applyRepair(dag, getOpt("--node")),
		"prompt-pack": () => buildPromptPack(dag, getOpt("--node")),
	};
	if (handlers[cmd]) {
		const res = handlers[cmd]();
		if (cmd === "settle" || cmd === "repair") saveDag(file, dag);
		console.log(JSON.stringify(res, null, 2));
		if (!res.ok) process.exit(res.code || 2);
	} else {
		console.log(JSON.stringify(dag, null, 2));
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main();
}
