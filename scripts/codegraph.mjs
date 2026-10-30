#!/usr/bin/env node
/**
 * codegraph.mjs — Lightweight AST/Import Graph & Personalized PageRank Handoff (v2.0 Wave 2-1)
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CODE_EXTS = new Set([".mjs", ".js", ".ts", ".tsx", ".py"]);

export function normalizeRel(root, fullPath) {
	const s = String(fullPath || "").trim();
	if (!s) return "";
	if (!root) return s.replace(/\\/g, "/").replace(/^\.\//, "");
	return relative(resolve(root), resolve(root, s)).replace(/\\/g, "/");
}

function collectSourceFiles(rootDir) {
	const files = [];
	const visit = (dir) => {
		for (const ent of readdirSync(dir, { withFileTypes: true })) {
			if (ent.name === "node_modules" || ent.name === ".git" || ent.name === ".lazyargon") continue;
			const full = join(dir, ent.name);
			let st;
			try {
				st = statSync(full);
			} catch {
				continue;
			}
			if (st.isDirectory()) visit(full);
			else if (st.isFile() && CODE_EXTS.has(extname(ent.name).toLowerCase())) files.push(full);
		}
	};
	if (existsSync(rootDir)) visit(resolve(rootDir));
	return files;
}

function resolveInternalImport(rootDir, fromFile, spec, knownFiles) {
	const ext = extname(fromFile).toLowerCase();
	if (ext === ".py") {
		if (!spec) return null;
		const rel = spec.replace(/^\.+/, "").replace(/\./g, "/");
		const candidates = [
			join(dirname(fromFile), `${rel}.py`),
			join(rootDir, `${rel}.py`),
			join(rootDir, rel, "__init__.py"),
		];
		for (const c of candidates) {
			const norm = normalizeRel(rootDir, c);
			if (knownFiles.has(norm)) return norm;
		}
		return null;
	}
	if (!spec.startsWith(".")) return null;
	const base = resolve(dirname(fromFile), spec);
	const candidates = [base, ...[".mjs", ".js", ".ts", ".tsx"].map((e) => `${base}${e}`), ...["index.mjs", "index.js", "index.ts", "index.tsx"].map((idx) => join(base, idx))];
	for (const c of candidates) {
		const norm = normalizeRel(rootDir, c);
		if (knownFiles.has(norm)) return norm;
	}
	return null;
}

export function extractSymbolsAndImports(text, isPy = false) {
	const cleaned = String(text || "")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^\s*\/\/.*$/gm, "")
		.replace(/^\s*#.*$/gm, "")
		.replace(/(?<!:)\/\/.*$/gm, "");
	const symbols = new Set();
	const rawImports = new Set();
	if (isPy) {
		for (const m of cleaned.matchAll(/^\s*(?:def|class)\s+([A-Za-z_][A-Za-z0-9_]*)/gm)) symbols.add(m[1]);
		for (const m of cleaned.matchAll(/^\s*from\s+([A-Za-z0-9_.]+)\s+import\b/gm)) rawImports.add(m[1]);
		for (const m of cleaned.matchAll(/^\s*import\s+([A-Za-z0-9_.]+)/gm)) rawImports.add(m[1]);
	} else {
		for (const m of cleaned.matchAll(/\bexport\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g)) {
			symbols.add(m[1]);
		}
		for (const m of cleaned.matchAll(/\bimport\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g)) rawImports.add(m[1]);
		for (const m of cleaned.matchAll(/\bexport\s+[\s\S]*?\s+from\s+["']([^"']+)["']/g)) rawImports.add(m[1]);
		for (const m of cleaned.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g)) rawImports.add(m[1]);
	}
	return { symbols: [...symbols], rawImports: [...rawImports] };
}

export function buildCodeGraph(rootDir = process.cwd()) {
	const root = resolve(rootDir);
	const absFiles = collectSourceFiles(root);
	const knownFiles = new Set(absFiles.map((f) => normalizeRel(root, f)));
	const nodes = {};
	for (const abs of absFiles) {
		const rel = normalizeRel(root, abs);
		const isPy = abs.endsWith(".py");
		const text = readFileSync(abs, "utf8");
		const { symbols, rawImports } = extractSymbolsAndImports(text, isPy);
		const imports_internal = [];
		for (const spec of rawImports) {
			const target = resolveInternalImport(root, abs, spec, knownFiles);
			if (target && target !== rel && !imports_internal.includes(target)) imports_internal.push(target);
		}
		nodes[rel] = { file: rel, exports: symbols, imports_internal };
	}
	return { schema: "lazyargon_codegraph/v1", root, nodes };
}

export function computePersonalizedPageRank(graph, seedFiles, topK = 10, damping = 0.85, iterations = 20) {
	const allFiles = Object.keys(graph.nodes || {});
	if (allFiles.length === 0) return [];
	const validSeeds = (seedFiles || [])
		.map((s) => normalizeRel(graph.root, s))
		.filter((s) => graph.nodes[s]);
	const seeds = validSeeds.length > 0 ? validSeeds : [allFiles[0]];
	const seedWeight = 1 / seeds.length;
	const p0 = new Map(allFiles.map((f) => [f, seeds.includes(f) ? seedWeight : 0]));

	const neighbors = new Map(allFiles.map((f) => [f, new Set()]));
	for (const [src, info] of Object.entries(graph.nodes)) {
		for (const dst of info.imports_internal || []) {
			if (neighbors.has(src) && neighbors.has(dst)) {
				neighbors.get(src).add(dst);
				neighbors.get(dst).add(src);
			}
		}
	}

	let scores = new Map(p0);
	for (let iter = 0; iter < iterations; iter++) {
		const next = new Map();
		for (const f of allFiles) next.set(f, (1 - damping) * (p0.get(f) || 0));
		for (const u of allFiles) {
			const nbrs = [...(neighbors.get(u) || [])];
			const scoreU = scores.get(u) || 0;
			if (nbrs.length === 0) {
				for (const s of seeds) next.set(s, next.get(s) + damping * scoreU * seedWeight);
			} else {
				const degU = nbrs.length;
				for (const v of nbrs) {
					const degV = Math.max(1, (neighbors.get(v) || new Set()).size);
					next.set(v, next.get(v) + (damping * scoreU) / Math.sqrt(degU * degV));
				}
			}
		}
		const sum = [...next.values()].reduce((a, b) => a + b, 0) || 1;
		for (const [k, val] of next.entries()) next.set(k, val / sum);
		scores = next;
	}

	return allFiles
		.map((f) => ({
			file: f,
			score: Number((scores.get(f) || 0).toFixed(6)),
			seed: seeds.includes(f),
			exports: graph.nodes[f].exports,
			imports_internal: graph.nodes[f].imports_internal,
		}))
		.sort((a, b) => Number(b.seed) - Number(a.seed) || b.score - a.score || a.file.localeCompare(b.file))
		.slice(0, topK);
}

export const computeHandoff = computePersonalizedPageRank;

export function findImpactedTests(graph, changedFiles) {
	const reverseAdj = new Map();
	for (const f of Object.keys(graph.nodes || {})) reverseAdj.set(f, []);
	for (const [src, info] of Object.entries(graph.nodes || {})) {
		for (const dst of info.imports_internal || []) {
			if (!reverseAdj.has(dst)) reverseAdj.set(dst, []);
			reverseAdj.get(dst).push(src);
		}
	}
	const isTestFile = (f) => /(?:^|\/)(?:test_[^/]+\.py|[^/]+\.(?:test|spec)\.[A-Za-z0-9]+)$/i.test(f);
	const visited = new Set();
	const queue = [];
	for (const raw of changedFiles || []) {
		const norm = normalizeRel(graph.root, raw);
		if (graph.nodes[norm] && !visited.has(norm)) {
			visited.add(norm);
			queue.push(norm);
		}
	}
	const tests = new Set();
	while (queue.length > 0) {
		const cur = queue.shift();
		if (isTestFile(cur)) tests.add(cur);
		for (const dependent of reverseAdj.get(cur) || []) {
			if (!visited.has(dependent)) {
				visited.add(dependent);
				queue.push(dependent);
			}
		}
	}
	return [...tests].sort();
}

function collectGitChanged(root) {
	const parse = (out) => (out || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
	const head = spawnSync("git", ["diff", "--name-only", "HEAD"], { cwd: root, encoding: "utf8" });
	const list = !head.error && head.status === 0 ? parse(head.stdout) : [];
	if (list.length > 0) return list;
	const wt = spawnSync("git", ["diff", "--name-only"], { cwd: root, encoding: "utf8" });
	return !wt.error && wt.status === 0 ? parse(wt.stdout) : [];
}

function main() {
	const args = process.argv.slice(2);
	const cmd = args[0] || "build";
	const getOpt = (f, d = "") => {
		const i = args.indexOf(f);
		return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d;
	};
	const root = resolve(getOpt("--root", process.cwd()));
	const graph = buildCodeGraph(root);
	if (cmd === "build") {
		const out = getOpt("--out", "");
		if (out) {
			const absOut = resolve(out);
			mkdirSync(dirname(absOut), { recursive: true });
			const tmp = `${absOut}.${process.pid}.${Date.now()}.tmp`;
			writeFileSync(tmp, `${JSON.stringify(graph, null, 2)}\n`, "utf8");
			renameSync(tmp, absOut);
		}
		console.log(JSON.stringify(graph, null, 2));
	} else if (cmd === "handoff") {
		const seeds = getOpt("--seeds", "").split(",").map((s) => s.trim()).filter(Boolean);
		const top = Number.parseInt(getOpt("--top", "10"), 10) || 10;
		const ranked = computePersonalizedPageRank(graph, seeds, top);
		console.log(JSON.stringify({ schema: "lazyargon_codegraph_handoff/v1", seeds, top, ranked }, null, 2));
	} else if (cmd === "tests") {
		const rawChanged = getOpt("--changed", "");
		const changed = rawChanged
			? rawChanged.split(",").map((s) => s.trim()).filter(Boolean)
			: collectGitChanged(root);
		const tests = findImpactedTests(graph, changed);
		console.log(JSON.stringify({ schema: "lazyargon_codegraph_tests/v1", changed, tests }, null, 2));
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main();
}
