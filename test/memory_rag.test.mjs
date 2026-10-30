import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const memPy = join(root, "scripts", "lazy_memory.py");
const ragPy = join(root, "scripts", "lazy_rag.py");
const sessionStartMjs = join(root, "scripts", "session_start.mjs");

function runPy(script, args) {
	const res = spawnSync("python3", [script, ...args], { encoding: "utf8" });
	let json = null;
	try {
		json = JSON.parse((res.stdout || "").trim());
	} catch {
		json = null;
	}
	return { status: res.status, stdout: (res.stdout || "").trim(), stderr: res.stderr, json };
}

test("Mem0 resolve lifecycle: ADD, NOOP, UPDATE, DELETE and imperative rejection", () => {
	const dir = mkdtempSync(join(tmpdir(), "lazy-mem-"));
	const db = join(dir, ".lazyargon", "memory.db");
	try {
		for (const bad of ["항상 문서를 먼저 확인하라.", "반드시 테스트를 실행해야 한다", "Always do a full check", "Never forget to lint", "You must follow rules"]) {
			const rej = runPy(memPy, ["resolve", "--db", db, "--kind", "fact", "--content", bad, "--json"]);
			assert.equal(rej.status, 2);
			assert.equal(rej.json?.ok, false);
			assert.equal(rej.json?.rejected, "IMPERATIVE_SUMMARY");
		}

		const add = runPy(memPy, ["resolve", "--db", db, "--kind", "fact", "--subject", "사건번호", "--predicate", "관할법원", "--object", "서울중앙지방법원", "--content", "사건번호 2026가합100의 관할법원은 서울중앙지방법원이다.", "--json"]);
		assert.equal(add.status, 0);
		assert.equal(add.json?.action, "ADDED");

		const noop = runPy(memPy, ["resolve", "--db", db, "--kind", "fact", "--subject", "사건번호", "--predicate", "관할법원", "--object", "서울중앙지방법원", "--json"]);
		assert.equal(noop.status, 0);
		assert.equal(noop.json?.action, "NOOP");

		const upd = runPy(memPy, ["resolve", "--db", db, "--kind", "fact", "--subject", "사건번호", "--predicate", "관할법원", "--object", "서울고등법원", "--content", "항소심 관할법원은 서울고등법원이다.", "--json"]);
		assert.equal(upd.status, 0);
		assert.equal(upd.json?.action, "UPDATED");
		assert.equal(upd.json?.superseded_id, add.json?.id);

		const st1 = runPy(memPy, ["stats", "--db", db, "--json"]);
		assert.equal(st1.json?.counts?.active, 1);
		assert.equal(st1.json?.counts?.superseded, 1);
		assert.equal(st1.json?.edges, 1);

		const del = runPy(memPy, ["resolve", "--db", db, "--subject", "사건번호", "--predicate", "관할법원", "--op", "DELETE", "--json"]);
		assert.equal(del.status, 0);
		assert.equal(del.json?.action, "DELETED");

		const st2 = runPy(memPy, ["stats", "--db", db, "--json"]);
		assert.equal(st2.json?.counts?.active, 0);
		assert.equal(st2.json?.counts?.deleted, 1);
		assert.equal(st2.json?.edges, 0);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("Letta core-replace/core-append 20-line ceiling and 5-turn Dreaming merge & promotion", () => {
	const dir = mkdtempSync(join(tmpdir(), "lazy-dream-"));
	const db = join(dir, ".lazyargon", "memory.db");
	const pins = join(dir, ".lazyargon", "pins.md");
	try {
		for (let i = 1; i <= 25; i++) {
			runPy(memPy, ["core-append", "--pins", pins, "--subject", `pin_${i}`, "--object", `val_${i}`, "--json"]);
		}
		const rep = runPy(memPy, ["core-replace", "--pins", pins, "--subject", "pin_25", "--object", "updated_25", "--json"]);
		assert.equal(rep.json?.line_count, 20);
		const pinText = readFileSync(pins, "utf8");
		assert.match(pinText, /- pin_25: updated_25/);

		const pinsDream = join(dir, ".lazyargon", "pins_dream.md");
		runPy(memPy, ["resolve", "--db", db, "--kind", "fact", "--subject", "증거해시", "--predicate", "SHA256", "--object", "a1b2c3d4", "--content", "갑호증 파일의 SHA256 증거해시는 a1b2c3d4 이다.", "--hit-count", "2", "--json"]);
		runPy(memPy, ["resolve", "--db", db, "--kind", "fact", "--subject", "증거해시_복사", "--predicate", "SHA256", "--object", "a1b2c3d4", "--content", "갑호증 파일의 SHA256 증거해시는 a1b2c3d4 입니다.", "--hit-count", "2", "--json"]);

		const dream = runPy(memPy, ["dream", "--db", db, "--pins", pinsDream, "--turn-interval", "5", "--json"]);
		assert.equal(dream.status, 0);
		assert.equal(dream.json?.merged_count, 1);
		assert.equal(dream.json?.promoted_pins, 1);
		assert.match(readFileSync(pinsDream, "utf8"), /증거해시: a1b2c3d4/);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("AutoRAG Korean morpheme RRF search, extractive compression, budgets, and session_start.mjs", () => {
	const dir = mkdtempSync(join(tmpdir(), "lazy-rag-"));
	const db = join(dir, ".lazyargon", "memory.db");
	try {
		const longDoc = [
			"첫 번째 배경 문장입니다.",
			"두 번째 도입 문장입니다.",
			"원고는 갑호증을 서울중앙지방법원에 제출하였다.",
			"피고는 이에 대해 부당이득 반환을 다투었다.",
			"다섯 번째 마무리 문장입니다.",
		].join(" ");
		runPy(memPy, ["resolve", "--db", db, "--kind", "fact", "--subject", "갑호증", "--predicate", "제출처", "--object", "서울중앙지방법원", "--content", longDoc, "--json"]);
		runPy(memPy, ["resolve", "--db", db, "--kind", "proc", "--subject", "타임라인", "--predicate", "렌더러", "--object", "HTML", "--content", "타임라인 이벤트 JSON은 HTML 뷰어로 렌더링한다.", "--json"]);

		const idx = runPy(ragPy, ["index", "--db", db, "--json"]);
		assert.equal(idx.json?.indexed, 2);

		const q = runPy(ragPy, ["query", "--db", db, "--query", "갑호증이 제출된 서울중앙지방법원", "--json"]);
		assert.equal(q.status, 0);
		assert.ok(q.json?.results?.length >= 1);
		const top = q.json.results[0];
		assert.equal(top.subject, "갑호증");
		assert.ok(top.rrf_score > 0);
		assert.equal(top.hit_count, 1);
		assert.ok(top.snippet.includes("갑호증을 서울중앙지방법원에 제출하였다"));
		assert.ok(!top.snippet.includes("첫 번째 배경 문장입니다"));

		for (const [mode, loc, web] of [["direct", 2, 4], ["explore", 3, 10], ["compare", 5, 18]]) {
			const b = runPy(ragPy, ["budget", "--mode", mode, "--json"]);
			assert.equal(b.json?.local, loc);
			assert.equal(b.json?.web, web);
		}

		const t0 = performance.now();
		const sRes = spawnSync(process.execPath, [sessionStartMjs], {
			cwd: dir,
			input: JSON.stringify({ modelName: "gemini-4-argon" }),
			encoding: "utf8",
		});
		const elapsed = performance.now() - t0;
		assert.equal(sRes.status, 0);
		assert.ok(elapsed < 350, `session_start took ${elapsed.toFixed(1)}ms (>= 350ms)`);
		const parsed = JSON.parse(sRes.stdout.trim());
		assert.ok(Array.isArray(parsed.injectSteps));
		assert.match(parsed.additionalContext, /로컬 메모리 리콜 팩/);
		assert.match(parsed.additionalContext, /갑호증 제출처 서울중앙지방법원/);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
