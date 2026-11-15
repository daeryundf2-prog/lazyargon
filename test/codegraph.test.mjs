import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = { codegraph: join(PLUGIN_ROOT, "scripts", "codegraph.mjs") };

function runCli(script, args = []) {
	const res = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
	let json = null;
	try {
		json = JSON.parse((res.stdout || "").trim());
	} catch {
		json = null;
	}
	return { status: res.status, stdout: res.stdout, stderr: res.stderr, json };
}

test("codegraph.mjs Personalized PageRank handoff & reverse-import test discovery", () => {
	const tmp = mkdtempSync(join(tmpdir(), "lazyargon-cg-"));
	try {
		mkdirSync(join(tmp, "src"), { recursive: true });
		mkdirSync(join(tmp, "test"), { recursive: true });
		writeFileSync(join(tmp, "src", "db.mjs"), "export function queryDb() { return []; }\n", "utf8");
		writeFileSync(
			join(tmp, "src", "service.mjs"),
			'import { queryDb } from "./db.mjs";\nexport function runService() { return queryDb(); }\n',
			"utf8",
		);
		// [CG-3] Commented-out imports/exports must be ignored
		writeFileSync(
			join(tmp, "src", "unrelated.mjs"),
			'/* import { queryDb } from "./db.mjs"; */\n// import { runService } from "./service.mjs";\nexport const UNUSED = 1;\n',
			"utf8",
		);
		writeFileSync(
			join(tmp, "test", "service.test.mjs"),
			'import { runService } from "../src/service.mjs";\nrunService();\n',
			"utf8",
		);

		const built = runCli(SCRIPTS.codegraph, ["build", "--root", tmp]);
		assert.deepEqual(built.json.nodes["src/unrelated.mjs"].imports_internal, []);

		// [CG-2] Normalize absolute path and ./ relative path in handoff & tests
		const handoff = runCli(SCRIPTS.codegraph, ["handoff", "--root", tmp, "--seeds", join(tmp, "src", "db.mjs"), "--top", "4"]);
		assert.equal(handoff.status, 0);
		assert.equal(handoff.json.ranked[0].file, "src/db.mjs");
		const topFiles = handoff.json.ranked.map((r) => r.file);
		assert.ok(topFiles.indexOf("src/service.mjs") < topFiles.indexOf("src/unrelated.mjs"));

		const impacted = runCli(SCRIPTS.codegraph, ["tests", "--root", tmp, "--changed", "./src/db.mjs"]);
		assert.equal(impacted.status, 0);
		assert.deepEqual(impacted.json.tests, ["test/service.test.mjs"]);

		// [CG-1] tests --changed without argument auto-detects from git diff
		spawnSync("git", ["init"], { cwd: tmp });
		spawnSync("git", ["config", "user.email", "test@example.com"], { cwd: tmp });
		spawnSync("git", ["config", "user.name", "Test"], { cwd: tmp });
		spawnSync("git", ["add", "."], { cwd: tmp });
		spawnSync("git", ["commit", "-m", "init"], { cwd: tmp });
		writeFileSync(join(tmp, "src", "db.mjs"), "export function queryDb() { return [1]; }\n", "utf8");
		const autoImpacted = runCli(SCRIPTS.codegraph, ["tests", "--changed", "--root", tmp]);
		assert.equal(autoImpacted.status, 0);
		assert.deepEqual(autoImpacted.json.tests, ["test/service.test.mjs"]);
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
});

