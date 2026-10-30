import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
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


test("Adversarial Auditor 3 regression suite (8 fixes)", () => {
	const dir = mkdtempSync(join(tmpdir(), "lazy-adv3-"));
	const db = join(dir, ".lazyargon", "memory.db");
	const pins = join(dir, ".lazyargon", "pins.md");
	const transcript = join(dir, "transcript.jsonl");
	try {
		// 1. 2-syllable nouns (합의, 결과, 경로) + 2. Hyphenated (gemini-4-아르곤) + 3. 1-char/numeric (갑, 100)
		runPy(memPy, ["resolve", "--db", db, "--kind", "fact", "--subject", "합의서", "--predicate", "경로", "--object", "합의 결과 경로", "--content", "양측 합의의 결과와 경로가 확인되었다.", "--json"]);
		runPy(memPy, ["resolve", "--db", db, "--kind", "fact", "--subject", "모델", "--predicate", "엔진", "--object", "gemini-4-아르곤", "--content", "세션 엔진은 gemini-4-아르곤 모델을 사용한다.", "--json"]);
		runPy(memPy, ["resolve", "--db", db, "--kind", "fact", "--subject", "갑", "--predicate", "배상액", "--object", "100", "--content", "갑이 청구한 금액은 100 이다.", "--json"]);

		for (const qStr of ["합의", "결과", "경로", "gemini", "아르곤", "갑", "100"]) {
			const rq = runPy(ragPy, ["query", "--db", db, "--query", qStr, "--json"]);
			assert.equal(rq.status, 0);
			assert.ok((rq.json?.results?.length || 0) >= 1, `Expected match for query: ${qStr}`);
		}

		// 4. Same-second rapid consecutive ADD/UPDATE without UNIQUE constraint crash
		for (let i = 0; i < 15; i++) {
			const r = runPy(memPy, ["resolve", "--db", db, "--kind", "fact", "--subject", "고속갱신", "--predicate", "카운터", "--object", `v${i}`, "--content", `연속 갱신 상태 v${i} 기록`, "--op", i === 0 ? "ADD" : "UPDATE", "--json"]);
			assert.equal(r.status, 0, `Iteration ${i} failed: ${r.stderr}`);
			assert.equal(r.json?.ok, true);
		}

		// 5. --op ADD duplicate supersedes old record and purges old FTS entry
		runPy(memPy, ["resolve", "--db", db, "--kind", "fact", "--subject", "담당재판부", "--predicate", "배당", "--object", "민사1부", "--content", "구버전전용토큰 민사1부 배당", "--op", "ADD", "--json"]);
		const dupAdd = runPy(memPy, ["resolve", "--db", db, "--kind", "fact", "--subject", "담당재판부", "--predicate", "배당", "--object", "민사2부", "--content", "신버전전용토큰 민사2부 재배당", "--op", "ADD", "--json"]);
		assert.equal(dupAdd.status, 0);
		assert.ok(dupAdd.json?.superseded_id);
		const oldQ = runPy(ragPy, ["query", "--db", db, "--query", "구버전전용토큰", "--json"]);
		assert.equal(oldQ.json?.results?.length, 0);

		// Also verify --op DELETE with --subject only
		const delSubj = runPy(memPy, ["resolve", "--db", db, "--subject", "담당재판부", "--op", "DELETE", "--json"]);
		assert.equal(delSubj.json?.action, "DELETED");
		assert.equal(delSubj.json?.deleted_ids?.length, 1);

		// 6. dream empty morpheme false-merge prevention + entity_edges cleanup + turn interval check
		runPy(memPy, ["resolve", "--db", db, "--kind", "fact", "--subject", "---", "--predicate", "...", "--object", "!!!", "--content", "   ... !!!   ", "--json"]);
		runPy(memPy, ["resolve", "--db", db, "--kind", "fact", "--subject", "===", "--predicate", "???", "--object", "***", "--content", "   ??? ***   ", "--json"]);
		runPy(memPy, ["resolve", "--db", db, "--kind", "fact", "--subject", "중복주체A", "--predicate", "관계", "--object", "대상X", "--content", "포렌식 이미지 무결성 해시 검증 통과 결과", "--json"]);
		runPy(memPy, ["resolve", "--db", db, "--kind", "fact", "--subject", "중복주체B", "--predicate", "관계", "--object", "대상X", "--content", "포렌식 이미지 무결성 해시 검증 통과 결과입니다", "--json"]);

		const d1 = runPy(memPy, ["dream", "--db", db, "--pins", pins, "--turn-interval", "5", "--turn", "5", "--json"]);
		assert.equal(d1.json?.merged_count, 1);
		assert.equal(d1.json?.evicted_count, 1);
		const dSkip = runPy(memPy, ["dream", "--db", db, "--pins", pins, "--turn-interval", "5", "--turn", "7", "--json"]);
		assert.equal(dSkip.json?.skipped, "TURN_INTERVAL_NOT_REACHED");

		// 7 & 8. recall --transcript search + lazy_rag --mode & --max-bytes enforcement
		const lines = [
			JSON.stringify({ step_index: 1, type: "USER_INPUT", content: "초기 일반 대화입니다." }),
			JSON.stringify({ step_index: 2, type: "PLANNER_RESPONSE", content: "갑호증 타임라인 추출 및 경로 검증을 완료했습니다." }),
		];
		spawnSync("python3", ["-c", `import pathlib, sys; pathlib.Path(sys.argv[1]).write_text(sys.argv[2], encoding='utf-8')`, transcript, lines.join("\n")]);
		const rec = runPy(memPy, ["recall", "--db", db, "--transcript", transcript, "--query", "갑호증 경로", "--json"]);
		assert.equal(rec.status, 0);
		assert.equal(rec.json?.episodes?.length, 1);
		assert.equal(rec.json?.episodes[0]?.step_index, 2);

		const qMode = runPy(ragPy, ["query", "--db", db, "--query", "합의 결과 경로 모델", "--mode", "direct", "--max-bytes", "45", "--json"]);
		assert.ok(qMode.json?.results?.length <= 2);
		const totalBytes = qMode.json.results.reduce((acc, r) => acc + Buffer.byteLength(r.snippet || "", "utf8"), 0);
		assert.ok(totalBytes <= 45, `Expected total snippet bytes <= 45, got ${totalBytes}`);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

function runPyAsync(script, args) {
	return new Promise((resolve) => {
		const p = spawn("python3", [script, ...args], { stdio: ["ignore", "pipe", "pipe"] });
		let out = "", err = "";
		p.stdout.on("data", (d) => { out += d; });
		p.stderr.on("data", (d) => { err += d; });
		p.on("close", (code) => resolve({ status: code, stdout: out.trim(), stderr: err }));
	});
}

test("Pass 3 Concurrency: 16 parallel core-append and 12 parallel resolve UPDATE", async () => {
	const dir = mkdtempSync(join(tmpdir(), "lazy-conc-"));
	const db = join(dir, ".lazyargon", "memory.db"), pins = join(dir, ".lazyargon", "pins.md");
	try {
		const coreRes = await Promise.all(Array.from({ length: 16 }, (_, i) => runPyAsync(memPy, ["core-append", "--pins", pins, "--subject", `k${i}`, "--object", `v${i}`, "--json"])));
		for (const r of coreRes) assert.equal(r.status, 0, `core-append failed: ${r.stderr}`);
		assert.equal(readFileSync(pins, "utf8").trim().split("\n").filter(Boolean).length, 16);

		const resList = await Promise.all(Array.from({ length: 12 }, (_, i) => runPyAsync(memPy, ["resolve", "--db", db, "--kind", "fact", "--subject", "사건", "--predicate", "상태", "--object", `단계_${i}`, "--op", "UPDATE", "--json"])));
		for (const r of resList) assert.equal(r.status, 0, `resolve failed: ${r.stderr}`);

		const check = spawnSync("python3", ["-c", "import sqlite3,sys,json; c=sqlite3.connect(sys.argv[1]); print(json.dumps({'active':c.execute(\"SELECT COUNT(*) FROM memories WHERE status='active'\").fetchone()[0],'fts':c.execute('SELECT COUNT(*) FROM memories_fts').fetchone()[0]}))", db], { encoding: "utf8" });
		const counts = JSON.parse(check.stdout.trim());
		assert.equal(counts.active, 1);
		assert.equal(counts.fts, 1);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
