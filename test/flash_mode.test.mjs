import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { flashModeContext, modeFor } from "../scripts/flash_mode.mjs";
import { body, outline, render } from "../scripts/skeleton.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("#given host model ids #when modeFor #then 3.8 Flash and Argon are told apart and the rest is other", () => {
	assert.equal(modeFor("gemini-3.8-flash-low"), "flash");
	assert.equal(modeFor("gemini-3.8-flash-high"), "flash");
	assert.equal(modeFor("gemini-4-argon-medium"), "argon");
	assert.equal(modeFor("gemini-4-carbon-medium"), "argon");
	assert.equal(modeFor("gemini-3.8-flash-lite"), "other");
	assert.equal(modeFor("claude-sonnet-5-5-high"), "other");
	assert.equal(modeFor("unknown"), "other");
	assert.equal(modeFor(undefined), "other");
});

test("#given each mode #when flashModeContext #then thinking budget is Flash-only and the edit guard is in both", () => {
	const flash = flashModeContext("gemini-3.8-flash-medium");
	const argon = flashModeContext("gemini-4-argon-high");
	assert.match(flash, /사고 예산 \(3\.8 Flash 전용\)/);
	assert.doesNotMatch(argon, /사고 예산 \(3\.8 Flash 전용\)/);
	for (const ctx of [flash, argon]) assert.match(ctx, /--body <이름>/);
	assert.equal(flashModeContext("unknown"), "");
});

test("#given session_start #when run with each model #then the mode block follows the reported model", () => {
	const run = (modelName) => {
		const env = { ...process.env };
		delete env.ANTIGRAVITY_MODEL_NAME;
		delete env.ANTIGRAVITY_MODEL;
		const res = spawnSync("node", [path.join(ROOT, "scripts", "session_start.mjs")], {
			cwd: os.tmpdir(),
			input: JSON.stringify({ modelName }),
			encoding: "utf8",
			env,
		});
		assert.equal(res.status, 0, res.stderr);
		return JSON.parse(res.stdout).injectSteps[0].systemMessage.systemMessage;
	};
	assert.match(run("gemini-3.8-flash-low"), /효율 모드: Flash/);
	assert.match(run("gemini-4-argon-low"), /효율 모드: Argon/);
	assert.match(run("gemini-4-carbon-medium"), /효율 모드: Argon \(Carbon 공유\)/);
	assert.match(run("gemini-4-carbon-medium"), /세션 모델: gemini-4-carbon-medium/);
	assert.doesNotMatch(run("claude-sonnet-5-5-low"), /효율 모드/);
});

const JS = `export function alpha(a) {
  if (a) {
    return 1;
  }
  return 2;
}

const beta = async (x) => {
  return x + "}";
};

class Gamma {
  run(n) {
    return n;
  }
}
`;

test("#given a JS file #when outline #then ranges cover whole declarations including braces in strings", () => {
	const items = outline(JS, "a.js");
	const by = Object.fromEntries(items.map((i) => [i.name, i]));
	assert.deepEqual([by.alpha.start, by.alpha.end], [1, 6]);
	assert.deepEqual([by.beta.start, by.beta.end], [8, 10]);
	assert.deepEqual([by.Gamma.start, by.Gamma.end], [12, 16]);
	assert.deepEqual([by.run.start, by.run.end], [13, 15]);
	assert.doesNotMatch(render(items), /return 1/, "skeleton must not print bodies");
	assert.match(render(items, "gam"), /Gamma/);
	assert.doesNotMatch(render(items, "gam"), /alpha/);
});

test("#given a Python file #when outline and body #then indentation bounds the function", () => {
	const py = "def a():\n    x = 1\n    return x\n\ndef b():\n    return 2\n";
	const items = outline(py, "m.py");
	assert.deepEqual(items.map((i) => [i.name, i.start, i.end]), [["a", 1, 3], ["b", 5, 6]]);
	assert.match(body(py, "a", "m.py"), /x = 1\n    return x/);
	assert.doesNotMatch(body(py, "a", "m.py"), /return 2/);
});

test("#given the CLI #when --body of an existing and a missing name #then full body prints or exit 1", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lazyargon-skel-"));
	try {
		const f = path.join(dir, "a.js");
		fs.writeFileSync(f, JS);
		const cli = (...args) => spawnSync("node", [path.join(ROOT, "scripts", "skeleton.mjs"), f, ...args], { encoding: "utf8" });
		const ok = cli("--body", "alpha");
		assert.equal(ok.status, 0, ok.stderr);
		assert.match(ok.stdout, /return 1;/);
		const outl = cli();
		assert.match(outl.stdout, /L8-10 const beta/);
		assert.match(outl.stdout, /검색 전용/);
		assert.equal(cli("--body", "nope").status, 1);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});
