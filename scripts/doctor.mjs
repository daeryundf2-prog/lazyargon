#!/usr/bin/env node
// doctor.mjs — lazyargon 플러그인 진단 (읽기 전용). 파일을 만들거나 고치지 않는다.
// 검사: Node/Python 버전, hooks.json 배선과 스크립트 존재, 스킬 프런트매터, 가드 팩 동기화(인접 workspace),
// 범위 잠금 파일, 매니페스트 버전 일치. `--json` 은 기계 판독 출력, `--strict` 는 warn 도 실패로 센다.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const checks = [];

function add(id, status, detail) {
	checks.push({ id, status, detail });
}

function nodeVersion() {
	const major = Number.parseInt(process.versions.node.split(".")[0], 10);
	add("node", major >= 20 ? "ok" : "fail", `node ${process.versions.node} (>=20 필요)`);
}

function pythonVersion() {
	for (const cmd of ["python3", "python"]) {
		const res = spawnSync(cmd, ["--version"], { encoding: "utf8" });
		if (!res.error && res.status === 0) {
			add("python", "ok", `${cmd}: ${(res.stdout || res.stderr).trim()}`);
			return;
		}
	}
	add("python", "warn", "python3 없음 — tools/smoke_test.py 와 diagram/logo 스크립트 비활성");
}

function hooksWiring() {
	const p = join(root, "hooks.json");
	if (!existsSync(p)) {
		add("hooks.json", "fail", "파일 없음");
		return;
	}
	let data;
	try {
		data = JSON.parse(readFileSync(p, "utf8"));
	} catch (e) {
		add("hooks.json", "fail", `JSON 파싱 실패: ${e.message}`);
		return;
	}
	const scripts = new Set();
	for (const entries of Object.values(data.hooks || {})) {
		for (const entry of entries) {
			const hooks = Array.isArray(entry.hooks) ? entry.hooks : [entry];
			for (const h of hooks) {
				for (const m of String(h.command || "").matchAll(/\.\/scripts\/([\w.-]+\.mjs)/g)) scripts.add(m[1]);
			}
		}
	}
	const missing = [...scripts].filter((s) => !existsSync(join(root, "scripts", s)));
	add("hooks.scripts", missing.length ? "fail" : "ok", missing.length ? `없는 스크립트: ${missing.join(", ")}` : `${scripts.size}개 스크립트 존재`);
	add("hooks.session_start", data.hooks?.SessionStart ? "ok" : "warn", data.hooks?.SessionStart ? "SessionStart 배선됨" : "SessionStart 훅 없음 — 런타임 상태 주입 불가");
}

function skillsFrontmatter() {
	const dir = join(root, "skills");
	if (!existsSync(dir)) {
		add("skills", "fail", "skills/ 없음");
		return;
	}
	const bad = [];
	let count = 0;
	for (const name of readdirSync(dir)) {
		const skill = join(dir, name, "SKILL.md");
		if (!existsSync(skill)) {
			bad.push(`${name}: SKILL.md 없음`);
			continue;
		}
		count += 1;
		const head = readFileSync(skill, "utf8").replace(/\r\n/g, "\n").slice(0, 8000);
		const fm = head.match(/^---\n([\s\S]*?)\n---/);
		const body = fm ? fm[1] : "";
		if (!/^name:\s*\S/m.test(body) || !/^description:\s*\S/m.test(body)) bad.push(`${name}: 프런트매터(name/description) 불완전`);
	}
	add("skills", bad.length ? "fail" : "ok", bad.length ? bad.join("; ") : `${count}개 스킬 프런트매터 정상`);
}

