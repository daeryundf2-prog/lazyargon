import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("#given repo #when doctor --json runs #then every structural check is ok and exit is 0", () => {
	const res = spawnSync("node", [path.join(ROOT, "scripts", "doctor.mjs"), "--json"], { cwd: ROOT, encoding: "utf8" });
	assert.equal(res.status, 0, res.stdout + res.stderr);
	const data = JSON.parse(res.stdout);
	assert.equal(data.ok, true);
	const byId = Object.fromEntries(data.checks.map((c) => [c.id, c]));
	for (const id of ["node", "hooks.scripts", "hooks.session_start", "skills", "versions"]) {
		assert.equal(byId[id]?.status, "ok", `${id}: ${byId[id]?.detail}`);
	}
	assert.ok(["ok", "warn"].includes(byId["guard_pack.sync"].status), byId["guard_pack.sync"].detail);
	assert.ok(byId["antigravity.model_provider"], "model provider check present");
	assert.equal(byId["rules.budget"]?.status, "ok", byId["rules.budget"]?.detail);
	assert.equal(byId["frontmatter.description_colon"]?.status, "ok", byId["frontmatter.description_colon"]?.detail);
});

test("#given rules/AGENTS.md #when measured #then it stays under the per-file budget that avoids silent exclusion", () => {
	const bytes = Buffer.byteLength(fs.readFileSync(path.join(ROOT, "rules", "AGENTS.md"), "utf8"), "utf8");
	assert.ok(bytes <= 12000, `rules/AGENTS.md is ${bytes}B; keep it ≤12000B (antigravity-cli #1254)`);
});

test("#given API-key mode without an Argon mapping #when doctor runs #then model_provider warns and --strict fails", () => {
	const home = fs.mkdtempSync(path.join(os.tmpdir(), "lazyargon-home-"));
	try {
		fs.mkdirSync(path.join(home, ".gemini"), { recursive: true });
		fs.writeFileSync(path.join(home, ".gemini", "settings.json"), JSON.stringify({ modelProvider: "gemini", apiKey: "SECRET-SHOULD-NOT-PRINT" }), "utf8");
		const env = { ...process.env, HOME: home, USERPROFILE: home };
		const res = spawnSync("node", [path.join(ROOT, "scripts", "doctor.mjs"), "--json"], { cwd: ROOT, encoding: "utf8", env });
		const check = JSON.parse(res.stdout).checks.find((c) => c.id === "antigravity.model_provider");
		assert.equal(check.status, "warn");
		assert.match(check.detail, /Gemini 3\.8 Flash/);
		assert.doesNotMatch(res.stdout, /SECRET-SHOULD-NOT-PRINT/);
		const strict = spawnSync("node", [path.join(ROOT, "scripts", "doctor.mjs"), "--strict"], { cwd: ROOT, encoding: "utf8", env });
		assert.equal(strict.status, 1);

		fs.writeFileSync(path.join(home, ".gemini", "settings.json"), JSON.stringify({ modelProvider: "gemini", customModelsConfig: [{ id: "gemini-api://gemini-4-argon-high" }] }), "utf8");
		const mapped = spawnSync("node", [path.join(ROOT, "scripts", "doctor.mjs"), "--json"], { cwd: ROOT, encoding: "utf8", env });
		assert.equal(JSON.parse(mapped.stdout).checks.find((c) => c.id === "antigravity.model_provider").status, "ok");
	} finally {
		fs.rmSync(home, { recursive: true, force: true });
	}
});

test("#given live_rpc mock payload #when customization has STATUS_ERROR #then doctor fails and reports the errored item", () => {
	const okMock = JSON.stringify({
		states: [
			{ name: "lazyargon/skills/ulw", status: "STATUS_ENABLED" },
			{ name: "lazyargon-workspace/skills/forensic-report", status: "STATUS_ENABLED" },
		],
	});
	const okRes = spawnSync("node", [path.join(ROOT, "scripts", "doctor.mjs"), "--json"], {
		cwd: ROOT,
		encoding: "utf8",
		env: { ...process.env, LAZYARGON_LS_RPC_MOCK_JSON: okMock },
	});
	assert.equal(okRes.status, 0);
	const okCheck = JSON.parse(okRes.stdout).checks.find((c) => c.id === "antigravity.live_rpc");
	assert.equal(okCheck.status, "ok");
	assert.match(okCheck.detail, /ENABLED 2개/);

	const errMock = JSON.stringify({
		states: [
			{ name: "lazyargon/skills/ulw", status: "STATUS_ENABLED" },
			{ name: "lazyargon/hooks.json", status: "STATUS_ERROR", error: "invalid hook format" },
		],
	});
	const errRes = spawnSync("node", [path.join(ROOT, "scripts", "doctor.mjs"), "--json"], {
		cwd: ROOT,
		encoding: "utf8",
		env: { ...process.env, LAZYARGON_LS_RPC_MOCK_JSON: errMock },
	});
	assert.equal(errRes.status, 1);
	const errCheck = JSON.parse(errRes.stdout).checks.find((c) => c.id === "antigravity.live_rpc");
	assert.equal(errCheck.status, "fail");
	assert.match(errCheck.detail, /lazyargon\/hooks\.json/);
});
