import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { checkMemo, compareStamp, stampLines } from "../scripts/handoff_check.mjs";
import { evidenceStatus, fingerprint, recordEvidence } from "../scripts/tree_fingerprint.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GUARD = path.join(ROOT, "scripts", "stop_claim_guard.mjs");
const SESSION_START = path.join(ROOT, "scripts", "session_start.mjs");
const FP_CLI = path.join(ROOT, "scripts", "tree_fingerprint.mjs");

const GIT_ID = ["-c", "user.name=t", "-c", "user.email=t@example.invalid"];
const git = (cwd, ...args) => {
	const r = spawnSync("git", [...GIT_ID, ...args], { cwd, encoding: "utf8" });
	assert.equal(r.status, 0, r.stderr);
	return r.stdout.trim();
};

function makeRepo() {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lazyargon-fp-"));
	git(dir, "init", "-q");
	fs.writeFileSync(path.join(dir, "a.txt"), "one\n");
	git(dir, "add", ".");
	git(dir, "commit", "-q", "-m", "init");
	return dir;
}

const withRepo = (fn) => () => {
	const dir = makeRepo();
	try {
		fn(dir);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
};

const MEMO = (stamp, where = "`a.txt`") =>
	`Status: open\n${stamp.join("\n")}\nCheck: pass\n\n## Original request\n\n로그인 고쳐줘\n\n## Now\n\n수정 중\n\n## Done\n\n- 없음 (unverified)\n\n## Next\n\n1. node --test\n\n## Done-when\n\n테스트 통과\n\n## Where\n\n${where}\n\n## Dead ends\n\n- 없음\n`;

test("#given a repo #when tracked, untracked, or .lazyargon files change #then only real work-tree edits move the fingerprint", withRepo((dir) => {
	const base = fingerprint(dir);
	assert.ok(base.head && base.tree && base.diff_sha256);
	assert.deepEqual(fingerprint(dir), base, "same content, same fingerprint");

	fs.mkdirSync(path.join(dir, ".lazyargon"));
	fs.writeFileSync(path.join(dir, ".lazyargon", "evidence.jsonl"), "{}\n");
	assert.deepEqual(fingerprint(dir), base, ".lazyargon must not churn the digest");

	fs.writeFileSync(path.join(dir, "a.txt"), "two\n");
	const edited = fingerprint(dir);
	assert.notEqual(edited.diff_sha256, base.diff_sha256);
	assert.equal(edited.tree, base.tree, "uncommitted edits keep HEAD^{tree}");

	fs.writeFileSync(path.join(dir, "new.txt"), "x\n");
	assert.notEqual(fingerprint(dir).diff_sha256, edited.diff_sha256, "untracked file is part of the proof");
}));

test("#given a pass row #when code changes #then it turns stale until re-recorded; fail rows are failing", withRepo((dir) => {
	assert.deepEqual(evidenceStatus(dir), { ledger: false, pass: [], stale: [], failing: [] });
	recordEvidence(dir, { criterion: "C1", command: "node --test" });
	assert.deepEqual(evidenceStatus(dir).pass, ["C1"]);

	fs.writeFileSync(path.join(dir, "a.txt"), "changed\n");
	assert.deepEqual(evidenceStatus(dir).stale, ["C1"]);
	const cli = spawnSync("node", [FP_CLI, "check", "--cwd", dir], { encoding: "utf8" });
	assert.equal(cli.status, 1, "check exits 1 on stale evidence");

	recordEvidence(dir, { criterion: "C1", command: "node --test" });
	assert.deepEqual(evidenceStatus(dir).pass, ["C1"], "a newer row supersedes the stale one");

	recordEvidence(dir, { criterion: "C2", command: "node --test", verdict: "fail" });
	assert.deepEqual(evidenceStatus(dir).failing, ["C2"]);
	assert.throws(() => recordEvidence(dir, { criterion: "C3", command: "x", verdict: "maybe" }), /verdict/);
}));

function runGuard(dir, message) {
	const payload = { hook_event_name: "Stop", fullyIdle: true, executionNum: 1, terminationReason: "NO_TOOL_CALL", cwd: dir, last_assistant_message: message };
	const r = spawnSync("node", [GUARD], { cwd: ROOT, input: JSON.stringify(payload), encoding: "utf8", env: { ...process.env, LAZYARGON_STOP_GUARD: "enforce" } });
	assert.equal(r.status, 0, r.stderr);
	return JSON.parse(r.stdout);
}

test("#given a completion claim with evidence #when the ledger is stale #then stop_claim_guard blocks, and passes once re-recorded", withRepo((dir) => {
	const claim = "작업을 마쳤다. node --test 결과 12 passed, 산출물 a.txt, 완료.";
	assert.deepEqual(runGuard(dir, claim), {}, "no ledger: unchanged behavior");

	recordEvidence(dir, { criterion: "C1", command: "node --test" });
	assert.deepEqual(runGuard(dir, claim), {}, "fresh ledger passes");

	fs.writeFileSync(path.join(dir, "a.txt"), "changed after capture\n");
	const blocked = runGuard(dir, claim);
	assert.equal(blocked.decision, "continue");
	assert.match(blocked.reason, /stale/);
	assert.match(blocked.reason, /C1/);

	recordEvidence(dir, { criterion: "C1", command: "node --test" });
	assert.deepEqual(runGuard(dir, claim), {});
}));

test("#given a memo #when the repo moves #then compareStamp reports match / worktree_changed / head_advanced / stale / no_stamp", withRepo((dir) => {
	const stamp = stampLines(dir);
	const memo = MEMO(stamp);
	assert.equal(compareStamp(memo, dir).state, "match");
	assert.match(stamp[1], /^Dirty: clean$/);

	fs.writeFileSync(path.join(dir, "a.txt"), "dirty\n");
	assert.equal(compareStamp(memo, dir).state, "worktree_changed");

	git(dir, "commit", "-q", "-am", "next");
	assert.equal(compareStamp(memo, dir).state, "head_advanced");

	const foreign = MEMO(["HEAD: " + "deadbeef".repeat(5), "Dirty: clean"]);
	assert.equal(compareStamp(foreign, dir).state, "stale");
	assert.equal(compareStamp("Status: open\n", dir).state, "no_stamp");
}));

test("#given memos #when checked #then header, sections, Where paths, and secrets are enforced", withRepo((dir) => {
	const stamp = stampLines(dir);
	assert.deepEqual(checkMemo(MEMO(stamp), dir), []);
	assert.ok(checkMemo(MEMO(stamp).replace(/^HEAD:.*\n/m, ""), dir).some((p) => p.includes("HEAD")));
	assert.ok(checkMemo(MEMO(stamp).replace("## Dead ends", "## Misc"), dir).some((p) => p.includes("Dead ends")));
	assert.ok(checkMemo(MEMO(stamp, "`missing/dir/file.md`"), dir).some((p) => p.includes("missing/dir/file.md")));
	assert.ok(checkMemo(`${MEMO(stamp)}\napi_key: ${"a1".repeat(12)}\n`, dir).some((p) => p.includes("비밀값")));
}));

test("#given .lazyargon/handoff.md #when session starts #then the fingerprint verdict is injected, and stale memo bodies are withheld", withRepo((dir) => {
	fs.mkdirSync(path.join(dir, ".lazyargon"));
	const memoPath = path.join(dir, ".lazyargon", "handoff.md");
	const ctx = () => {
		const r = spawnSync("node", [SESSION_START], { cwd: os.tmpdir(), input: JSON.stringify({ workspacePaths: [dir] }), encoding: "utf8" });
		assert.equal(r.status, 0, r.stderr);
		return JSON.parse(r.stdout).injectSteps[0].systemMessage.systemMessage;
	};
	assert.match(ctx(), /이어받기 메모[^\n]*\n\n없음/);

	fs.writeFileSync(memoPath, MEMO(stampLines(dir)));
	assert.match(ctx(), /지문 판정: match/);
	assert.match(ctx(), /로그인 고쳐줘/);

	fs.writeFileSync(path.join(dir, "a.txt"), "dirty\n");
	assert.match(ctx(), /지문 판정: worktree_changed/);

	fs.writeFileSync(memoPath, MEMO(["HEAD: " + "deadbeef".repeat(5), "Dirty: clean"]));
	const stale = ctx();
	assert.match(stale, /지문 판정: stale/);
	assert.doesNotMatch(stale, /로그인 고쳐줘/);

	fs.writeFileSync(memoPath, "Status: open\n로그인 고쳐줘\n");
	assert.match(ctx(), /지문 판정: no_stamp/);

	fs.rmSync(memoPath);
	fs.writeFileSync(path.join(dir, ".lazyargon", "pins.md"), `HEAD: ${"deadbeef".repeat(5)}\nDirty: clean\n- id: 1\n`);
	assert.match(ctx(), /지문 판정: stale[^\n]*/, "pins.md with a stamp is also compared");
}));
