import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

test("#given hook-runner.mjs #when child exits 0 with empty stdout #then stdout is valid JSON {}", () => {
	const cmd = 'node "./scripts/hook-runner.mjs" FAIL_CLOSED none none node -e "process.exit(0)"';
	const res = runShCommand(cmd, "{}");
	assert.equal(res.status, 0);
	assert.deepEqual(JSON.parse(res.stdout), {});
});

test("#given hook-runner.mjs FAIL_OPEN #when child exits 1 with empty stdout #then stdout is valid JSON {}", () => {
	const cmd = 'node "./scripts/hook-runner.mjs" FAIL_OPEN none none node -e "console.error(\'err\'); process.exit(1)"';
	const res = runShCommand(cmd, "{}");
	assert.equal(res.status, 0);
	assert.deepEqual(JSON.parse(res.stdout), {});
	assert.match(res.stderr, /err/);
});

test("#given markdown with a leaked <thought> block #when guard --check runs #then exit 1 with leaked_reasoning_block; tag in code span passes", () => {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lazyargon-leak-"));
	try {
		const leak = path.join(tmpDir, "leak.md");
		fs.writeFileSync(leak, "# 보고서\n<thinking>\n먼저 파일을 열어야겠다\n</thinking>\n본문\n", "utf8");
		const fail = spawnSync("node", [path.join(ROOT, "scripts", "markdown_structure_guard.mjs"), "--check", leak], { encoding: "utf8" });
		assert.equal(fail.status, 1);
		assert.match(fail.stderr, /leaked_reasoning_block/);

		const clean = path.join(tmpDir, "clean.md");
		fs.writeFileSync(clean, "# 가이드\n\n가드는 `<thought>` 태그와 \"Thinking:\" 라벨 줄을 막는다.\n\n```\n<thought>\n예시\n</thought>\n```\n", "utf8");
		const pass = spawnSync("node", [path.join(ROOT, "scripts", "markdown_structure_guard.mjs"), "--check", clean], { encoding: "utf8" });
		assert.equal(pass.status, 0, pass.stderr);
	} finally {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}
});

