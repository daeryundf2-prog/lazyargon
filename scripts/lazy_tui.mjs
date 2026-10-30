#!/usr/bin/env node
/**
 * lazy_tui.mjs — OMH Native Zero-LLM ANSI TUI Control Dashboard (v2.0 Wave 5)
 * CLI:
 *   node scripts/lazy_tui.mjs [--once] [--json] [--cwd <dir>]
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wsPluginRoot = join(root, "..", "lazyargon-workspace");
const RULES_BUDGET_LIMIT = 24000;
const SPARK_CHARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

const C = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	cyan: "\x1b[36m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	magenta: "\x1b[35m",
	blue: "\x1b[34m",
};

function countSkills(pluginDir) {
	const dir = join(pluginDir, "skills");
	if (!existsSync(dir)) return 0;
	let n = 0;
	for (const entry of readdirSync(dir)) {
		if (existsSync(join(dir, entry, "SKILL.md"))) n += 1;
	}
	return n;
}

function collectHostRulesBudget() {
	const agentsPath = join(root, "rules", "AGENTS.md");
	const geminiPath = join(wsPluginRoot, "rules", "GEMINI.md");
	const agentsBytes = existsSync(agentsPath) ? Buffer.byteLength(readFileSync(agentsPath, "utf8"), "utf8") : 0;
	const geminiBytes = existsSync(geminiPath) ? Buffer.byteLength(readFileSync(geminiPath, "utf8"), "utf8") : 0;
	const totalBytes = agentsBytes + geminiBytes;
	const skillsCount = countSkills(root) + countSkills(wsPluginRoot);
	const ratio = Math.min(1, totalBytes / RULES_BUDGET_LIMIT);
	return {
		agents_bytes: agentsBytes,
		gemini_bytes: geminiBytes,
		total_bytes: totalBytes,
		budget_bytes: RULES_BUDGET_LIMIT,
		usage_pct: Number((ratio * 100).toFixed(1)),
		skills_count: skillsCount,
	};
}

function collectDagState(cwd) {
	const dagPath = join(cwd, ".lazyargon", "ulw-dag.json");
	const scopePath = join(cwd, ".lazyargon", "ulw-scope.md");
	const counts = { not_run: 0, running: 0, reported_done: 0, verified: 0 };
	if (existsSync(dagPath)) {
		try {
			const dag = JSON.parse(readFileSync(dagPath, "utf8"));
			const nodes = Array.isArray(dag.nodes) ? dag.nodes : [];
			for (const n of nodes) {
				const st = n.status in counts ? n.status : "not_run";
				counts[st] += 1;
			}
			return { source: "ulw-dag.json", nodes: nodes.map((n) => ({ id: n.id, status: n.status || "not_run" })), counts, summary: `${nodes.length} DAG nodes loaded` };
		} catch {
			// fallback to scope
		}
	}
	if (existsSync(scopePath)) {
		const text = readFileSync(scopePath, "utf8");
		const goal = (text.match(/^목표:\s*(.+)$/m) || [])[1] || "Active ULW Scope";
		const done = /^상태:\s*완료/m.test(text);
		if (done) counts.verified = 1;
		else counts.running = 1;
		return {
			source: "ulw-scope.md",
			nodes: [{ id: "scope-root", status: done ? "verified" : "running" }],
			counts,
			summary: goal.slice(0, 68),
		};
	}
	counts.not_run = 1;
	return { source: "idle", nodes: [{ id: "idle", status: "not_run" }], counts, summary: "No active DAG or scope lock" };
}

function collectMemoryState(cwd) {
	const dbPath = join(cwd, ".lazyargon", "memory.db");
	const pinsPath = join(cwd, ".lazyargon", "pins.md");
	const dbBytes = existsSync(dbPath) ? statSync(dbPath).size : 0;
	let pinsCount = 0;
	if (existsSync(pinsPath)) {
		const lines = readFileSync(pinsPath, "utf8").split(/\r?\n/);
		pinsCount = lines.filter((l) => /^\s*-\s*\[(?:fact|pin|proc)?/i.test(l) || /^\s*-\s+\S/.test(l)).length;
	}
	return {
		memory_db_exists: existsSync(dbPath),
		memory_db_bytes: dbBytes,
		pins_count: pinsCount,
	};
}

function makeSparkline(values) {
	if (!values.length) return "▁▃▅▇█";
	const min = Math.min(...values);
	const max = Math.max(...values);
	const span = max - min || 1;
	return values
		.slice(-10)
		.map((v) => SPARK_CHARS[Math.min(7, Math.floor(((v - min) / span) * 7))])
		.join("");
}

function collectAutoresearchRadar(cwd) {
	const ledgerPath = join(cwd, ".lazyargon", "experiment-ledger.tsv");
	const receiptsPath = join(root, "docs", "skill-source-receipts.json");
	const scores = [];
	if (existsSync(ledgerPath)) {
		const lines = readFileSync(ledgerPath, "utf8").trim().split(/\r?\n/).slice(1);
		for (const l of lines) {
			const cols = l.split("\t");
			const val = Number.parseFloat(cols[2] ?? cols[1] ?? "");
			if (!Number.isNaN(val)) scores.push(val);
		}
	}
	let trackedSources = 0;
	if (existsSync(receiptsPath)) {
		try {
			const data = JSON.parse(readFileSync(receiptsPath, "utf8"));
			trackedSources = Array.isArray(data.sources) ? data.sources.length : 0;
		} catch {
			trackedSources = 0;
		}
	}
	return {
		experiments_count: scores.length,
		sparkline: makeSparkline(scores),
		tracked_sources: trackedSources,
		status_label: `${trackedSources} sources tracked`,
	};
}

export function collectTuiState(cwd = process.cwd()) {
	return {
		schema: "lazy_tui_dashboard/v1",
		llm_calls: 0,
		cwd,
		panels: {
			host_rules_budget: collectHostRulesBudget(),
			dag_ulw: collectDagState(cwd),
			memory_rag: collectMemoryState(cwd),
			autoresearch_radar: collectAutoresearchRadar(cwd),
		},
	};
}

function renderBox(title, lines, width = 76) {
	const top = `${C.cyan}╭─ ${C.bold}${title}${C.reset}${C.cyan} ${"─".repeat(Math.max(1, width - title.length - 5))}╮${C.reset}`;
	const body = lines.map((l) => `${C.cyan}│${C.reset} ${l}`).join("\n");
	const bot = `${C.cyan}╰${"─".repeat(width - 2)}╯${C.reset}`;
	return `${top}\n${body}\n${bot}`;
}

export function renderTuiDashboard(state) {
	const p1 = state.panels.host_rules_budget;
	const p2 = state.panels.dag_ulw;
	const p3 = state.panels.memory_rag;
	const p4 = state.panels.autoresearch_radar;
	const filled = Math.round((p1.total_bytes / p1.budget_bytes) * 20);
	const gauge = `${C.green}${"█".repeat(Math.min(20, filled))}${C.dim}${"░".repeat(Math.max(0, 20 - filled))}${C.reset}`;
	const b1 = renderBox("[1] HOST & RULES BUDGET", [
		`Rules Budget: [${gauge}] ${p1.total_bytes.toLocaleString("en-US")}B / 24,000B (${p1.usage_pct}%)`,
		`AGENTS.md: ${p1.agents_bytes}B | GEMINI.md: ${p1.gemini_bytes}B | Skills: ${C.bold}${p1.skills_count}${C.reset}개`,
	]);
	const b2 = renderBox("[2] DAG-ULW EXECUTION GRAPH", [
		`Source: ${p2.source} | ${p2.summary}`,
		`Badges: [not_run:${p2.counts.not_run}] -> [running:${p2.counts.running}] -> [reported_done:${p2.counts.reported_done}] -> [${C.green}verified:${p2.counts.verified}${C.reset}]`,
	]);
	const b3 = renderBox("[3] MEM0 + LETTA + AUTORAG", [
		`memory.db: ${p3.memory_db_exists ? `online (${p3.memory_db_bytes}B)` : "standby (0B)"} | Pinned Facts (pins.md): ${p3.pins_count}개`,
	]);
	const b4 = renderBox("[4] AUTORESEARCH & UPSTREAM RADAR", [
		`Autoresearch Sparkline: ${C.yellow}${p4.sparkline}${C.reset} (${p4.experiments_count} runs) | Upstream: ${C.magenta}${p4.status_label}${C.reset}`,
	]);
	return [b1, b2, b3, b4].join("\n");
}

function main() {
	const args = process.argv.slice(2);
	let cwd = process.cwd();
	const cwdIdx = args.indexOf("--cwd");
	if (cwdIdx >= 0 && args[cwdIdx + 1]) cwd = resolve(cwd, args[cwdIdx + 1]);
	const state = collectTuiState(cwd);
	if (args.includes("--json")) console.log(JSON.stringify(state, null, 2));
	else console.log(renderTuiDashboard(state));
	process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main();
}
