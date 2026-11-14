#!/usr/bin/env node
/**
 * scripts/classify-task.mjs
 *
 * Classify a /ulw task prompt and emit routing JSON.
 *
 * Output schema:
 *   { kind, size, model, mode, reason, verified_path, action, session_notice, prompt }
 *
 * - kind:           one of the keys in model-routing.json task_kinds, or "general"
 * - size:           "single" | "subagents"
 * - model:          from roles[task_kinds[kind].role].model
 * - mode:           mirrors size
 * - reason:         human-readable classification explanation
 * - verified_path:  "invoke_subagent Model: \"pro\""  — the ONLY verified path inside a session.
 *                   "unverified-nested" for all other models (agy --model works from a terminal
 *                   but calling agy from inside an Antigravity /ulw session via run_command,
 *                   in print mode with tool-permission restrictions, has never been tested).
 * - action:         what /ulw does right now — determined by BOTH model and mode:
 *                   • mode=single, Argon  → "proceed in session" (Tier 0; no subagent startup cost)
 *                   • mode=subagents, Argon → "delegate via invoke_subagent Model: \"pro\""
 *                   • either mode, non-Argon → "proceed in session model + notice"
 *                   sensitive appends ", apply v2 flag/fail rule" to any of the above.
 * - session_notice: null for Argon (session default); one-line string for Hydrogen/Carbon.
 * - prompt:         "v2" when the routed role requires the v2 flag/fail rule; null otherwise.
 *
 * No model names are hardcoded here. All signals and role mappings come from model-routing.json.
 *
 * Usage:
 *   node scripts/classify-task.mjs "implement the new auth flow"
 *   echo "verify this PR" | node scripts/classify-task.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadRouting() {
	return JSON.parse(
		fs.readFileSync(
			path.join(ROOT, "skills", "ulw", "references", "model-routing.json"),
			"utf8",
		),
	);
}

function readPrompt() {
	if (process.argv[2]) return process.argv.slice(2).join(" ");
	try {
		if (!process.stdin.isTTY) {
			return fs.readFileSync("/dev/stdin", "utf8").trim();
		}
	} catch {
		// ignore
	}
	return "";
}

/**
 * Score each kind by keyword (weight 2) and pattern (weight 1) hits.
 * JSON key order determines priority when scores tie (first = highest priority).
 */
function scoreKinds(prompt, taskKinds) {
	const lower = prompt.toLowerCase();
	const scores = {};
	for (const [kind, def] of Object.entries(taskKinds)) {
		let score = 0;
		for (const kw of def.signals.keywords) {
			if (lower.includes(kw.toLowerCase())) score += 2;
		}
		for (const pat of def.signals.patterns) {
			if (lower.includes(pat.toLowerCase())) score += 1;
		}
		scores[kind] = score;
	}
	return scores;
}

/** Pick the highest-scoring kind; JSON key order breaks ties. */
function pickKind(scores, taskKinds) {
	let best = "general";
	let bestScore = 0;
	for (const kind of Object.keys(taskKinds)) {
		if ((scores[kind] ?? 0) > bestScore) {
			bestScore = scores[kind];
			best = kind;
		}
	}
	return { kind: best, score: bestScore };
}

/**
 * Classify size.
 * Priority:
 *   1. ≥3 explicit code-file paths in the prompt → subagents
 *   2. Korean quantity: "N개 모듈/파일/..." or "모듈/파일 N개", N≥3 → subagents
 *   3. Explicit numeric file count: "3 files", "3개 파일", "5 modules" → based on N
 *   4. size_signals from modes.subagents (JSON): "parallel", "전체 폴더", "모든 파일", etc. → subagents
 *   5. Default: single
 */
function classifySize(prompt, modes) {
	const lower = prompt.toLowerCase();

	// 1. Count explicit code-file paths (e.g. src/a.ts, utils/b.js, foo.py)
	const filePathRe =
		/\b[\w./%-][\w./%-]*\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|rb|cs|cpp|c|h|vue|svelte|kt|swift|sh|md|json|yaml|yml)\b/g;
	const filePaths = prompt.match(filePathRe) ?? [];
	if (filePaths.length >= 3) return "subagents";

	// 2. Korean quantity patterns
	//    "N개 모듈/파일/컴포넌트/..."  e.g. "6개 모듈", "3개 파일"
	//    "모듈/파일 N개"               e.g. "모듈 6개", "파일 5개"
	const unitKo = "모듈|파일|컴포넌트|함수|클래스|디렉토리|폴더|기능|서비스|api";
	const koAfterMatch = lower.match(new RegExp(`(\\d+)\\s*개\\s*(?:${unitKo})`, "u"));
	const koBeforeMatch = lower.match(new RegExp(`(?:${unitKo})\\s*(\\d+)\\s*개`, "u"));
	if (koAfterMatch && parseInt(koAfterMatch[1], 10) >= 3) return "subagents";
	if (koBeforeMatch && parseInt(koBeforeMatch[1], 10) >= 3) return "subagents";

	// 3. English/mixed explicit count: "3 files", "5 modules", "3개 파일"
	const numFileMatch = lower.match(/(\d+)\s*(?:(?:개\s*)?(?:files?|파일|modules?|components?))/);
	if (numFileMatch) {
		return parseInt(numFileMatch[1], 10) >= 3 ? "subagents" : "single";
	}

	// 4. Keyword signals from JSON (parallel, 독립적, 전체 폴더, 모든 파일, across the repo, …)
	const signals = modes?.subagents?.size_signals ?? [];
	for (const sig of signals) {
		if (lower.includes(sig.toLowerCase())) return "subagents";
	}

	return "single";
}

