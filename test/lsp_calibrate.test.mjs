import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { runDiagnosticsCheck, runRenamePreview, runSnapshot, runVerify } from "../scripts/lsp_diagnostics.mjs";
import { MODEL_PRESETS, SHARED_PREAMBLE_MAX_BYTES, calibrateModel } from "../scripts/model_calibrate.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = join(__dirname, "..");
const wsRoot = join(pluginRoot, "..", "lazyargon-workspace");
const lspScript = join(pluginRoot, "scripts", "lsp_diagnostics.mjs");
const calibrateScript = join(pluginRoot, "scripts", "model_calibrate.mjs");
const mdGuardScript = join(pluginRoot, "scripts", "markdown_structure_guard.mjs");

test("lsp_diagnostics.mjs: check passes on valid .mjs, .py, .json files", () => {
	const dir = mkdtempSync(join(tmpdir(), "lazyargon-lsp-ok-"));
	try {
		const mjsFile = join(dir, "valid.mjs");
		const pyFile = join(dir, "valid.py");
		const jsonFile = join(dir, "valid.json");
		writeFileSync(mjsFile, "export const x = 42;\n", "utf8");
		writeFileSync(pyFile, "def add(a: int, b: int) -> int:\n    return a + b\n", "utf8");
		writeFileSync(jsonFile, JSON.stringify({ ok: true }), "utf8");

		const res = runDiagnosticsCheck({ files: [mjsFile, pyFile, jsonFile], root: dir });
		assert.equal(res.schema, "language_diagnostic_evidence/v1");
		assert.equal(res.no_new_diagnostics_observed, true);
		assert.equal(res.checked_count, 3);
		assert.equal(res.error_count, 0);
		assert.equal(res.worktree_isolated, true);

		const cli = spawnSync(process.execPath, [lspScript, "check", "--files", [mjsFile, pyFile, jsonFile].join(","), "--root", dir, "--json"], {
			encoding: "utf8",
		});
		assert.equal(cli.status, 0);
		const parsed = JSON.parse(cli.stdout);
		assert.equal(parsed.no_new_diagnostics_observed, true);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("lsp_diagnostics.mjs: check detects syntax errors across .mjs, .py, .ts, .json and exits with code 1", () => {
	const dir = mkdtempSync(join(tmpdir(), "lazyargon-lsp-err-"));
	try {
		const badMjs = join(dir, "broken.mjs");
		const badJson = join(dir, "broken.json");
		const badPy = join(dir, "broken.py");
		const badTs = join(dir, "broken.ts");
		writeFileSync(badMjs, "export const x = ;\n", "utf8");
		writeFileSync(badJson, "{ invalid json ", "utf8");
		writeFileSync(badPy, "def broken(:\n    pass\n", "utf8");
		writeFileSync(badTs, "const x: = ;\nfunction unclosed() {\n", "utf8");

		const walkRes = runDiagnosticsCheck({ root: dir });
		assert.equal(walkRes.checked_count, 4);
		assert.equal(walkRes.error_count, 4);

		const cli = spawnSync(process.execPath, [lspScript, "check", "--files", `${badMjs},${badJson},${badPy},${badTs}`, "--root", dir, "--json"], {
			encoding: "utf8",
		});
		assert.equal(cli.status, 1);
		const parsed = JSON.parse(cli.stdout);
		assert.equal(parsed.schema, "language_diagnostic_evidence/v1");
		assert.equal(parsed.no_new_diagnostics_observed, false);
		assert.equal(parsed.error_count, 4);
		assert.equal(parsed.diagnostics.length, 4);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("lsp_diagnostics.mjs: snapshot and verify subcommands track baseline vs new diagnostics and fail closed on unknown cmd", () => {
	const dir = mkdtempSync(join(tmpdir(), "lazyargon-lsp-snap-"));
	try {
		writeFileSync(join(dir, "legacy_broken.mjs"), "export const a = ;\n", "utf8");
		writeFileSync(join(dir, "valid.ts"), "export const ok: number = 1;\n", "utf8");

		const snapCli = spawnSync(process.execPath, [lspScript, "snapshot", "--root", dir], { encoding: "utf8" });
		assert.equal(snapCli.status, 0);
		const snapData = JSON.parse(snapCli.stdout);
		assert.equal(snapData.mode, "snapshot");
		assert.equal(snapData.baseline_errors, 1);

		const verifyOk = spawnSync(process.execPath, [lspScript, "verify", "--root", dir], { encoding: "utf8" });
		assert.equal(verifyOk.status, 0);
		const verifyOkData = JSON.parse(verifyOk.stdout);
		assert.equal(verifyOkData.no_new_diagnostics_observed, true);
		assert.equal(verifyOkData.new_diagnostics.length, 0);

		writeFileSync(join(dir, "new_broken.ts"), "const bad: = ;\n", "utf8");
		const verifyFail = spawnSync(process.execPath, [lspScript, "verify", "--root", dir], { encoding: "utf8" });
		assert.equal(verifyFail.status, 1);
		const verifyFailData = JSON.parse(verifyFail.stdout);
		assert.equal(verifyFailData.no_new_diagnostics_observed, false);
		assert.equal(verifyFailData.new_diagnostics.length, 1);

		const unknownCli = spawnSync(process.execPath, [lspScript, "nonexistent-subcmd"], { encoding: "utf8" });
		assert.equal(unknownCli.status, 2);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("lsp_diagnostics.mjs: rename-preview identifies affected imports and barrel files", () => {
	const dir = mkdtempSync(join(tmpdir(), "lazyargon-lsp-rename-"));
	try {
		const srcDir = join(dir, "src");
		mkdirSync(srcDir, { recursive: true });
		writeFileSync(join(srcDir, "old_helper.mjs"), "export const v = 1;\n", "utf8");
		writeFileSync(join(srcDir, "consumer.mjs"), 'import { v } from "./old_helper.mjs";\nexport const v2 = v + 1;\n', "utf8");
		writeFileSync(join(srcDir, "index.mjs"), 'export * from "./old_helper.mjs";\n', "utf8");

		const preview = runRenamePreview({ root: dir, from: "src/old_helper.mjs", to: "src/new_helper.mjs" });
		assert.equal(preview.schema, "workspace_will_rename_files/v1");
		assert.equal(preview.from, "src/old_helper.mjs");
		assert.equal(preview.to, "src/new_helper.mjs");
		assert.ok(preview.affected_files.includes("src/consumer.mjs"));
		assert.ok(preview.affected_files.includes("src/index.mjs"));
		assert.deepEqual(preview.barrel_files, ["src/index.mjs"]);
		assert.ok(preview.updates.some((u) => u.file === "src/consumer.mjs" && u.new_specifier === "./new_helper.mjs"));
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("model_calibrate.mjs: supports all 6 presets and enforces <= 2770B cap", () => {
	assert.equal(SHARED_PREAMBLE_MAX_BYTES, 2770);
	const expectedModels = ["gemini-4-argon", "gemini-3.8-flash", "claude-5.5", "gpt-6", "kimi-k3", "glm-5"];
	assert.deepEqual(Object.keys(MODEL_PRESETS), expectedModels);

	for (const model of [...expectedModels, "opus", "sonnet", "astra", "codex", "kimi-code", "zcode"]) {
		const res = calibrateModel({ model, compact: false });
		assert.equal(res.schema, "model_calibration/v1");
		assert.ok(expectedModels.includes(res.model));
		assert.ok(res.byte_length > 0 && res.byte_length <= 2770);
		assert.equal(res.max_bytes, 2770);
	}

	const cli = spawnSync(process.execPath, [calibrateScript, "--model", "kimi-code", "--compact", "--json"], { encoding: "utf8" });
	assert.equal(cli.status, 0);
	const parsed = JSON.parse(cli.stdout);
	assert.equal(parsed.model, "kimi-k3");
	assert.ok(parsed.guidance.startsWith("[MODEL_CALIBRATE:kimi-k3]"));
	assert.ok(parsed.byte_length <= 2770);
});

test("4 reference docs exist, fit 60-90 lines, have language tags, and pass markdown guard", () => {
	const refs = [
		join(pluginRoot, "skills", "debugging", "references", "dap-session-plan.md"),
		join(pluginRoot, "skills", "programming", "references", "formal-verify.md"),
		join(pluginRoot, "skills", "ulw", "references", "gstack-gates.md"),
		join(wsRoot, "skills", "video-editor", "references", "showreel-videogen.md"),
	];

	for (const refPath of refs) {
		assert.ok(existsSync(refPath), `Missing reference: ${refPath}`);
		const text = readFileSync(refPath, "utf8");
		const lines = text.trimEnd().split(/\r?\n/);
		assert.ok(lines.length >= 60 && lines.length <= 90, `${refPath} line count ${lines.length} out of [60, 90]`);

		let inFence = false;
		for (const line of lines) {
			if (/^\s*```/.test(line)) {
				if (!inFence) {
					assert.match(line, /^\s*```[a-z0-9_-]+/i, `Opening code fence missing language tag in ${refPath}: ${line}`);
				}
				inFence = !inFence;
			}
		}
		assert.equal(inFence, false, `Unclosed fence in ${refPath}`);
	}

	const guardRes = spawnSync(process.execPath, [mdGuardScript, "--check", ...refs], { encoding: "utf8" });
	assert.equal(guardRes.status, 0, `Markdown guard failed: ${guardRes.stderr}`);
});