test("#given lazyargon hooks.json commands #when executed without PLUGIN_ROOT #then pass returns 0 + {} and broken transcript target returns 1", () => {
	const postHooks = HOOKS_JSON.hooks.PostToolUse[0].hooks;
	const mdCmd = postHooks.find((h) => h.command.includes("markdown_structure_guard.mjs")).command;
	const jsonCmd = postHooks.find((h) => h.command.includes("json_schema_guard.mjs")).command;

	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lazyargon-e2e-"));
	try {
		const brainDir = path.join(tmpDir, "brain", "conv-e2e");
		const logsDir = path.join(brainDir, ".system_generated", "logs");
		fs.mkdirSync(logsDir, { recursive: true });

		// 1) Unrelated event -> exit 0 and valid JSON {}
		for (const cmd of [mdCmd, jsonCmd]) {
			const passRes = runShCommand(cmd, JSON.stringify({ conversationId: "conv-e2e" }));
			assert.equal(passRes.status, 0, passRes.stderr);
			assert.deepEqual(JSON.parse(passRes.stdout), {});
		}

		// 2) Broken markdown table in transcript.jsonl -> exit 1 + stderr error
		const brokenMd = path.join(tmpDir, "broken.md");
		fs.writeFileSync(brokenMd, "# Title\n\n| A | B |\n|---|---|\n| 1 | 2 | 3 |\n", "utf8");
		const mdStep = {
			step_index: 4,
			source: "MODEL",
			type: "PLANNER_RESPONSE",
			status: "DONE",
			tool_calls: [{ name: "write_to_file", args: { TargetFile: JSON.stringify(brokenMd) } }],
		};
		fs.writeFileSync(path.join(logsDir, "transcript.jsonl"), `${JSON.stringify(mdStep)}\n`, "utf8");
		const payload = JSON.stringify({
			conversationId: "conv-e2e",
			transcriptPath: path.join(logsDir, "transcript.jsonl"),
			artifactDirectoryPath: brainDir,
			stepIdx: 5,
		});

		const mdFail = runShCommand(mdCmd, payload);
		assert.equal(mdFail.status, 0, mdFail.stderr);
		assert.deepEqual(JSON.parse(mdFail.stdout), {});
		// PreInvocation inject relays the queued failure to the model once, then the queue is empty
		const injectCmd = HOOKS_JSON.hooks.PreInvocation[0].command;
		const injected = JSON.parse(runShCommand(injectCmd, JSON.stringify({ conversationId: "conv-e2e" })).stdout);
		assert.match(injected.injectSteps[0].ephemeralMessage, /table_column_mismatch/);
		assert.deepEqual(JSON.parse(runShCommand(injectCmd, JSON.stringify({ conversationId: "conv-e2e" })).stdout), {});

		// Fix markdown -> exit 0 and {}
		fs.writeFileSync(brokenMd, "# Title\n\n| A | B |\n|---|---|\n| 1 | 2 |\n", "utf8");
		const mdPass = runShCommand(mdCmd, payload);
		assert.equal(mdPass.status, 0, mdPass.stderr);
		assert.deepEqual(JSON.parse(mdPass.stdout), {});
		assert.equal(takeFeedback("conv-e2e"), "");

		// 3) Invalid JSON in transcript.jsonl -> exit 1 + stderr error
		const brokenJson = path.join(tmpDir, "broken.json");
		fs.writeFileSync(brokenJson, '{"version": "invalid-semver", "broken": }', "utf8");
		const jsonStep = {
			step_index: 6,
			source: "MODEL",
			type: "PLANNER_RESPONSE",
			status: "DONE",
			tool_calls: [{ name: "write_to_file", args: { TargetFile: JSON.stringify(brokenJson) } }],
		};
		fs.writeFileSync(path.join(logsDir, "transcript.jsonl"), `${JSON.stringify(jsonStep)}\n`, "utf8");
		const jsonPayload = JSON.stringify({
			conversationId: "conv-e2e",
			transcriptPath: path.join(logsDir, "transcript.jsonl"),
			artifactDirectoryPath: brainDir,
			stepIdx: 7,
		});

		const jsonFail = runShCommand(jsonCmd, jsonPayload);
		assert.equal(jsonFail.status, 0, jsonFail.stderr);
		assert.match(takeFeedback("conv-e2e"), /JSON SCHEMA GUARD/);

		// Fix JSON (including workspace:*, github: shorthand, and relative endpoint) -> exit 0 and {}
		fs.writeFileSync(
			brokenJson,
			JSON.stringify({
				version: "workspace:*",
				repository: "github:daeryundf2-prog/lazyargon",
				endpoint: "/api/v1/health",
				nested: { version: "v1" },
			}),
			"utf8",
		);
		const jsonPass = runShCommand(jsonCmd, jsonPayload);
		assert.equal(jsonPass.status, 0, jsonPass.stderr);
		assert.deepEqual(JSON.parse(jsonPass.stdout), {});
		assert.equal(takeFeedback("conv-e2e"), "");

		// 4) Markdown file > 10MB truncated mid-fence -> does not false-positive on unclosed_code_fence
		const largeMd = path.join(tmpDir, "large.md");
		const pad = "# Heading\n\n" + "a".repeat(10 * 1024 * 1024 - 20) + "\n```js\nconst x = 1;\n" + "b".repeat(4096) + "\n```\n";
		fs.writeFileSync(largeMd, pad, "utf8");
		const largeStep = {
			step_index: 8,
			source: "MODEL",
			type: "PLANNER_RESPONSE",
			status: "DONE",
			tool_calls: [{ name: "write_to_file", args: { TargetFile: JSON.stringify(largeMd) } }],
		};
		fs.writeFileSync(path.join(logsDir, "transcript.jsonl"), `${JSON.stringify(largeStep)}\n`, "utf8");
		const largePayload = JSON.stringify({
			conversationId: "conv-e2e",
			transcriptPath: path.join(logsDir, "transcript.jsonl"),
			artifactDirectoryPath: brainDir,
			stepIdx: 9,
		});
		const largeMdPass = runShCommand(mdCmd, largePayload);
		assert.equal(largeMdPass.status, 0, largeMdPass.stderr);
		assert.deepEqual(JSON.parse(largeMdPass.stdout), {});

		// 5) Subsequent non-file step must NOT walk back to earlier broken files in transcript history
		fs.writeFileSync(brokenMd, "# Title\n\n| A | B |\n|---|---|\n| 1 | 2 | 3 |\n", "utf8");
		fs.writeFileSync(brokenJson, '{"version": "invalid-semver", "broken": }', "utf8");
		const cmdStep = {
			step_index: 10,
			source: "MODEL",
			type: "PLANNER_RESPONSE",
			status: "DONE",
			tool_calls: [{ name: "run_command", args: { CommandLine: JSON.stringify("git status") } }],
		};
		fs.writeFileSync(
			path.join(logsDir, "transcript.jsonl"),
			`${JSON.stringify(mdStep)}\n${JSON.stringify(jsonStep)}\n${JSON.stringify(cmdStep)}\n`,
			"utf8",
		);
		const subsequentPayload = JSON.stringify({
			conversationId: "conv-e2e",
			transcriptPath: path.join(logsDir, "transcript.jsonl"),
			artifactDirectoryPath: brainDir,
			stepIdx: 11,
		});
		for (const cmd of [mdCmd, jsonCmd]) {
			const res = runShCommand(cmd, subsequentPayload);
			assert.equal(res.status, 0, res.stderr);
			assert.deepEqual(JSON.parse(res.stdout), {});
		}
	} finally {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}
});

