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

export function auditRulesDistill(targetDir = PLUGIN_ROOT) {
	const root = resolve(targetDir);
	const rulesDir = join(root, "rules");
	const skillsDir = join(root, "skills");
	const ruleFiles = existsSync(rulesDir)
		? readdirSync(rulesDir).filter((f) => f.endsWith(".md")).map((f) => join(rulesDir, f))
		: [];
	const skillFiles = existsSync(skillsDir)
		? readdirSync(skillsDir)
				.map((s) => join(skillsDir, s, "SKILL.md"))
				.filter((p) => existsSync(p))
		: [];
	let rules_total_bytes = 0;
	const findings = [];
	for (const rf of ruleFiles) {
		const raw = readFileSync(rf, "utf8");
		const bytes = Buffer.byteLength(raw, "utf8");
		rules_total_bytes += bytes;
		if (bytes > RULES_FILE_WARN_BYTES) {
			findings.push({ category: "BUDGET", id: "RULE_FILE_OVERSIZE", file: rf, bytes });
		}
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
	return {
		schema: "lazy_slop_audit/v1",
		mode: "rules-distill",
		rules_total_bytes,
		within_budget: rules_total_bytes <= RULES_BUDGET_BYTES,
		findings,
		clean: findings.length === 0 && rules_total_bytes <= RULES_BUDGET_BYTES,
	};
}

export function auditTarget(mode, targetPath) {
	if (mode === "rules-distill") return auditRulesDistill(targetPath || PLUGIN_ROOT);
	let files = [];
	if (targetPath) {
		files = walkFiles(targetPath);
	} else {
		const git = spawnSync("git", ["diff", "--name-only"], { encoding: "utf8" });
		if (!git.error && git.status === 0) {
			files = (git.stdout || "")
				.split(/\r?\n/)
				.map((s) => s.trim())
				.filter((s) => s && existsSync(s))
				.map((s) => resolve(s));
		}
	}
	const findings = [];
	for (const f of files) {
		let raw = "";
		try {
			raw = readFileSync(f, "utf8");
		} catch {
			continue;
		}
		const ext = extname(f).toLowerCase();
		const isCode = [".mjs", ".js", ".ts", ".tsx", ".py", ".rs", ".go"].includes(ext);
		if (mode === "code" || (mode === "ac-slop" && isCode)) findings.push(...scanCodeText(raw, f));
		if (mode === "prose" || mode === "ac-slop") findings.push(...scanProseText(raw, f));
	}
	return {
		schema: "lazy_slop_audit/v1",
		mode,
		findings,
		clean: findings.length === 0,
	};
}

function main() {
	const args = process.argv.slice(2);
	const getOpt = (flag, def = "") => {
		const idx = args.indexOf(flag);
		return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
	};
	const mode = getOpt("--mode", "ac-slop");
	const target = getOpt("--target", "");
	const res = auditTarget(mode, target);
	console.log(JSON.stringify(res, null, 2));
	process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main();
}