/**
 * Determine the verified path for the chosen model.
 *
 * ONLY invoke_subagent Model: "pro" (→ Argon) is verified inside an Antigravity session.
 * agy --model <id> works from a terminal but calling it via run_command inside a /ulw session
 * (print mode, different tool permissions, separate context) has never been tested → unverified-nested.
 */
function verifiedPath(model, subagentTiers) {
	for (const [tier, mapped] of Object.entries(subagentTiers)) {
		if (tier === "pro" && model.startsWith(mapped)) {
			return `invoke_subagent Model: "${tier}"`;
		}
	}
	return "unverified-nested";
}

/**
 * Decide the concrete action /ulw takes right now.
 *
 * Action depends on BOTH model and mode:
 *   • non-Argon model (Hydrogen/Carbon): nested agy unverified → always "proceed in session model + notice"
 *   • Argon + subagents mode: spawn one verified "pro" worker per disjoint lane → "delegate via ..."
 *   • Argon + single mode:  Tier 0, main agent directly (no subagent startup) → "proceed in session"
 *
 * Roles whose routing entry carries a "prompt" starting with "v2" append ", apply v2 flag/fail rule".
 */
function getAction(model, roles, roleName, mode) {
	const defaultModel = roles.default?.model;
	const isArgon = model === defaultModel;
	const v2Suffix = usesV2(roles, roleName) ? ", apply v2 flag/fail rule" : "";

	if (!isArgon) {
		// Hydrogen/Carbon: nested call unverified → proceed in current session with notice
		return "proceed in session model + notice";
	}

	if (mode === "subagents") {
		// Argon + multi-lane: delegate to subagents — the only verified path
		return `delegate via invoke_subagent Model: "pro"${v2Suffix}`;
	}

	// Argon + single: Tier 0, main agent proceeds directly (saves 14–18K token subagent startup)
	return `proceed in session${v2Suffix}`;
}

/** True when the role's routing entry requires the v2 flag/fail rule (data-driven, not by kind name). */
function usesV2(roles, roleName) {
	return typeof roles[roleName]?.prompt === "string" && roles[roleName].prompt.startsWith("v2");
}

/**
 * One-line session notice when the ideal model differs from the session default.
 * /ulw cannot change the session model mid-flight.
 */
function sessionNotice(model, roles) {
	const defaultModel = roles.default?.model;
	if (!defaultModel || model === defaultModel) return null;
	const label = model
		.replace(/^gemini-\d+-/, "")
		.replace(/-/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase());
	return `이 작업은 ${label}가 맞음. 현재 세션 모델로 진행`;
}

function buildReason(kind, taskKinds, prompt, size) {
	if (kind === "general") {
		return `No keyword match found; applying default role. Size: ${size}.`;
	}
	const def = taskKinds[kind];
	const lower = prompt.toLowerCase();
	const hit = def.signals.keywords.filter((k) => lower.includes(k.toLowerCase()));
	const kw = hit.length ? hit.join(", ") : "(pattern match)";
	return `Kind: ${kind}. Keywords matched: ${kw}. Role: ${def.role}. Size: ${size}.`;
}

// ── main ────────────────────────────────────────────────────────────────────

const routing = loadRouting();
const { task_kinds, roles, modes, subagent_tiers } = routing;

if (!task_kinds) {
	console.error(
		"model-routing.json is missing the task_kinds section. Add it before using this classifier.",
	);
	process.exit(1);
}

const prompt = readPrompt();
if (!prompt) {
	console.error('Usage: node scripts/classify-task.mjs "<task description>"');
	process.exit(1);
}

const scores = scoreKinds(prompt, task_kinds);
const { kind } = pickKind(scores, task_kinds);
const size = classifySize(prompt, modes);
const mode = size === "subagents" ? "subagents" : "single";

const kindDef = task_kinds[kind];
const roleName = kindDef ? kindDef.role : "default";
const roleData = roles[roleName] ?? roles.default;
const model = roleData.model;

const vpath = verifiedPath(model, subagent_tiers);
const action = getAction(model, roles, roleName, mode);
const notice = sessionNotice(model, roles);
const reason = buildReason(kind, task_kinds, prompt, size);
const promptField = usesV2(roles, roleName) ? "v2" : null;

process.stdout.write(
	JSON.stringify(
		{
			kind,
			size,
			model,
			mode,
			reason,
			verified_path: vpath,
			action,
			session_notice: notice,
			prompt: promptField,
		},
		null,
		2,
	) + "\n",
);