function guardParity() {
	const sibling = join(root, "..", "lazyargon-workspace", "scripts");
	if (!existsSync(sibling)) {
		add("guard_pack.sync", "warn", "인접 lazyargon-workspace 없음 — 동기화 검사 생략");
		return;
	}
	const drift = [];
	for (const g of ["markdown_structure_guard.mjs", "json_schema_guard.mjs"]) {
		const a = join(root, "scripts", g);
		const b = join(sibling, g);
		if (!existsSync(a) || !existsSync(b)) {
			drift.push(`${g}: 한쪽에 없음`);
			continue;
		}
		if (readFileSync(a, "utf8") !== readFileSync(b, "utf8")) drift.push(`${g}: 내용 상이`);
	}
	add("guard_pack.sync", drift.length ? "fail" : "ok", drift.length ? `${drift.join("; ")} — bash ../lazyargon-workspace/scripts/sync_guard_pack.sh` : "workspace 캐노니컬과 동일");
}

function manifestVersions() {
	try {
		const plugin = JSON.parse(readFileSync(join(root, "plugin.json"), "utf8")).version;
		const pkgPath = join(root, "package.json");
		const pkg = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, "utf8")).version : plugin;
		const readme = (readFileSync(join(root, "README.md"), "utf8").match(/v(\d+\.\d+\.\d+)/) || [])[1];
		const rules = (readFileSync(join(root, "rules", "AGENTS.md"), "utf8").match(/LazyArgon \(`v(\d+\.\d+\.\d+)`\)/) || [])[1];
		const all = { plugin, pkg, readme, rules };
		const distinct = new Set(Object.values(all));
		add("versions", distinct.size === 1 ? "ok" : "fail", JSON.stringify(all));
	} catch (e) {
		add("versions", "fail", e.message);
	}
}

function scopeLock() {
	const p = join(process.cwd(), ".lazyargon", "ulw-scope.md");
	add("scope_lock", "ok", existsSync(p) ? `진행 중 범위 잠금 있음: ${p}` : "범위 잠금 없음 (유휴)");
}

// agy 는 API 키 모드(modelProvider: "gemini")에서 gemini-4-argon 을 모르면 Gemini 3.8 Flash(High)로 조용히 폴백한다
// (google-antigravity/antigravity-cli #1228). 설정 파일에서 provider 값과 Argon 매핑 유무만 본다 — 키·토큰 값은 읽어 출력하지 않는다.
function findKey(node, key, depth = 0) {
	if (!node || typeof node !== "object" || depth > 6) return undefined;
	if (Object.prototype.hasOwnProperty.call(node, key)) return node[key];
	for (const v of Object.values(node)) {
		const hit = findKey(v, key, depth + 1);
		if (hit !== undefined) return hit;
	}
	return undefined;
}

function modelProvider() {
	const home = process.env.HOME || process.env.USERPROFILE || "";
	const candidates = [
		join(home, ".gemini", "settings.json"),
		join(home, ".gemini", "config", "config.json"),
		join(home, ".gemini", "antigravity", "settings.json"),
		join(home, ".antigravity", "settings.json"),
	];
	for (const file of candidates) {
		if (!existsSync(file)) continue;
		let text;
		let data;
		try {
			text = readFileSync(file, "utf8");
			data = JSON.parse(text);
		} catch {
			continue;
		}
		const provider = findKey(data, "modelProvider");
		if (provider === undefined) continue;
		if (provider === "gemini" && !text.includes("gemini-4-argon")) {
			add("antigravity.model_provider", "warn", `${file}: modelProvider=gemini(API 키 모드)인데 gemini-4-argon 매핑이 없다 — agy 가 Gemini 3.8 Flash(High)로 폴백한다. customModelsConfig 에 gemini-api://gemini-4-argon 항목을 넣거나 구독 로그인으로 쓸 것`);
			return;
		}
		add("antigravity.model_provider", "ok", `${file}: modelProvider=${typeof provider === "string" ? provider : "set"}${provider === "gemini" ? " (Argon 매핑 있음)" : ""}`);
		return;
	}
	add("antigravity.model_provider", "ok", "API 키 모드 설정 없음 (구독 로그인 기준)");
}

