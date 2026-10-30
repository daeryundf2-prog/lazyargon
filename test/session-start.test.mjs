import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "scripts", "session_start.mjs");
const WS_SCRIPT = path.join(ROOT, "..", "lazyargon-workspace", "scripts", "session_start.mjs");

function run(payload, cwd, env = {}, scriptPath = SCRIPT) {
	const e = { ...process.env, ...env };
	delete e.ANTIGRAVITY_MODEL_NAME;
	delete e.ANTIGRAVITY_MODEL;
	return spawnSync("node", [scriptPath], { cwd, input: payload, encoding: "utf8", env: e });
}

test("#given host modelName #when session starts #then runtime block quotes it and is valid JSON", () => {
	const res = run(JSON.stringify({ hook_event_name: "SessionStart", modelName: "gemini-4-argon" }), ROOT);
	assert.equal(res.status, 0, res.stderr);
	const out = JSON.parse(res.stdout);
	assert.match(out.additionalContext, /세션 모델: gemini-4-argon/);
	assert.equal(out.hookSpecificOutput.hookEventName, "SessionStart");
	assert.doesNotMatch(out.additionalContext, /Argon이라고 가정하지 말 것/);
});

test("#given workspacePaths: [tmpDir] #when session_start.mjs runs from unrelated cwd #then resolves .lazyargon from workspacePaths[0]", () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lazyargon-wspaths-"));
	try {
		fs.mkdirSync(path.join(tmp, ".lazyargon"), { recursive: true });
		fs.writeFileSync(path.join(tmp, ".lazyargon", "ulw-scope.md"), "목표: workspacePaths 우선 해석\n완료 조건: 테스트 통과\n", "utf8");
		fs.writeFileSync(path.join(tmp, ".lazyargon", "pins.md"), "- ws_pin: deadbeef1234\n", "utf8");

		const payload = JSON.stringify({
			hook_event_name: "SessionStart",
			modelName: "gemini-4-argon",
			workspacePaths: [tmp],
		});
		const res = run(payload, os.tmpdir());
		assert.equal(res.status, 0, res.stderr);
		const out = JSON.parse(res.stdout);
		assert.match(out.additionalContext, /목표: workspacePaths 우선 해석/);
		assert.match(out.additionalContext, /- ws_pin: deadbeef1234/);
		assert.ok(out.additionalContext.includes(tmp));

		if (fs.existsSync(WS_SCRIPT)) {
			const wsRes = run(payload, os.tmpdir(), {}, WS_SCRIPT);
			assert.equal(wsRes.status, 0, wsRes.stderr);
			const wsOut = JSON.parse(wsRes.stdout);
			assert.match(wsOut.additionalContext, /목표: workspacePaths 우선 해석/);
			assert.match(wsOut.additionalContext, /- ws_pin: deadbeef1234/);
			assert.ok(Buffer.byteLength(wsOut.additionalContext, "utf8") < 2048, "workspace session_start should not duplicate full 11.6KB GEMINI.md");
		}
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
});
