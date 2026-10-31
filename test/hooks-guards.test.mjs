import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { extractTargetFile, extractWriteBody } from "../scripts/write_chunk_guard.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WS_ROOT = path.resolve(ROOT, "..", "lazyargon-workspace");
const HOOKS_JSON = JSON.parse(fs.readFileSync(path.join(ROOT, "hooks.json"), "utf8"));

const FEEDBACK_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "lazyargon-feedback-"));
process.on("exit", () => fs.rmSync(FEEDBACK_DIR, { recursive: true, force: true }));

// PostToolUse guards are wrapped by post_tool_feedback.mjs: the hook always returns {} and queues failures.
function takeFeedback(conversationId) {
	const file = path.join(FEEDBACK_DIR, `${conversationId}.jsonl`);
	if (!fs.existsSync(file)) return "";
	const text = fs.readFileSync(file, "utf8");
	fs.rmSync(file);
	return text;
}

function runShCommand(cmd, stdinPayload, cwd = ROOT, extraEnv = {}) {
	const env = { ...process.env, LAZYARGON_FEEDBACK_DIR: FEEDBACK_DIR, ...extraEnv };
	delete env.PLUGIN_ROOT;
	const resolvedCmd = cmd.replace(/\$\{PLUGIN_ROOT:-\.\}/g, env.PLUGIN_ROOT || ".");
	return spawnSync(resolvedCmd, {
		cwd,
		env,
		input: stdinPayload,
		encoding: "utf8",
		shell: true,
	});
}

test("#given both hooks.json #when inspected #then PreToolUse and PostToolUse match edit_file|EditFile and Stop is not duplicated", () => {
	const preMatcher = new RegExp(HOOKS_JSON.hooks.PreToolUse[0].matcher);
	const postMatcher = new RegExp(HOOKS_JSON.hooks.PostToolUse[0].matcher);
	for (const tool of ["write_file", "WriteFile", "edit_file", "EditFile", "write_to_file", "replace_file_content"]) {
		assert.ok(preMatcher.test(tool), `lazyargon PreToolUse matcher missing ${tool}`);
		assert.ok(postMatcher.test(tool), `lazyargon PostToolUse matcher missing ${tool}`);
	}
	assert.equal(HOOKS_JSON.hooks.Stop?.length, 1);

	const wsHooksPath = path.join(WS_ROOT, "hooks.json");
	if (fs.existsSync(wsHooksPath)) {
		const wsHooks = JSON.parse(fs.readFileSync(wsHooksPath, "utf8"));
		const wsPre = new RegExp(wsHooks.hooks.PreToolUse[0].matcher);
		const wsPost = new RegExp(wsHooks.hooks.PostToolUse[0].matcher);
		for (const tool of ["write_file", "WriteFile", "edit_file", "EditFile"]) {
			assert.ok(wsPre.test(tool), `workspace PreToolUse matcher missing ${tool}`);
			assert.ok(wsPost.test(tool), `workspace PostToolUse matcher missing ${tool}`);
		}
		assert.equal(wsHooks.hooks.Stop, undefined, "workspace hooks.json should not duplicate Stop hook");
	}
});

test("#given write_chunk_guard.mjs #when called with write_file({Path, Content}) or edit_file({Path, Replacement}) #then extracts Path and enforces chunk limits", () => {
	const preCmd = HOOKS_JSON.hooks.PreToolUse[0].hooks[0].command;

	const writePayload = {
		toolCall: {
			name: "write_file",
			args: { Path: "/tmp/test.mjs", Content: "const x = 1;\n".repeat(260) },
		},
	};
	assert.equal(extractTargetFile(writePayload), "/tmp/test.mjs");
	assert.ok(extractWriteBody(writePayload).includes("const x = 1;"));
	const denyWrite = runShCommand(preCmd, JSON.stringify(writePayload));
	assert.equal(denyWrite.status, 1);
	assert.equal(JSON.parse(denyWrite.stdout).decision, "deny");

	const editPayload = {
		toolCall: {
			name: "edit_file",
			args: { Path: "/tmp/test.mjs", Target: "const x = 1;", Replacement: "y".repeat(25 * 1024) },
		},
	};
	assert.equal(extractTargetFile(editPayload), "/tmp/test.mjs");
	const denyEdit = runShCommand(preCmd, JSON.stringify(editPayload));
	assert.equal(denyEdit.status, 1);
	assert.equal(JSON.parse(denyEdit.stdout).decision, "deny");

	const okEdit = {
		toolCall: {
			name: "edit_file",
			args: { Path: "/tmp/test.mjs", Target: "const x = 1;", Replacement: "const x = 2;\n" },
		},
	};
	const allowEdit = runShCommand(preCmd, JSON.stringify(okEdit));
	assert.equal(allowEdit.status, 0);
	assert.equal(JSON.parse(allowEdit.stdout).decision, "allow");
});

