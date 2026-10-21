import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "scripts", "session_start.mjs");

function run(payload, cwd, env = {}) {
	const e = { ...process.env, ...env };
	delete e.ANTIGRAVITY_MODEL_NAME;
	delete e.ANTIGRAVITY_MODEL;
	return spawnSync("node", [SCRIPT], { cwd, input: payload, encoding: "utf8", env: e });
}

test("#given host modelName #when session starts #then runtime block quotes it and is valid JSON", () => {
	const res = run(JSON.stringify({ hook_event_name: "SessionStart", modelName: "gemini-4-argon" }), ROOT);
	assert.equal(res.status, 0, res.stderr);
	const out = JSON.parse(res.stdout);
	assert.match(out.additionalContext, /세션 모델: gemini-4-argon/);
	assert.equal(out.hookSpecificOutput.hookEventName, "SessionStart");
	assert.doesNotMatch(out.additionalContext, /Argon이라고 가정하지 말 것/);
});

test("#given no model in payload #when session starts #then model is unknown, never inferred", () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lazyargon-nosession-"));
	try {
		const res = run("{}", tmp);
		assert.equal(res.status, 0, res.stderr);
		const out = JSON.parse(res.stdout);
		assert.match(out.additionalContext, /세션 모델: unknown/);
		assert.match(out.additionalContext, /범위 잠금 \(\.lazyargon\/ulw-scope\.md\)\n\n없음/);
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
});

test("#given .lazyargon/ulw-scope.md in cwd #when session starts #then scope lock head is injected", () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lazyargon-scope-"));
	try {
		fs.mkdirSync(path.join(tmp, ".lazyargon"));
		fs.writeFileSync(path.join(tmp, ".lazyargon", "ulw-scope.md"), "목표: 훅 테스트\n완료 조건: node --test\n범위: scripts/\n예산: 4 레인 / 2 웨이브\n", "utf8");
		const pins = Array.from({ length: 25 }, (_, i) => `- id${i}: ${"a".repeat(8)}${i}`).join("\n");
		fs.writeFileSync(path.join(tmp, ".lazyargon", "pins.md"), `${pins}\n`, "utf8");
		const res = run("{}", tmp);
		assert.equal(res.status, 0, res.stderr);
		const out = JSON.parse(res.stdout);
		assert.match(out.additionalContext, /목표: 훅 테스트/);
		assert.match(out.additionalContext, /예산: 4 레인/);
		assert.match(out.additionalContext, /고정 식별자 \(\.lazyargon\/pins\.md/);
		assert.match(out.additionalContext, /- id19: a{8}19/);
		assert.doesNotMatch(out.additionalContext, /- id20:/);
		assert.match(out.additionalContext, /5줄 생략 — 파일을 직접 읽을 것/);
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
});
