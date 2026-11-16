/**
 * test/classify-task.test.mjs
 *
 * Tests for scripts/classify-task.mjs
 * Covers: classification of 40+ realistic Korean and English prompts,
 * JSON schema validation, action/size rules, and SKILL.md model-name hygiene.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "scripts", "classify-task.mjs");
const ROUTING_PATH = path.join(ROOT, "skills", "ulw", "references", "model-routing.json");
const SKILL_PATH = path.join(ROOT, "skills", "ulw", "SKILL.md");

function classify(prompt) {
	const res = spawnSync("node", [SCRIPT, prompt], { encoding: "utf8", cwd: ROOT });
	assert.equal(res.status, 0, `classifier exited ${res.status} for: ${prompt}\nstderr: ${res.stderr}`);
	return JSON.parse(res.stdout);
}

// ── JSON schema ──────────────────────────────────────────────────────────────

const REQUIRED_FIELDS = ["kind", "size", "model", "mode", "reason", "verified_path", "action", "session_notice", "prompt"];
// Valid kinds come from model-routing.json task_kinds plus "general", so adding a kind there needs no test edit.
const VALID_KINDS = new Set([...Object.keys(JSON.parse(fs.readFileSync(new URL("../skills/ulw/references/model-routing.json", import.meta.url), "utf8")).task_kinds), "general"]);
const VALID_SIZES = new Set(["single", "subagents"]);

function assertSchema(result, label) {
	for (const f of REQUIRED_FIELDS) {
		assert.ok(Object.prototype.hasOwnProperty.call(result, f), `${label}: missing field "${f}"`);
	}
	assert.ok(VALID_KINDS.has(result.kind), `${label}: invalid kind "${result.kind}"`);
	assert.ok(VALID_SIZES.has(result.size), `${label}: invalid size "${result.size}"`);
	assert.ok(VALID_SIZES.has(result.mode), `${label}: invalid mode "${result.mode}"`);
	assert.equal(typeof result.model, "string", `${label}: model must be string`);
	assert.ok(result.model.length > 0, `${label}: model must be non-empty`);
	assert.equal(typeof result.reason, "string", `${label}: reason must be string`);
	assert.equal(typeof result.verified_path, "string", `${label}: verified_path must be string`);
	assert.equal(typeof result.action, "string", `${label}: action must be string`);
	assert.ok(result.action.length > 0, `${label}: action must be non-empty`);
	assert.ok(
		result.session_notice === null || typeof result.session_notice === "string",
		`${label}: session_notice must be null or string`,
	);
	assert.ok(
		result.prompt === null || result.prompt === "v2",
		`${label}: prompt must be null or "v2", got "${result.prompt}"`,
	);
	assert.equal(result.mode, result.size, `${label}: mode must equal size`);
}

// ── Regression: previously misclassified as "general" ───────────────────────

test("FIX: '이 PR 리뷰해줘' → judgment", () => {
	const r = classify("이 PR 리뷰해줘");
	assertSchema(r, "FIX PR");
	assert.equal(r.kind, "judgment");
});

test("FIX: '300페이지 판결문 요약해줘' → long_context", () => {
	const r = classify("300페이지 판결문 요약해줘");
	assertSchema(r, "FIX 판결문");
	assert.equal(r.kind, "long_context");
});

test("FIX: 'src/a.ts src/b.ts src/c.ts src/d.ts 각각 리팩터링' → size subagents", () => {
	const r = classify("src/a.ts src/b.ts src/c.ts src/d.ts 각각 리팩터링");
	assertSchema(r, "FIX file paths");
	assert.equal(r.size, "subagents");
});

test("FIX: 'print the config' → not judgment (PR is a whole word only)", () => {
	const r = classify("print the config");
	assertSchema(r, "FIX print");
	assert.notEqual(r.kind, "judgment");
});

test("FIX: 'process the queue' → not judgment", () => {
	const r = classify("process the queue");
	assertSchema(r, "FIX process");
	assert.notEqual(r.kind, "judgment");
});

test("FIX: 'review this pr' → judgment", () => {
	const r = classify("review this pr");
	assertSchema(r, "FIX review pr");
	assert.equal(r.kind, "judgment");
});

test("FIX: '개인정보 마스킹 구현해줘' → sensitive with v2 (a matched sensitive signal beats a higher implementation score)", () => {
	const r = classify("개인정보 마스킹 구현해줘");
	assertSchema(r, "FIX PII implement");
	assert.equal(r.kind, "sensitive");
	assert.equal(r.prompt, "v2");
});

// ── Rule kinds: each carries its role rule plus the common rule ──────────

const ROUTING = JSON.parse(fs.readFileSync(ROUTING_PATH, "utf8"));

for (const [prompt, kind] of [
	["E01 검토해서 보고서 써줘", "forensic_verdict"],
	["카톡 대화에서 발신 건수 세줘", "count_extract"],
	["녹취 파일 20개 전사해줘", "media_transcribe"],
	["rename all screenshots to include the date", "mechanical"],
]) {
	test(`rule kind: '${prompt}' → ${kind} with its role rule and the common rule`, () => {
		const r = classify(prompt);
		assertSchema(r, prompt);
		assert.equal(r.kind, kind);
		assert.ok(r.rules.includes(ROUTING.roles[ROUTING.task_kinds[kind].role].rule));
		assert.equal(r.rules.at(-1), ROUTING.common_rule);
	});
}

test("rule kinds: a prompt matching two kinds gets both rules", () => {
	const r = classify("증거 파일 해시값 다시 계산해서 비교해줘");
	for (const role of ["forensic_verdict", "script_first"]) {
		assert.ok(r.rules.includes(ROUTING.roles[role].rule), `missing ${role} rule`);
	}
});

// ── Regression: single-size tasks must NOT delegate ─────────────────────────

test("FIX: '이 스크립트 오타 하나 고쳐줘' → size single → action proceed in session", () => {
	const r = classify("이 스크립트 오타 하나 고쳐줘");
	assertSchema(r, "FIX typo fix");
	assert.equal(r.size, "single");
	assert.equal(r.action, "proceed in session");
});

// ── Regression: scale-word size detection ────────────────────────────────────

test("FIX: '프로젝트 전체 폴더 구조 정리하고 모듈 6개 새로 만들어' → size subagents", () => {
	const r = classify("프로젝트 전체 폴더 구조 정리하고 모듈 6개 새로 만들어");
	assertSchema(r, "FIX 모듈 6개");
	assert.equal(r.size, "subagents");
});

// ── English judgment ──────────────────────────────────────────────────────────

test("EN judgment: 'review this code for correctness'", () => {
	const r = classify("review this code for correctness");
	assertSchema(r, "EN judge 1");
	assert.equal(r.kind, "judgment");
});

test("EN judgment: 'audit the security of the auth module'", () => {
	const r = classify("audit the security of the auth module");
	assertSchema(r, "EN judge 2");
	assert.equal(r.kind, "judgment");
});

test("EN judgment: 'verify the output of the pipeline'", () => {
	const r = classify("verify the output of the pipeline");
	assertSchema(r, "EN judge 3");
	assert.equal(r.kind, "judgment");
});

// ── Korean judgment ───────────────────────────────────────────────────────────

test("KO judgment: '이 코드를 검토해줘'", () => {
	const r = classify("이 코드를 검토해줘");
	assertSchema(r, "KO judge 1");
	assert.equal(r.kind, "judgment");
});

test("KO judgment: '결과가 올바른지 검증해줘'", () => {
	const r = classify("결과가 올바른지 검증해줘");
	assertSchema(r, "KO judge 2");
	assert.equal(r.kind, "judgment");
});

test("KO security audit: '보안 감사 진행해줘' routes to security_audit with the v2 rule", () => {
	const r = classify("보안 감사 진행해줘");
	assertSchema(r, "KO audit 1");
	assert.equal(r.kind, "security_audit");
	assert.equal(r.prompt, "v2");
});

test("KO security audit: 'API 키 노출 같은 취약점 있는지 봐줘'", () => {
	const r = classify("API 키 노출 같은 취약점 있는지 봐줘");
	assertSchema(r, "KO audit 2");
	assert.equal(r.kind, "security_audit");
	assert.equal(r.prompt, "v2");
});

test("KO plan: '이 기능 설계 계획 세워줘' reaches the plan role", () => {
	const r = classify("이 기능 설계 계획 세워줘");
	assertSchema(r, "KO plan 1");
	assert.equal(r.kind, "plan");
	assert.equal(r.action, "proceed in session");
});

test("judgment stays without the v2 rule", () => {
	const r = classify("이 PR 리뷰해줘");
	assert.equal(r.kind, "judgment");
	assert.equal(r.prompt, null);
});

test("KO judgment: '이 로직 맞는지 검토 부탁해'", () => {
	const r = classify("이 로직 맞는지 검토 부탁해");
	assertSchema(r, "KO judge 4");
	assert.equal(r.kind, "judgment");
});

// ── English implementation ────────────────────────────────────────────────────

test("EN implementation: 'implement the new auth flow'", () => {
	const r = classify("implement the new auth flow");
	assertSchema(r, "EN impl 1");
	assert.equal(r.kind, "implementation");
});

test("EN implementation: 'fix the bug in the login handler'", () => {
	const r = classify("fix the bug in the login handler");
	assertSchema(r, "EN impl 2");
	assert.equal(r.kind, "implementation");
});

test("EN implementation: 'refactor the database layer'", () => {
	const r = classify("refactor the database layer");
	assertSchema(r, "EN impl 3");
	assert.equal(r.kind, "implementation");
});

// ── Korean implementation ─────────────────────────────────────────────────────

test("KO implementation: '새 기능 구현해줘'", () => {
	const r = classify("새 기능 구현해줘");
	assertSchema(r, "KO impl 1");
	assert.equal(r.kind, "implementation");
});

test("KO implementation: '버그 고쳐줘'", () => {
	const r = classify("버그 고쳐줘");
	assertSchema(r, "KO impl 2");
	assert.equal(r.kind, "implementation");
});

test("KO implementation: '이 모듈 리팩터링 해줘'", () => {
	const r = classify("이 모듈 리팩터링 해줘");
	assertSchema(r, "KO impl 3");
	assert.equal(r.kind, "implementation");
});

// ── long_execution ────────────────────────────────────────────────────────────

test("EN long_execution: 'use tdd until tests pass'", () => {
	const r = classify("use tdd until tests pass");
	assertSchema(r, "EN long_exec 1");
	assert.equal(r.kind, "long_execution");
});

test("EN long_execution: 'fix and test the flaky integration suite'", () => {
	const r = classify("fix and test the flaky integration suite");
	assertSchema(r, "EN long_exec 2");
	assert.equal(r.kind, "long_execution");
});

test("KO long_execution: '테스트 통과할 때까지 반복 실행해줘'", () => {
	const r = classify("테스트 통과할 때까지 반복 실행해줘");
	assertSchema(r, "KO long_exec 1");
	assert.equal(r.kind, "long_execution");
});

// ── sensitive ─────────────────────────────────────────────────────────────────

test("EN sensitive: 'check for pii in the user logs'", () => {
	const r = classify("check for pii in the user logs");
	assertSchema(r, "EN sensitive 1");
	assert.equal(r.kind, "sensitive");
});

test("EN sensitive: 'prompt injection scan on this input'", () => {
	const r = classify("prompt injection scan on this input");
	assertSchema(r, "EN sensitive 2");
	assert.equal(r.kind, "sensitive");
});

test("KO sensitive: '개인정보 포함 여부 확인해줘'", () => {
	const r = classify("개인정보 포함 여부 확인해줘");
	assertSchema(r, "KO sensitive 1");
	assert.equal(r.kind, "sensitive");
});

test("KO sensitive: '주민번호 노출 여부 점검해줘'", () => {
	const r = classify("주민번호 노출 여부 점검해줘");
	assertSchema(r, "KO sensitive 2");
	assert.equal(r.kind, "sensitive");
});

test("KO sensitive: '프롬프트 인젝션 검사해줘'", () => {
	const r = classify("프롬프트 인젝션 검사해줘");
	assertSchema(r, "KO sensitive 3");
	assert.equal(r.kind, "sensitive");
});

// ── long_context ──────────────────────────────────────────────────────────────

test("EN long_context: 'analyze the entire codebase all files'", () => {
	const r = classify("analyze the entire codebase all files");
	assertSchema(r, "EN long_ctx 1");
	assert.equal(r.kind, "long_context");
});

test("KO long_context: '전체 저장소 분석해줘'", () => {
	const r = classify("전체 저장소 분석해줘");
	assertSchema(r, "KO long_ctx 1");
	assert.equal(r.kind, "long_context");
});

test("KO long_context: '300페이지 판결문 요약해줘'", () => {
	const r = classify("300페이지 판결문 요약해줘");
	assertSchema(r, "KO long_ctx 2");
	assert.equal(r.kind, "long_context");
});

test("KO long_context: '수백 페이지 기록 분석해줘'", () => {
	const r = classify("수백 페이지 기록 분석해줘");
	assertSchema(r, "KO long_ctx 3");
	assert.equal(r.kind, "long_context");
});

// ── Size: file paths ──────────────────────────────────────────────────────────

test("size: 4 explicit .ts file paths → subagents", () => {
	const r = classify("src/a.ts src/b.ts src/c.ts src/d.ts 각각 리팩터링");
	assertSchema(r, "size 4 paths");
	assert.equal(r.size, "subagents");
});

test("size: '3 files' → subagents", () => {
	const r = classify("implement changes across 3 files");
	assertSchema(r, "size 3files");
	assert.equal(r.size, "subagents");
});

test("size: '1 file' → single", () => {
	const r = classify("fix the bug in 1 file");
	assertSchema(r, "size 1file");
	assert.equal(r.size, "single");
});

// ── Size: Korean N개 patterns ─────────────────────────────────────────────────

test("size: '모듈 6개 새로 만들어' → subagents", () => {
	const r = classify("프로젝트 전체 폴더 구조 정리하고 모듈 6개 새로 만들어");
	assertSchema(r, "size 모듈 6개");
	assert.equal(r.size, "subagents");
});

test("size: '파일 5개 수정해줘' → subagents", () => {
	const r = classify("파일 5개 수정해줘");
	assertSchema(r, "size 파일 5개");
	assert.equal(r.size, "subagents");
});

test("size: '5개 파일' → subagents", () => {
	const r = classify("5개 파일 각각 고쳐줘");
	assertSchema(r, "size 5개 파일");
	assert.equal(r.size, "subagents");
});

test("size: '파일 2개' → single (below threshold)", () => {
	const r = classify("파일 2개만 수정해줘");
	assertSchema(r, "size 파일 2개");
	assert.equal(r.size, "single");
});

// ── Size: scale-word signals ──────────────────────────────────────────────────

test("size: '전체 폴더' → subagents", () => {
	const r = classify("전체 폴더 구조 정리해줘");
	assertSchema(r, "size 전체 폴더");
	assert.equal(r.size, "subagents");
});

test("size: '모든 파일' → subagents", () => {
	const r = classify("모든 파일 업데이트해줘");
	assertSchema(r, "size 모든 파일");
	assert.equal(r.size, "subagents");
});

test("size: 'across the repo' → subagents", () => {
	const r = classify("implement changes across the repo");
	assertSchema(r, "size across the repo");
	assert.equal(r.size, "subagents");
});

test("size: 'parallel' keyword → subagents", () => {
	const r = classify("implement in parallel lanes");
	assertSchema(r, "size parallel");
	assert.equal(r.size, "subagents");
});

test("size: '독립적' → subagents", () => {
	const r = classify("독립적인 모듈 세 개 구현해줘");
	assertSchema(r, "size 독립적");
	assert.equal(r.size, "subagents");
});

test("size: default (no signal) → single", () => {
	const r = classify("implement the login form");
	assertSchema(r, "size single default");
	assert.equal(r.size, "single");
});

// ── action: single = proceed in session ──────────────────────────────────────

test("action: single+Argon → 'proceed in session' (not delegate)", () => {
	const r = classify("review and audit");
	assertSchema(r, "action single Argon");
	assert.equal(r.size, "single");
	assert.equal(r.action, "proceed in session");
});

test("action: single+Argon implementation → 'proceed in session'", () => {
	const r = classify("이 스크립트 오타 하나 고쳐줘");
	assertSchema(r, "action single impl");
	assert.equal(r.action, "proceed in session");
});

test("action: single+sensitive → 'proceed in session, apply v2 flag/fail rule'", () => {
	const r = classify("check for pii in logs");
	assertSchema(r, "action single sensitive");
	assert.equal(r.size, "single");
	assert.equal(r.action, "proceed in session, apply v2 flag/fail rule");
});

// ── action: subagents = delegate ──────────────────────────────────────────────

test("action: subagents+Argon → delegate via invoke_subagent", () => {
	const r = classify("implement changes across 3 files");
	assertSchema(r, "action subagents Argon");
	assert.equal(r.size, "subagents");
	assert.ok(r.action.startsWith('delegate via invoke_subagent Model: "pro"'));
});

test("action: subagents+sensitive → delegate + v2 rule", () => {
	const r = classify("check for pii across 3 files");
	assertSchema(r, "action subagents sensitive");
	assert.equal(r.size, "subagents");
	assert.ok(r.action.includes('delegate via invoke_subagent'));
	assert.ok(r.action.includes("apply v2 flag/fail rule"));
});

// ── action: Hydrogen/Carbon → proceed in session model + notice ───────────────

test("action: long_execution (Hydrogen) → proceed in session model + notice", () => {
	const r = classify("tdd until tests pass");
	assertSchema(r, "action Hydrogen");
	assert.equal(r.action, "proceed in session model + notice");
});

test("action: long_context (Carbon) → proceed in session model + notice", () => {
	const r = classify("analyze the entire codebase");
	assertSchema(r, "action Carbon");
	assert.equal(r.action, "proceed in session model + notice");
});

// ── verified_path ─────────────────────────────────────────────────────────────

test("verified_path: Argon → invoke_subagent Model: \"pro\" (only verified path)", () => {
	const r = classify("review this module");
	assert.equal(r.verified_path, 'invoke_subagent Model: "pro"');
});

test("verified_path: Hydrogen → unverified-nested", () => {
	const r = classify("tdd until tests pass");
	assert.equal(r.verified_path, "unverified-nested");
});

test("verified_path: Carbon → unverified-nested", () => {
	const r = classify("analyze the entire codebase");
	assert.equal(r.verified_path, "unverified-nested");
});

// ── session_notice ────────────────────────────────────────────────────────────

test("session_notice: null for Argon tasks", () => {
	const r = classify("review and audit the code");
	assert.equal(r.session_notice, null);
});

test("session_notice: set for Hydrogen-routed tasks", () => {
	const r = classify("tdd until tests pass");
	assert.ok(typeof r.session_notice === "string" && r.session_notice.length > 0);
});

// ── prompt field ──────────────────────────────────────────────────────────────

test("prompt: null for non-sensitive tasks", () => {
	const r = classify("implement new feature");
	assert.equal(r.prompt, null);
});

test("prompt: 'v2' for sensitive tasks", () => {
	const r = classify("check for pii in logs");
	assert.equal(r.prompt, "v2");
});

// ── general fallback ──────────────────────────────────────────────────────────

test("general: unrecognised prompt → default role, proceed in session", () => {
	const r = classify("what is the meaning of life");
	assertSchema(r, "general fallback");
	assert.equal(r.kind, "general");
	assert.equal(r.action, "proceed in session");
	const routing = JSON.parse(fs.readFileSync(ROUTING_PATH, "utf8"));
	assert.equal(r.model, routing.roles.default.model);
});

// ── SKILL.md hygiene ──────────────────────────────────────────────────────────

test("SKILL.md: no gemini-4-* model IDs in body", () => {
	const text = fs.readFileSync(SKILL_PATH, "utf8");
	const hits = text.match(/gemini-4-[a-z]+-(?:high|xhigh|medium|low)/g);
	assert.equal(hits, null, `SKILL.md must not contain model IDs; found: ${hits}`);
});

test("SKILL.md: references classify-task.mjs", () => {
	const text = fs.readFileSync(SKILL_PATH, "utf8");
	assert.ok(text.includes("classify-task.mjs"));
});

test("SKILL.md: mentions v2 flag/fail rule for sensitive tasks", () => {
	const text = fs.readFileSync(SKILL_PATH, "utf8");
	assert.ok(text.includes("v2 flag/fail"));
});

// ── model-routing.json structure ──────────────────────────────────────────────

test("model-routing.json: has task_kinds with ≥5 kinds", () => {
	const routing = JSON.parse(fs.readFileSync(ROUTING_PATH, "utf8"));
	assert.ok(routing.task_kinds);
	assert.ok(Object.keys(routing.task_kinds).length >= 5);
});

test("model-routing.json: each task_kind has role + signals", () => {
	const routing = JSON.parse(fs.readFileSync(ROUTING_PATH, "utf8"));
	for (const [kind, def] of Object.entries(routing.task_kinds)) {
		assert.ok(def.role, `${kind}: missing role`);
		assert.ok(Array.isArray(def.signals?.keywords), `${kind}: missing keywords`);
		assert.ok(Array.isArray(def.signals?.patterns), `${kind}: missing patterns`);
	}
});

test("model-routing.json: task_kind roles exist in roles section", () => {
	const routing = JSON.parse(fs.readFileSync(ROUTING_PATH, "utf8"));
	for (const [kind, def] of Object.entries(routing.task_kinds)) {
		assert.ok(routing.roles[def.role], `${kind}.role "${def.role}" not in roles`);
	}
});

test("model-routing.json: subagents has size_signals array", () => {
	const routing = JSON.parse(fs.readFileSync(ROUTING_PATH, "utf8"));
	assert.ok(Array.isArray(routing.modes?.subagents?.size_signals));
	assert.ok(routing.modes.subagents.size_signals.length >= 5);
});

test("transcription tasks carry the routed STT model, and the tool_first rule names the same model", () => {
	const stt = ROUTING.roles.tool_first.stt_model;
	assert.equal(classify("녹취 파일 20개 전사해줘").stt_model, stt);
	assert.ok(ROUTING.roles.tool_first.rule.includes(stt), "tool_first rule text names a different STT model than stt_model");
	assert.equal(classify("이 PR 리뷰해줘").stt_model, null);
});