test("#given PreToolUse write_chunk_guard.mjs #when payload is within or exceeds chunk budget #then allows small write and denies >250 lines or >24KB", () => {
	const preCmd = HOOKS_JSON.hooks.PreToolUse[0].hooks[0].command;

	// 1) Small write (10 lines) -> allow (exit 0)
	const smallPayload = JSON.stringify({
		toolCall: {
			name: "write_to_file",
			args: { TargetFile: "/tmp/small.js", CodeContent: "const a = 1;\n".repeat(10) },
		},
	});
	const allowRes = runShCommand(preCmd, smallPayload);
	assert.equal(allowRes.status, 0, allowRes.stderr);
	assert.equal(JSON.parse(allowRes.stdout).decision, "allow");

	// 2) Oversized line count (260 lines) -> deny (exit 1)
	const manyLinesPayload = JSON.stringify({
		toolCall: {
			name: "write_to_file",
			args: { TargetFile: "/tmp/huge.js", CodeContent: "const a = 1;\n".repeat(260) },
		},
	});
	const denyLinesRes = runShCommand(preCmd, manyLinesPayload);
	assert.equal(denyLinesRes.status, 1);
	const denyLinesJson = JSON.parse(denyLinesRes.stdout);
	assert.equal(denyLinesJson.decision, "deny");
	assert.match(denyLinesJson.reason, /Argon 60s stream cutoff guard/);

	// 3) Oversized byte count (>24KB in single line) -> deny (exit 1)
	const manyBytesPayload = JSON.stringify({
		toolCall: {
			name: "replace_file_content",
			args: { TargetFile: "/tmp/huge.js", ReplacementContent: "x".repeat(25 * 1024) },
		},
	});
	const denyBytesRes = runShCommand(preCmd, manyBytesPayload);
	assert.equal(denyBytesRes.status, 1);
	assert.equal(JSON.parse(denyBytesRes.stdout).decision, "deny");
});
