#!/usr/bin/env node
// session_start.mjs — SessionStart 훅 (lazyargon).
// rules/AGENTS.md 는 호스트가 rules 로더로 이미 주입하므로 여기서는 **런타임 상태만** 짧게 붙인다:
// 호스트가 보고한 세션 모델(없으면 unknown — 추정 금지), 진행 중인 /ulw 범위 잠금, 가드 팩 버전.
// 정적 규칙 뒤에 동적 상태가 오도록 하는 것이 목적이다(Argon 암시적 캐시의 접두 안정성).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { stdin } from "node:process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCOPE_MAX_LINES = 12;
const PINS_MAX_LINES = 20;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

const STDIN_WAIT_MS = 1500;

function readStdin(limitMs = STDIN_WAIT_MS) {
	return new Promise((resolve) => {
		if (stdin.isTTY) return resolve("");
		const chunks = [];
		let settled = false;
		const finish = (val) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			try {
				stdin.pause();
			} catch {}
			stdin.removeAllListeners();
			resolve(val);
		};
		const timer = setTimeout(() => finish(Buffer.concat(chunks).toString("utf8")), limitMs);
		if (typeof timer.unref === "function") timer.unref();
		stdin.on("data", (chunk) => {
			chunks.push(chunk);
			const acc = Buffer.concat(chunks).toString("utf8").trim();
			if ((acc.startsWith("{") && acc.endsWith("}")) || (acc.startsWith("[") && acc.endsWith("]"))) {
				try {
					JSON.parse(acc);
					finish(acc);
				} catch {}
			}
		});
		stdin.on("end", () => finish(Buffer.concat(chunks).toString("utf8")));
		stdin.on("error", () => finish(""));
	});
}

function parsePayload(raw) {
	try {
		const parsed = JSON.parse(raw.trim());
		return parsed && typeof parsed === "object" ? parsed : {};
	} catch {
		return {};
	}
}

export function resolveWorkspaceCwd(payload = {}) {
	return (
		(Array.isArray(payload?.workspacePaths) && typeof payload.workspacePaths[0] === "string" && payload.workspacePaths[0].trim()) ||
		(typeof payload?.cwd === "string" && payload.cwd.trim()) ||
		process.cwd()
	);
}

export function sessionModel(payload, env = process.env) {
	const candidates = [
		payload.modelName,
		payload.model_name,
		payload.sessionModel,
		payload.session_model,
		payload.model,
		payload.session?.modelName,
		payload.session?.model,
		env.ANTIGRAVITY_MODEL_NAME,
		env.ANTIGRAVITY_MODEL,
	];
	for (const c of candidates) {
		if (typeof c === "string" && c.trim()) return c.trim();
	}
	return "unknown";
}

function sliceLines(file, maxLines, fromTail = false) {
	try {
		if (!existsSync(file)) return "없음";
		const lines = readFileSync(file, "utf8").replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim());
		const picked = (fromTail ? lines.slice(-maxLines) : lines.slice(0, maxLines)).join("\n");
		return lines.length > maxLines ? `${picked}\n…(${lines.length - maxLines}줄 생략 — 파일을 직접 읽을 것)` : picked;
	} catch {
		return "읽기 실패";
	}
}

const headOf = (file, maxLines) => sliceLines(file, maxLines, false);
const tailOf = (file, maxLines) => sliceLines(file, maxLines, true);

const scopeLock = (cwd = process.cwd()) => headOf(join(cwd, ".lazyargon", "ulw-scope.md"), SCOPE_MAX_LINES);
const pins = (cwd = process.cwd()) => tailOf(join(cwd, ".lazyargon", "pins.md"), PINS_MAX_LINES);

function guardPackVersion() {
	try {
		const src = readFileSync(join(root, "scripts", "markdown_structure_guard.mjs"), "utf8");
		const m = src.match(/const GUARD_PACK_VERSION = '([^']+)'/);
		return m ? m[1] : "unknown";
	} catch {
		return "unknown";
	}
}

function pluginVersion() {
	try {
		return JSON.parse(readFileSync(join(root, "plugin.json"), "utf8")).version || "unknown";
	} catch {
		return "unknown";
	}
}

export function runtimeContext(payload = {}) {
	const cwd = resolveWorkspaceCwd(payload);
	const model = sessionModel(payload);
	const lines = [
		"## LazyArgon 런타임",
		"",
		`플러그인: lazyargon ${pluginVersion()} / 가드 팩 ${guardPackVersion()}`,
		`워크스페이스: ${cwd}`,
		`세션 모델: ${model}${model === "unknown" ? " (호스트 미보고 — Argon이라고 가정하지 말 것; 사고 수준은 세션 설정에서만 바뀜)" : ""}`,
		"기본 예산: 4 레인 / 2 웨이브 (사용자 지정 전까지)",
		"",
		"### 범위 잠금 (.lazyargon/ulw-scope.md)",
		"",
		scopeLock(cwd),
		"",
		"### 고정 식별자 (.lazyargon/pins.md — 컴팩션 뒤 기억 대신 이 값과 원본을 쓴다)",
		"",
		pins(cwd),
	];
	return lines.join("\n");
}
// ---------------------------------------------------------------------------
// Self-update (SessionStart): pull from origin/main when safe to do so.
// ---------------------------------------------------------------------------

