#!/usr/bin/env node
/**
 * lazy_slop_cleaner.mjs — Unified Slop Auditor & Distiller (v2.0 Wave 1-4)
 * Modes: rules-distill | code | prose | ac-slop
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RULES_BUDGET_BYTES = 24000;
const RULES_FILE_WARN_BYTES = 16000;

const SLOP_PROSE_PATTERNS = [
	{ id: "SLOP_KO_INNOVATIVE", token: "혁신적인", rx: /혁신적인/g },
	{ id: "SLOP_KO_MULTIFACETED", token: "다면적인", rx: /다면적인/g },
	{ id: "SLOP_KO_SEAMLESS", token: "심리스한", rx: /심리스한/g },
	{ id: "SLOP_KO_PIVOTAL", token: "중추적인", rx: /중추적인/g },
	{ id: "SLOP_EN_DELVE", token: "delve into", rx: /\bdelve\s+into\b/gi },
	{ id: "SLOP_EN_TESTAMENT", token: "testament to", rx: /\btestament\s+to\b/gi },
	{ id: "SLOP_EN_TAPESTRY", token: "tapestry of", rx: /\btapestry\s+of\b/gi },
	{ id: "SLOP_EN_CONCLUSION", token: "in conclusion", rx: /\bin\s+conclusion\b/gi },
];

const HOOK_REDUNDANT_PROSE_PATTERNS = [
	{
		id: "REDUNDANT_HOOK_PROSE",
		detail: "Restating hook enforcement prose already automated by PreToolUse/PostToolUse scripts",
		rx: /(?:반드시\s*항상\s*예외\s*없이\s*모든\s*규칙을\s*숙지|IMPORTANT:\s*You\s+must\s+always\s+remember\s+to\s+follow\s+all\s+instructions)/i,
	},
];

function walkFiles(target, exts = null) {
	if (!existsSync(target)) return [];
	const st = statSync(target);
	if (st.isFile()) return [resolve(target)];
	const out = [];
	const visit = (dir) => {
		for (const ent of readdirSync(dir, { withFileTypes: true })) {
			if (ent.name === "node_modules" || ent.name === ".git" || ent.name === ".lazyargon") continue;
			const full = join(dir, ent.name);
			if (ent.isDirectory()) visit(full);
			else if (!exts || exts.includes(extname(ent.name).toLowerCase())) out.push(full);
		}
	};
	visit(resolve(target));
	return out;
}

export function scanProseText(text, file = "<memory>") {
	const findings = [];
	const lines = text.split(/\r?\n/);
	let inFence = false;
	lines.forEach((line, idx) => {
		if (/^\s*(```|~~~)/.test(line)) {
			inFence = !inFence;
			return;
		}
		if (inFence) return;
		const masked = line.replace(/`[^`\n]*`/g, "");
		if (/(?:금지|쓰지\s*않|피한다|차단|상투어|forbid|ban|avoid|never\s+use)/i.test(masked)) return;
		for (const pat of SLOP_PROSE_PATTERNS) {
			if (pat.rx.test(masked)) {
				pat.rx.lastIndex = 0;
				findings.push({ category: "PROSE_SLOP", id: pat.id, token: pat.token, file, line: idx + 1 });
			}
		}
	});
	return findings;
}

export function scanCodeText(text, file = "<memory>") {
	const findings = [];
	const lines = text.split(/\r?\n/);
	lines.forEach((line, idx) => {
		const ln = idx + 1;
		if (/\/\/\s*(?:TODO|FIXME)\b|#\s*(?:TODO|FIXME)\b/.test(line)) {
			findings.push({ category: "DEAD", id: "TODO_FIXME", file, line: ln, detail: line.trim() });
		}
		if (/^\s*\/\/\s*(?:const|let|var|function|return|if|for|while)\s+.*[;{}]\s*$/.test(line)) {
			findings.push({ category: "DEAD", id: "COMMENTED_OUT_CODE", file, line: ln, detail: line.trim() });
		}
		const stripped = line.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""').replace(/\/\/.*$/, "");
		if (/\b(?:const|let|var|function)\s+(?:temp|data1|foo2|bar2|tmp1|val1|obj1)\b/.test(stripped)) {
			findings.push({ category: "NAMING", id: "VAGUE_IDENTIFIER", file, line: ln, detail: line.trim() });
		}
		if (/\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}/.test(stripped)) {
			findings.push({ category: "SIMPLIFY", id: "EMPTY_CATCH", file, line: ln, detail: line.trim() });
		}
		if (/\bvar\s+[A-Za-z_$]/.test(stripped)) {
			findings.push({ category: "MODERN", id: "LEGACY_VAR", file, line: ln, detail: line.trim() });
		}
	});
	for (let i = 0; i < lines.length; i++) {
		if (/\?\s*[^:?]+:\s*[^:?]+\?\s*[^:?]+:\s*[^:?]+\?\s*[^:?]+:/.test(lines[i])) {
			findings.push({ category: "SIMPLIFY", id: "DEEP_TERNARY", file, line: i + 1, detail: lines[i].trim() });
		}
	}
	return findings;
}

function scanFileText(mode, f, raw) {
	const out = [];
	const isCode = [".mjs", ".js", ".ts", ".tsx", ".py", ".rs", ".go"].includes(extname(f).toLowerCase());
	if (mode === "code" || (mode === "ac-slop" && isCode)) out.push(...scanCodeText(raw, f));
	if (mode === "prose" || mode === "ac-slop") out.push(...scanProseText(raw, f));
	return out;
}

export function auditRulesDistill(targetDir = PLUGIN_ROOT, includeSibling = true) {
	const root = resolve(targetDir);
	const rulesDir = join(root, "rules");
	const siblingDir = includeSibling ? resolve(root, "..", "lazyargon-workspace", "rules") : "";
	const skillsDir = join(root, "skills");
	const collectMd = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => join(dir, f)) : []);
	const ruleFiles = [...collectMd(rulesDir), ...(siblingDir && siblingDir !== rulesDir ? collectMd(siblingDir) : [])];
	const skillFiles = existsSync(skillsDir) ? readdirSync(skillsDir).map((s) => join(skillsDir, s, "SKILL.md")).filter(existsSync) : [];
	let rules_total_bytes = 0;
	const findings = [];
	for (const rf of ruleFiles) {
		const bytes = Buffer.byteLength(readFileSync(rf, "utf8"), "utf8");
		rules_total_bytes += bytes;
		if (bytes > RULES_FILE_WARN_BYTES) findings.push({ category: "BUDGET", id: "RULE_FILE_OVERSIZE", file: rf, bytes });
	}
	if (rules_total_bytes > RULES_BUDGET_BYTES) {
		findings.push({ category: "BUDGET", id: "RULES_TOTAL_BUDGET_EXCEEDED", bytes: rules_total_bytes, limit: RULES_BUDGET_BYTES });
	}
	for (const f of [...ruleFiles, ...skillFiles]) {
		const raw = readFileSync(f, "utf8");
		for (const hp of HOOK_REDUNDANT_PROSE_PATTERNS) {
			if (hp.rx.test(raw)) findings.push({ category: "DISTILL", id: hp.id, file: f, detail: hp.detail });
		}
		findings.push(...scanProseText(raw, f));
	}
	const within_budget = rules_total_bytes <= RULES_BUDGET_BYTES;
	return { schema: "lazy_slop_audit/v1", mode: "rules-distill", rules_total_bytes, within_budget, findings, clean: findings.length === 0 && within_budget };
}

export function distillTrajectory(trajectoryPath) {
	const lessons = [];
	if (!trajectoryPath || !existsSync(trajectoryPath)) return { schema: "lazy_trajectory_distill/v1", lessons, clean: true };
	const lines = readFileSync(resolve(trajectoryPath), "utf8").split(/\r?\n/).filter(Boolean);
	let prevTool = "";
	lines.forEach((line, idx) => {
		const ev = `${trajectoryPath}:${idx + 1}: ${line.slice(0, 140)}`;
		const curTool = (line.match(/"(?:tool|name|tool_name)"\s*:\s*"([^"]+)"/) || [])[1] || "";
		if (/(?:retry|retried|attempt\s*[2-9]|repeated)/i.test(line) || (curTool && curTool === prevTool)) {
			lessons.push({ cue: `Repeated or retried action (${curTool || "step"})`, lesson: "Stop blind retries after failure; inspect inputs and verify preconditions first.", evidence: ev });
		}
		if (/(?:"status"\s*:\s*"ERROR"|"error"\b|FAIL\b|Exception|exit\s+[12]|denied|blocked|invalid|timeout)/i.test(line)) {
			lessons.push({ cue: "Execution error or verification failure in trajectory", lesson: "Capture empirical error output and resolve root cause before claiming completion.", evidence: ev });
		}
		if (curTool) prevTool = curTool;
	});
	return { schema: "lazy_trajectory_distill/v1", lessons, clean: true };
}

function collectDiffAddedByFile(targetPath) {
	const cwd = targetPath && existsSync(targetPath) ? (statSync(targetPath).isDirectory() ? resolve(targetPath) : dirname(resolve(targetPath))) : process.cwd();
	let git = spawnSync("git", ["diff", "-U0", "HEAD"], { cwd, encoding: "utf8" });
	if (git.error || !(git.stdout || "").trim()) git = spawnSync("git", ["diff", "-U0"], { cwd, encoding: "utf8" });
	const byFile = new Map();
	let curFile = null;
	for (const line of (git.stdout || "").split(/\r?\n/)) {
		if (line.startsWith("+++ b/")) curFile = resolve(cwd, line.slice(6).trim());
		else if (curFile && line.startsWith("+") && !line.startsWith("+++")) {
			if (!byFile.has(curFile)) byFile.set(curFile, []);
			byFile.get(curFile).push(line.slice(1));
		}
	}
	return byFile;
}

export function auditTarget(mode, targetPath, opts = {}) {
	if (opts.trajectoryPath) return distillTrajectory(opts.trajectoryPath);
	if (mode === "rules-distill") return auditRulesDistill(targetPath || PLUGIN_ROOT, opts.includeSibling !== false);
	const findings = [];
	if (opts.diffOnly) {
		const filterFile = targetPath && existsSync(targetPath) && statSync(targetPath).isFile() ? resolve(targetPath) : null;
		for (const [f, addedLines] of collectDiffAddedByFile(targetPath).entries()) {
			if (!filterFile || f === filterFile) findings.push(...scanFileText(mode, f, addedLines.join("\n")));
		}
		return { schema: "lazy_slop_audit/v1", mode, diff_only: true, findings, clean: findings.length === 0 };
	}
	const git = !targetPath ? spawnSync("git", ["diff", "--name-only"], { encoding: "utf8" }) : null;
	const files = targetPath
		? walkFiles(targetPath)
		: !git?.error && git?.status === 0
			? (git.stdout || "").split(/\r?\n/).map((s) => s.trim()).filter((s) => s && existsSync(s)).map((s) => resolve(s))
			: [];
	for (const f of files) {
		if (existsSync(f)) findings.push(...scanFileText(mode, f, readFileSync(f, "utf8")));
	}
	return { schema: "lazy_slop_audit/v1", mode, findings, clean: findings.length === 0 };
}

function main() {
	const args = process.argv.slice(2);
	const getOpt = (flag, def = "") => {
		const idx = args.indexOf(flag);
		return idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith("--") ? args[idx + 1] : def;
	};
	const mode = getOpt("--mode", "ac-slop");
	const target = getOpt("--target", "");
	const trajectoryPath = getOpt("--trajectory", "");
	const diffOnly = args.includes("--diff-only");
	const strict = args.includes("--strict");
	const includeSibling = !args.includes("--no-sibling");
	const res = auditTarget(mode, target, { trajectoryPath, diffOnly, includeSibling });
	console.log(JSON.stringify(res, null, 2));
	process.exit(strict && res.clean === false ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main();
}
