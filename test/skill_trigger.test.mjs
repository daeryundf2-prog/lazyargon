import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildPrompt, judge, loadCases, loadCatalog, main, parseAnswer } from "../tools/measure_skill_trigger.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Offline fixture: a fake `agy` that never touches a model. It logs each call and answers "alpha" when the
// request mentions TRIGGERME, otherwise "none".
function fixture() {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lazyargon-trigger-"));
	for (const name of ["alpha", "beta"]) {
		fs.mkdirSync(path.join(dir, "skills", name), { recursive: true });
		fs.writeFileSync(path.join(dir, "skills", name, "SKILL.md"), `---\nname: ${name}\ndescription: "does ${name} things"\n---\nbody\n`);
	}
	fs.mkdirSync(path.join(dir, "skills", "alpha", "evals"));
	const cases = [
		{ id: "p", expect: "trigger", prompt: "please TRIGGERME now" },
		{ id: "n", expect: "no_trigger", prompt: "unrelated request" },
	];
	fs.writeFileSync(path.join(dir, "skills", "alpha", "evals", "cases.jsonl"), `${cases.map((c) => JSON.stringify(c)).join("\n")}\n`);
	const calls = path.join(dir, "calls.log");
	const bin = path.join(dir, "fake-agy.sh");
	fs.writeFileSync(
		bin,
		`#!/bin/sh\necho "$1 $3" >> "${calls}"\ncase "$2" in *"User request: please TRIGGERME"*) echo "- alpha" ;; *) echo none ;; esac\n`,
		{ mode: 0o755 },
	);
	const callCount = () => (fs.existsSync(calls) ? fs.readFileSync(calls, "utf8").split("\n").filter(Boolean).length : 0);
	return { dir, bin, callCount, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

async function quiet(fn) {
	const orig = [console.log, console.error];
	console.log = () => {};
	console.error = () => {};
	try {
		return await fn();
	} finally {
		[console.log, console.error] = orig;
	}
}

test("#given answers #when judged #then trigger needs hits >= minHit and no_trigger needs hits <= maxHit", () => {
	const t = { id: "t", expect: "trigger" };
	const n = { id: "n", expect: "no_trigger" };
	const th = { minHit: 3, maxHit: 0 };
	assert.equal(judge(t, ["a", "a", "a"], "a", th).pass, true);
	assert.equal(judge(t, ["a", "a", "none"], "a", th).pass, false);
	assert.equal(judge(n, ["none", "b", "none"], "a", th).pass, true);
	assert.equal(judge(n, ["a", "none", "none"], "a", th).pass, false);
});

test("#given decorated model output #when parsed #then the last line's skill name remains", () => {
	assert.equal(parseAnswer("thinking...\n- `ulw`\n"), "ulw");
	assert.equal(parseAnswer("none"), "none");
	assert.equal(parseAnswer("  \n"), "ERR:empty");
});

test("#given the shipped skills #when loaded #then every evals/cases.jsonl is valid and has both kinds of case", () => {
	const catalog = loadCatalog(ROOT);
	assert.ok(catalog.length >= 20);
	const withCases = fs.readdirSync(path.join(ROOT, "skills")).filter((s) => fs.existsSync(path.join(ROOT, "skills", s, "evals", "cases.jsonl")));
	assert.ok(withCases.length >= 2, "ship 2-3 example case files");
	for (const skill of withCases) {
		assert.ok(catalog.some((c) => c.name === skill), `${skill} is in the catalog`);
		const cases = loadCases(ROOT, skill);
		assert.ok(cases.some((c) => c.expect === "trigger") && cases.some((c) => c.expect === "no_trigger"), skill);
	}
	assert.match(buildPrompt(catalog, "REQ"), /User request: REQ/);
});

test("#given a malformed case file #when loaded #then it names the file and line", () => {
	const f = fixture();
	try {
		fs.writeFileSync(path.join(f.dir, "skills", "alpha", "evals", "cases.jsonl"), '{"id":"x","expect":"maybe","prompt":"p"}\n');
		assert.throws(() => loadCases(f.dir, "alpha"), /cases\.jsonl:1/);
	} finally {
		f.cleanup();
	}
});

test("#given --dry-run #when run #then no model call is made", async () => {
	const f = fixture();
	try {
		const code = await quiet(() => main(["--repo", f.dir, "--skill", "alpha", "--dry-run"], { LAZYARGON_AGY_BIN: f.bin }));
		assert.equal(code, 0);
		assert.equal(f.callCount(), 0);
	} finally {
		f.cleanup();
	}
});

test("#given a call count above --max-calls #when run #then it refuses before calling the model", async () => {
	const f = fixture();
	try {
		const code = await quiet(() => main(["--repo", f.dir, "--skill", "alpha", "--runs", "3", "--max-calls", "5"], { LAZYARGON_AGY_BIN: f.bin }));
		assert.equal(code, 2);
		assert.equal(f.callCount(), 0);
	} finally {
		f.cleanup();
	}
});

test("#given a fake agy #when measured with runs 3 #then calls use -p/--output-format text and the verdict follows the answers", async () => {
	const f = fixture();
	try {
		const code = await quiet(() => main(["--repo", f.dir, "--skill", "alpha", "--runs", "3", "--concurrency", "1"], { LAZYARGON_AGY_BIN: f.bin }));
		assert.equal(code, 0, "trigger case hits 3/3, no_trigger case hits 0/3");
		assert.equal(f.callCount(), 6);
		const logged = fs.readFileSync(path.join(f.dir, "calls.log"), "utf8").split("\n").filter(Boolean);
		assert.ok(logged.every((l) => l === "-p --output-format"), logged[0]);

		// a skill whose trigger case is not answered with its own name fails the run
		const bad = await quiet(() => main(["--repo", f.dir, "--skill", "alpha", "--runs", "3", "--only", "p"], { LAZYARGON_AGY_BIN: "/bin/echo" }));
		assert.equal(bad, 1);
	} finally {
		f.cleanup();
	}
});