// 규칙 파일이 호스트 토큰 예산을 넘으면 잘리지 않고 통째로 빠진다(antigravity-cli #1254: 118,908B → 0 주입,
// 24,024B → 전부 주입). 정확한 예산은 비공개라 확인된 안전선(24,000B)을 두 플러그인 합계 상한으로 쓴다.
const RULES_FILE_WARN_BYTES = 16000;
const RULES_TOTAL_WARN_BYTES = 24000;

function rulesFiles(pluginRoot) {
	const dir = join(pluginRoot, "rules");
	if (!existsSync(dir)) return [];
	return readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => join(dir, f));
}

function rulesBudget() {
	const files = [...rulesFiles(root), ...rulesFiles(join(root, "..", "lazyargon-workspace"))];
	const sizes = files.map((f) => ({ f, bytes: Buffer.byteLength(readFileSync(f, "utf8"), "utf8") }));
	const total = sizes.reduce((n, s) => n + s.bytes, 0);
	const big = sizes.filter((s) => s.bytes > RULES_FILE_WARN_BYTES).map((s) => `${s.f} ${s.bytes}B`);
	const detail = `${sizes.length}개 규칙 파일 합계 ${total}B (파일당 ≤${RULES_FILE_WARN_BYTES}B, 합계 ≤${RULES_TOTAL_WARN_BYTES}B)`;
	if (big.length || total > RULES_TOTAL_WARN_BYTES) {
		add("rules.budget", "warn", `${detail} — 초과: ${big.join(", ") || "합계"}. 예산을 넘은 규칙 파일은 통째로 빠진다(#1254)`);
		return;
	}
	add("rules.budget", "ok", detail);
}

// agy 1.3.6 이전에는 따옴표 없는 description 에 콜론이 있으면 skill/rule/agent 로딩이 실패했다.
// 1.3.6 에서 고쳐졌지만 구버전 사용자를 위해 두 플러그인의 프런트매터를 함께 본다.
function descriptionColons() {
	const roots = [root, join(root, "..", "lazyargon-workspace")].filter((r) => existsSync(join(r, "skills")));
	const bad = [];
	for (const r of roots) {
		const targets = [];
		for (const name of readdirSync(join(r, "skills"))) targets.push(join(r, "skills", name, "SKILL.md"));
		for (const sub of ["commands", "agents"]) {
			if (existsSync(join(r, sub))) for (const f of readdirSync(join(r, sub))) if (f.endsWith(".md")) targets.push(join(r, sub, f));
		}
		for (const file of targets) {
			if (!existsSync(file)) continue;
			const fm = readFileSync(file, "utf8").replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---/);
			if (!fm) continue;
			const line = fm[1].split("\n").find((l) => l.startsWith("description:"));
			if (!line) continue;
			const value = line.slice("description:".length).trim();
			if (!/^["'>|]/.test(value) && /:\s/.test(value)) bad.push(file);
		}
	}
	add("frontmatter.description_colon", bad.length ? "warn" : "ok", bad.length ? `따옴표 없는 description 에 콜론 — agy <1.3.6 에서 로딩 실패: ${bad.join(", ")}` : "따옴표 없는 콜론 description 없음");
}

nodeVersion();
pythonVersion();
hooksWiring();
skillsFrontmatter();
guardParity();
manifestVersions();
scopeLock();
modelProvider();
rulesBudget();
descriptionColons();

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const failed = checks.filter((c) => c.status === "fail" || (strict && c.status === "warn"));
const summary = { ok: failed.length === 0, strict, checks };
if (args.includes("--json")) {
	console.log(JSON.stringify(summary, null, 2));
} else {
	for (const c of checks) console.log(`[${c.status.padEnd(4)}] ${c.id}: ${c.detail}`);
	console.log(failed.length ? `\nFAIL ${failed.length}개` : "\n모든 검사 통과");
}
process.exit(summary.ok ? 0 : 1);
