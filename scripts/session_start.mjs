#!/usr/bin/env node
// session_start.mjs — SessionStart 훅 (lazyargon).
// rules/AGENTS.md 는 호스트가 rules 로더로 이미 주입하므로 여기서는 **런타임 상태만** 짧게 붙인다:
// 호스트가 보고한 세션 모델(없으면 unknown — 추정 금지), 진행 중인 /ulw 범위 잠금, 가드 팩 버전.
// 정적 규칙 뒤에 동적 상태가 오도록 하는 것이 목적이다(Argon 암시적 캐시의 접두 안정성).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { stdin } from "node:process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCOPE_MAX_LINES = 12;
const PINS_MAX_LINES = 20;

function readStdin(limitMs = 200) {
	return new Promise((resolve) => {
		if (stdin.isTTY) {
			resolve("");
			return;
		}
		const chunks = [];
		const finish = () => {
			clearTimeout(timer);
			stdin.removeAllListeners();
			resolve(Buffer.concat(chunks).toString("utf8"));
		};
		const timer = setTimeout(finish, limitMs);
		stdin.on("data", (chunk) => chunks.push(chunk));
		stdin.on("end", finish);
		stdin.on("error", () => {
			clearTimeout(timer);
			resolve("");
		});
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

function headOf(file, maxLines) {
	try {
		if (!existsSync(file)) return "없음";
		const lines = readFileSync(file, "utf8").replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim());
		const head = lines.slice(0, maxLines).join("\n");
		return lines.length > maxLines ? `${head}\n…(${lines.length - maxLines}줄 생략 — 파일을 직접 읽을 것)` : head;
	} catch {
		return "읽기 실패";
	}
}

const scopeLock = (cwd = process.cwd()) => headOf(join(cwd, ".lazyargon", "ulw-scope.md"), SCOPE_MAX_LINES);
const pins = (cwd = process.cwd()) => headOf(join(cwd, ".lazyargon", "pins.md"), PINS_MAX_LINES);

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

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
	const payload = parsePayload(await readStdin(200));
	const context = runtimeContext(payload);
	const hookEventName = typeof payload.hook_event_name === "string" && payload.hook_event_name ? payload.hook_event_name : "SessionStart";
	process.stdout.write(
		`${JSON.stringify({
			injectSteps: [{ systemMessage: { systemMessage: context } }],
			additionalContext: context,
			hookSpecificOutput: { hookEventName, additionalContext: context },
		})}\n`,
	);
	process.exit(0);
}
