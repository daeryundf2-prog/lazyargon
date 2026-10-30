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

function collectHookScripts(hooksJsonPath, pluginRoot, label) {
	let data;
	try {
		data = JSON.parse(readFileSync(hooksJsonPath, "utf8"));
	} catch (e) {
		return { ok: false, error: `${label}/hooks.json JSON 파싱 실패: ${e.message}`, scripts: [], missing: [], data: null };
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
	const missing = [...scripts]
		.filter((s) => !existsSync(join(pluginRoot, "scripts", s)))
		.map((s) => `${label}/scripts/${s}`);
	return { ok: true, scripts: [...scripts], missing, data };
}

function hooksWiring() {
	const p = join(root, "hooks.json");
	if (!existsSync(p)) {
		add("hooks.json", "fail", "파일 없음");
		return;
	}
	const mainRes = collectHookScripts(p, root, "lazyargon");
	if (!mainRes.ok) {
		add("hooks.json", "fail", mainRes.error);
		return;
	}
	let totalScripts = mainRes.scripts.length;
	const missing = [...mainRes.missing];

	const wsRoot = process.env.LAZYARGON_TEST_WS_ROOT || join(root, "..", "lazyargon-workspace");
	const wsHooksPath = join(wsRoot, "hooks.json");
	if (existsSync(wsHooksPath)) {
		const wsRes = collectHookScripts(wsHooksPath, wsRoot, "lazyargon-workspace");
		if (!wsRes.ok) {
			add("hooks.json", "fail", wsRes.error);
			return;
		}
		totalScripts += wsRes.scripts.length;
		missing.push(...wsRes.missing);
	}

	add(
		"hooks.scripts",
		missing.length ? "fail" : "ok",
		missing.length ? `없는 스크립트: ${missing.join(", ")}` : `${totalScripts}개 스크립트 존재 (lazyargon + workspace)`,
	);
	add(
		"hooks.session_start",
		mainRes.data.hooks?.SessionStart ? "ok" : "warn",
		mainRes.data.hooks?.SessionStart ? "SessionStart 배선됨" : "SessionStart 훅 없음 — 런타임 상태 주입 불가",
	);
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
	const wsRoot = join(root, "..", "lazyargon-workspace");
	const sibling = join(wsRoot, "scripts");
	if (!existsSync(sibling)) {
		add("guard_pack.sync", "warn", "인접 lazyargon-workspace 없음 — 동기화 검사 생략");
		return;
	}
	const drift = [];
	for (const g of ["markdown_structure_guard.mjs", "json_schema_guard.mjs", "stop_claim_guard.mjs"]) {
		const a = join(root, "scripts", g);
		const b = join(sibling, g);
		if (!existsSync(a) || !existsSync(b)) {
			drift.push(`${g}: 한쪽에 없음`);
			continue;
		}
		if (readFileSync(a, "utf8") !== readFileSync(b, "utf8")) drift.push(`${g}: 내용 상이`);
	}
	const gRoot = join(wsRoot, "GEMINI.md");
	const gRules = join(wsRoot, "rules", "GEMINI.md");
	if (existsSync(gRoot) && existsSync(gRules)) {
		if (!readFileSync(gRoot).equals(readFileSync(gRules))) {
			drift.push("GEMINI.md!=rules/GEMINI.md");
		}
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

function discoverLiveLanguageServer() {
	if (process.env.LAZYARGON_LS_RPC_MOCK_JSON) {
		return { mockJson: process.env.LAZYARGON_LS_RPC_MOCK_JSON };
	}
	if (process.platform === "win32") return null;
	const ps = spawnSync("ps", ["-ax", "-o", "pid=,command="], { encoding: "utf8", timeout: 2000 });
	if (ps.error || ps.status !== 0) return null;
	for (const line of (ps.stdout || "").split("\n")) {
		if (!line.includes("language_server") || !line.includes("--csrf_token")) continue;
		const pidMatch = line.trim().match(/^(\d+)\s+/);
		const tokenMatch = line.match(/--csrf_token[=\s]+([^\s]+)/);
		if (!pidMatch || !tokenMatch) continue;
		const pid = pidMatch[1];
		const token = tokenMatch[1];
		const lsof = spawnSync("lsof", ["-Pan", "-p", pid, "-iTCP", "-sTCP:LISTEN"], { encoding: "utf8", timeout: 2000 });
		if (lsof.error || lsof.status !== 0) continue;
		const ports = [...(lsof.stdout || "").matchAll(/127\.0\.0\.1:(\d+)/g)].map((m) => m[1]);
		if (ports.length > 0) return { pid, token, ports };
	}
	return null;
}

function liveRpcCheck() {
	const info = discoverLiveLanguageServer();
	if (!info) {
		add("antigravity.live_rpc", "ok", "language_server 미감지 (오프라인/헤드리스 — 정적 검사만 수행)");
		return;
	}
	let data = null;
	if (info.mockJson) {
		try {
			data = JSON.parse(info.mockJson);
		} catch (e) {
			add("antigravity.live_rpc", "fail", `모의 RPC JSON 파싱 실패: ${e.message}`);
			return;
		}
	} else {
		for (const port of info.ports) {
			const res = spawnSync(
				"curl",
				[
					"-sS",
					"-m",
					"2",
					"-X",
					"POST",
					`http://127.0.0.1:${port}/exa.language_server_pb.LanguageServerService/GetCustomizationStates`,
					"-H",
					`x-codeium-csrf-token: ${info.token}`,
					"-H",
					"Content-Type: application/json",
					"-d",
					"{}",
				],
				{ encoding: "utf8", timeout: 2500 },
			);
			if (!res.error && res.status === 0 && res.stdout && res.stdout.trim().startsWith("{")) {
				try {
					const parsed = JSON.parse(res.stdout);
					if (Array.isArray(parsed.states) || Array.isArray(parsed.customizations)) {
						data = parsed;
						break;
					}
				} catch {
					// try next port
				}
			}
		}
	}
	if (!data) {
		add("antigravity.live_rpc", "ok", "language_server RPC 응답 없음 (비활성 포트 — 정적 검사만 수행)");
		return;
	}
	const items = Array.isArray(data.states) ? data.states : Array.isArray(data.customizations) ? data.customizations : [];
	const pluginItems = items.filter((it) => {
		const s = JSON.stringify(it);
		return s.includes("lazyargon");
	});
	const errored = pluginItems.filter((it) => {
		const st = String(it.status || it.state || "");
		return /ERROR|INVALID|FAILED/i.test(st) || Boolean(it.error);
	});
	if (errored.length > 0) {
		const summary = errored.map((it) => `${it.name || it.path || "unknown"}(${it.status || it.error})`).join(", ");
		add("antigravity.live_rpc", "fail", `실시간 로더 오류 ${errored.length}건: ${summary}`);
		return;
	}
	const enabledCount = items.filter((it) => String(it.status || "").includes("ENABLED")).length;
	add("antigravity.live_rpc", "ok", `실시간 로더 정상 (전체 ENABLED ${enabledCount}개, lazyargon 계열 ${pluginItems.length}개, 오류 0건)`);
}

// google-research/harness2 (tree.py, prompts.py):
// (1) 스킬 폴더가 있어도 라우팅 표/규칙에서 언급되지 않으면 에이전트가 열지 않는 사문(dead weight)이 된다.
// (2) SKILL.md / rules/*.md 가 호출하는 scripts/<file>.(py|mjs|sh) 가 디스크에 없으면 런타임에 즉시 실패한다.
function skillsRoutingCoverage() {
	const extraRoot = process.env.LAZYARGON_TEST_SKILL_ROOT;
	const targets = [
		{
			label: "lazyargon",
			pluginRoot: extraRoot || root,
			indexFiles: [join(extraRoot || root, "rules", "AGENTS.md"), join(extraRoot || root, "docs", "keyword-routing.md")],
		},
	];
	const wsRoot = join(root, "..", "lazyargon-workspace");
	if (!extraRoot && existsSync(join(wsRoot, "skills"))) {
		targets.push({
			label: "lazyargon-workspace",
			pluginRoot: wsRoot,
			indexFiles: [join(wsRoot, "rules", "GEMINI.md"), join(wsRoot, "skills", "lazyforensic", "SKILL.md")],
		});
	}
	const unrouted = [];
	let totalSkills = 0;
	for (const t of targets) {
		const skillsDir = join(t.pluginRoot, "skills");
		if (!existsSync(skillsDir)) continue;
		const indexText = t.indexFiles
			.filter((f) => existsSync(f))
			.map((f) => readFileSync(f, "utf8"))
			.join("\n");
		for (const name of readdirSync(skillsDir)) {
			const skillMd = join(skillsDir, name, "SKILL.md");
			if (!existsSync(skillMd)) continue;
			totalSkills += 1;
			if (!indexText.includes(name)) {
				unrouted.push(`${t.label}/${name}`);
			}
		}
	}
	add(
		"skills.routing_coverage",
		unrouted.length ? "fail" : "ok",
		unrouted.length ? `라우팅 표 미등재(dead-weight) 스킬: ${unrouted.join(", ")}` : `${totalSkills}개 스킬 라우팅 표 등재 확인`,
	);
}

function skillsScriptRefs() {
	const extraRoot = process.env.LAZYARGON_TEST_SKILL_ROOT;
	const roots = extraRoot ? [extraRoot] : [root, join(root, "..", "lazyargon-workspace")].filter((r) => existsSync(join(r, "skills")));
	const rx = /(?:python3?|node)\s+(?:-[A-Za-z0-9]+\s+)*["']?((?:\.\/)?(?:skills\/[a-z0-9_-]+\/)?scripts\/[A-Za-z0-9_.-]+\.(?:py|mjs|sh))["']?/g;
	const missing = [];
	let checked = 0;
	for (const r of roots) {
		const mdFiles = [];
		const rulesDir = join(r, "rules");
		if (existsSync(rulesDir)) {
			for (const f of readdirSync(rulesDir)) if (f.endsWith(".md")) mdFiles.push({ file: join(rulesDir, f), skillDir: null });
		}
		const skillsDir = join(r, "skills");
		if (existsSync(skillsDir)) {
			for (const name of readdirSync(skillsDir)) {
				const sdir = join(skillsDir, name);
				const smd = join(sdir, "SKILL.md");
				if (existsSync(smd)) mdFiles.push({ file: smd, skillDir: sdir });
			}
		}
		for (const { file, skillDir } of mdFiles) {
			const text = readFileSync(file, "utf8");
			for (const m of text.matchAll(rx)) {
				const rawRel = m[1].replace(/^\.\//, "");
				if (/^(?:xxx|example|your_|sample)/i.test(rawRel.split("/").pop() || "")) continue;
				checked += 1;
				const inPlugin = join(r, rawRel);
				const inSkill = skillDir ? join(skillDir, rawRel) : null;
				if (!existsSync(inPlugin) && (!inSkill || !existsSync(inSkill))) {
					missing.push(`${file}: ${rawRel}`);
				}
			}
		}
	}
	add(
		"skills.script_refs",
		missing.length ? "fail" : "ok",
		missing.length ? `존재하지 않는 스크립트 참조: ${missing.join("; ")}` : `${checked}개 스크립트 호출 경로 실존 확인`,
	);
}

function skillsSourceReceipts() {
	const radarScript = join(root, "scripts", "upstream_radar.mjs");
	const receiptsFile = join(root, "docs", "skill-source-receipts.json");
	if (!existsSync(radarScript) || !existsSync(receiptsFile)) {
		add("skills.source_receipts", "warn", "upstream_radar.mjs 또는 docs/skill-source-receipts.json 없음");
		return;
	}
	const res = spawnSync("node", [radarScript, "audit", "--json"], { cwd: root, encoding: "utf8", timeout: 3000 });
	if (res.error || !res.stdout) {
		add("skills.source_receipts", "fail", `업스트림 영수증 감사 실패: ${(res.error?.message || res.stderr || "").trim()}`);
		return;
	}
	try {
		const data = JSON.parse(res.stdout);
		add(
			"skills.source_receipts",
			data.ok ? "ok" : "fail",
			data.ok
				? `${data.source_count}개 업스트림 영수증 (40자 SHA 핀 ${data.pinned_verified}개 / 미확인 ${data.pinned_unverified}개), ${data.verified_targets}개 타겟 실존`
				: `부정확한 핀: ${(data.invalid_sources || []).join(", ") || "없음"}; 누락 타겟: ${(data.missing_targets || []).join(", ") || "없음"}`,
		);
	} catch (e) {
		add("skills.source_receipts", "fail", `영수증 JSON 파싱 실패: ${e.message}`);
	}
}

nodeVersion();
pythonVersion();
hooksWiring();
skillsFrontmatter();
skillsRoutingCoverage();
skillsScriptRefs();
skillsSourceReceipts();
guardParity();
manifestVersions();
scopeLock();
modelProvider();
rulesBudget();
descriptionColons();
liveRpcCheck();

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