/** Run git in dir; return stdout string on success, null on any error/timeout. */
function git(dir, args, timeoutMs = 5000) {
	const r = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8", timeout: timeoutMs });
	if (r.error || r.signal != null || r.status !== 0) return null;
	return r.stdout;
}

/**
 * Attempt a safe fast-forward self-update of the plugin from origin/main.
 * Guards: must be on branch main with an origin remote; throttled to once per 6 h;
 * respects LAZYARGON_NO_AUTO_UPDATE=1; never stashes, resets, or touches dirty trees.
 * Writes one line to errOut (default process.stderr) on update or when behind+blocked.
 * Never throws; never causes a non-zero exit.
 *
 * @param {string}   pluginRoot  Absolute path to the plugin checkout (default: root).
 * @param {object}   env         Process environment (default: process.env).
 * @param {object}   errOut      Writable stream for notices (default: process.stderr).
 */
export function autoUpdate(pluginRoot = root, env = process.env, errOut = process.stderr) {
	try {
		// Opt-out env var.
		if (env.LAZYARGON_NO_AUTO_UPDATE === "1") return;

		// Must be a git checkout on branch main.
		const branch = git(pluginRoot, ["symbolic-ref", "--short", "HEAD"]);
		if (!branch || branch.trim() !== "main") return;

		// Must have an origin remote.
		const remotes = git(pluginRoot, ["remote"]);
		if (!remotes || !remotes.split("\n").map((s) => s.trim()).includes("origin")) return;

		// Throttle: at most once every 6 hours. The stamp lives inside .git so it never dirties the tree.
		const gitDirOut = git(pluginRoot, ["rev-parse", "--absolute-git-dir"]);
		if (!gitDirOut) return;
		const stateDir = gitDirOut.trim();
		const stateFile = join(stateDir, "lazyargon-last-update-check");
		try {
			if (existsSync(stateFile)) {
				const ts = parseInt(readFileSync(stateFile, "utf8").trim(), 10);
				if (!isNaN(ts) && Date.now() - ts < SIX_HOURS_MS) return;
			}
		} catch { /* ignore */ }

		// Record the check time before the fetch (prevents hammering on network errors).
		try {
			mkdirSync(stateDir, { recursive: true });
			writeFileSync(stateFile, String(Date.now()), "utf8");
		} catch { /* ignore */ }

		// Snapshot HEAD before fetch.
		const headOut = git(pluginRoot, ["rev-parse", "HEAD"]);
		if (!headOut) return;
		const beforeSha = headOut.trim();

		// Fetch with hard <=8 s timeout; any failure stays silent.
		const fetchResult = spawnSync("git", ["-C", pluginRoot, "fetch", "origin", "main"], {
			encoding: "utf8",
			timeout: 8000,
		});
		if (fetchResult.error || fetchResult.signal != null || fetchResult.status !== 0) return;

		// What did origin/main land on?
		const fetchOut = git(pluginRoot, ["rev-parse", "FETCH_HEAD"]);
		if (!fetchOut) return;
		const fetchSha = fetchOut.trim();

		// Count commits we're behind; none (up to date or only local commits ahead) stays silent.
		const countOut = git(pluginRoot, ["rev-list", "--count", `${beforeSha}..${fetchSha}`]);
		if (countOut === null) return;
		const n = countOut.trim();
		if (n === "0") return;

		// Check working-tree cleanliness (porcelain is empty iff no changes and no untracked).
		const statusOut = git(pluginRoot, ["status", "--porcelain"]);
		if (statusOut === null) return;
		const dirty = statusOut.trim().length > 0;

		if (!dirty) {
			// Try fast-forward merge.
			const merge = spawnSync("git", ["-C", pluginRoot, "merge", "--ff-only", fetchSha], {
				encoding: "utf8",
				timeout: 8000,
			});
			if (merge.status === 0 && merge.signal == null && !merge.error) {
				const old7 = beforeSha.slice(0, 7);
				const new7 = fetchSha.slice(0, 7);
				errOut.write(`LazyArgon updated ${old7}..${new7} (${n} commits)\n`);
			} else {
				// History diverged (local commits) — cannot fast-forward.
				errOut.write(
					`LazyArgon: ${n} updates on origin/main; local commits differ, not auto-updated. Run: git -C ${pluginRoot} pull --rebase origin main\n`,
				);
			}
		} else {
			// Dirty working tree — leave everything alone.
			errOut.write(
				`LazyArgon: ${n} updates on origin/main; local changes present, not auto-updated. Run: git -C ${pluginRoot} stash && git -C ${pluginRoot} pull --ff-only\n`,
			);
		}
	} catch { /* never propagate */ }
}


const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
	const payload = parsePayload(await readStdin(STDIN_WAIT_MS));
	autoUpdate(root);
	const context = runtimeContext(payload);
	// Antigravity drops the whole SessionStart output when it carries keys beyond injectSteps
	// (verified live 2026-10-30: extra additionalContext/hookSpecificOutput -> nothing injected).
	process.stdout.write(`${JSON.stringify({ injectSteps: [{ systemMessage: { systemMessage: context } }] })}\n`);
	process.exit(0);
}