test("#given PostToolUse guards #when transcript contains write_file({Path, Content}) or edit_file({Path, Replacement}) #then detects broken markdown and JSON", () => {
	const postHooks = HOOKS_JSON.hooks.PostToolUse[0].hooks;
	const mdCmd = postHooks.find((h) => h.command.includes("markdown_structure_guard.mjs")).command;
	const jsonCmd = postHooks.find((h) => h.command.includes("json_schema_guard.mjs")).command;

	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lazyargon-hg-"));
	try {
		const brainDir = path.join(tmpDir, "brain", "conv-hg");
		const logsDir = path.join(brainDir, ".system_generated", "logs");
		fs.mkdirSync(logsDir, { recursive: true });

		const brokenMd = path.join(tmpDir, "doc.md");
		fs.writeFileSync(brokenMd, "# Title\n\n| A | B |\n|---|---|\n| 1 | 2 | 3 |\n", "utf8");
		const mdStep = {
			step_index: 2,
			source: "MODEL",
			type: "PLANNER_RESPONSE",
			status: "DONE",
			tool_calls: [{ name: "edit_file", args: { Path: brokenMd, Target: "| 1 | 2 |", Replacement: "| 1 | 2 | 3 |" } }],
		};
		fs.writeFileSync(path.join(logsDir, "transcript.jsonl"), `${JSON.stringify(mdStep)}\n`, "utf8");
		const mdPayload = JSON.stringify({
			conversationId: "conv-hg",
			transcriptPath: path.join(logsDir, "transcript.jsonl"),
			artifactDirectoryPath: brainDir,
			stepIdx: 3,
		});
		const mdFail = runShCommand(mdCmd, mdPayload);
		assert.equal(mdFail.status, 0, mdFail.stderr);
		assert.match(takeFeedback("conv-hg"), /table_column_mismatch/);

		const brokenJson = path.join(tmpDir, "pkg.json");
		fs.writeFileSync(brokenJson, '{"version": "invalid-semver"}', "utf8");
		const jsonStep = {
			step_index: 4,
			source: "MODEL",
			type: "PLANNER_RESPONSE",
			status: "DONE",
			tool_calls: [{ name: "write_file", args: { Path: brokenJson, Content: '{"version": "invalid-semver"}' } }],
		};
		fs.writeFileSync(path.join(logsDir, "transcript.jsonl"), `${JSON.stringify(jsonStep)}\n`, "utf8");
		const jsonPayload = JSON.stringify({
			conversationId: "conv-hg",
			transcriptPath: path.join(logsDir, "transcript.jsonl"),
			artifactDirectoryPath: brainDir,
			stepIdx: 5,
		});
		const jsonFail = runShCommand(jsonCmd, jsonPayload);
		assert.equal(jsonFail.status, 0, jsonFail.stderr);
		assert.match(takeFeedback("conv-hg"), /JSON SCHEMA GUARD/);
	} finally {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}
});

test("#given stop_claim_guard.mjs #when fullyIdle:false, executionNum:2, or USER_CANCELED #then passes immediately with {} and exit 0", () => {
	const stopCmd = HOOKS_JSON.hooks.Stop[0].command;
	const grandClaim = "모든 검증을 100% 완벽하게 완료했습니다.";

	for (const bypassPayload of [
		{ hook_event_name: "Stop", fullyIdle: false, last_assistant_message: grandClaim },
		{ hook_event_name: "Stop", executionNum: 2, last_assistant_message: grandClaim },
		{ hook_event_name: "Stop", terminationReason: "USER_CANCELED", last_assistant_message: grandClaim },
		{ hook_event_name: "Stop", terminationReason: "MAX_TOKEN_BUDGET_EXCEEDED", last_assistant_message: grandClaim },
	]) {
		const res = runShCommand(stopCmd, JSON.stringify(bypassPayload), ROOT, { LAZYARGON_STOP_GUARD: "enforce" });
		assert.equal(res.status, 0, res.stderr);
		assert.deepEqual(JSON.parse(res.stdout), {});
	}

	const blockPayload = {
		hook_event_name: "Stop",
		fullyIdle: true,
		executionNum: 1,
		terminationReason: "NO_TOOL_CALL",
		last_assistant_message: grandClaim,
	};
	const blockRes = runShCommand(stopCmd, JSON.stringify(blockPayload), ROOT, { LAZYARGON_STOP_GUARD: "enforce" });
	assert.equal(blockRes.status, 0);
	assert.equal(JSON.parse(blockRes.stdout).decision, "block");
});
