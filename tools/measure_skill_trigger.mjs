#!/usr/bin/env node
// measure_skill_trigger.mjs — 스킬 description 이 요청을 제대로 끌어오는지 측정한다.
// 카탈로그(모든 스킬의 name: description)를 주고 "먼저 부를 스킬 하나"를 케이스당 여러 번 묻고,
// 트리거 케이스는 hit >= min-hit, 비트리거 케이스는 hit <= max-hit 일 때 PASS 로 판정한다.
// 출처: alpoxdev/hypercore (MIT) scripts/measure-skill-trigger.mjs (commit 2d305cbf5db72e337189aa584b363bb9ced2d9bc).
// 바뀐 점: omp 대신 공식 agy CLI(`agy -p <프롬프트> --output-format text`)로 부르고, 기본 runs 3 / concurrency 2,
// 호출 상한(--max-calls)과 --dry-run 을 넣었다. 자세한 출처: NOTICE.
//
// 사용: node tools/measure_skill_trigger.mjs --skill ulw [--runs 3] [--concurrency 2] [--dry-run] [--out result.json]
// 케이스: skills/<skill>/evals/cases.jsonl, 한 줄에 {"id","expect":"trigger"|"no_trigger","prompt"}.
// 실제 모델 호출은 쿼터를 쓴다: --dry-run 은 프롬프트와 호출 횟수만 보여주고 호출하지 않는다.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function loadCatalog(repo) {
	const catalog = [];
	const skillsDir = join(repo, "skills");
	for (const dir of readdirSync(skillsDir).sort()) {
		const p = join(skillsDir, dir, "SKILL.md");
		if (!existsSync(p)) continue;
		const fm = readFileSync(p, "utf8").replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---/);
		if (!fm) continue;
		const name = fm[1].match(/^name:\s*(.+)$/m)?.[1].trim();
		const desc = fm[1].match(/^description:\s*(.+)$/m)?.[1].trim().replace(/^"|"$/g, "");
		if (name && desc) catalog.push({ name, description: desc });
	}
	return catalog;
}

export function loadCases(repo, skill, only) {
	const file = join(repo, "skills", skill, "evals", "cases.jsonl");
	if (!existsSync(file)) throw new Error(`케이스 파일이 없다: ${file}`);
	const cases = readFileSync(file, "utf8")
		.split("\n")
		.filter((l) => l.trim())
		.map((l, i) => {
			const c = JSON.parse(l);
			if (!c.id || !c.prompt || !["trigger", "no_trigger"].includes(c.expect)) throw new Error(`${file}:${i + 1} id/prompt/expect(trigger|no_trigger) 가 필요하다`);
			return c;
		});
	return only ? cases.filter((c) => only.includes(c.id)) : cases;
}

export function buildPrompt(catalog, request) {
	const text = catalog.map((c) => `- ${c.name}: ${c.description}`).join("\n");
	return `You route user requests to skills. Available skills:\n${text}\n\nUser request: ${request}\n\nWhich single skill (if any) would you invoke first? Answer with exactly one line: the skill name, or none. No other text.`;
}

/** 모델 출력의 마지막 비어 있지 않은 줄에서 장식 문자를 떼고 스킬 이름만 남긴다. */
export function parseAnswer(stdout) {
	const last = String(stdout).trim().split("\n").pop()?.trim().replace(/^[`\-* ]+|[`\-* ]+$/g, "") ?? "";
	return last || "ERR:empty";
}

export function judge(testCase, answers, skill, { minHit, maxHit }) {
	const hits = answers.filter((a) => a === skill).length;
	const pass = testCase.expect === "trigger" ? hits >= minHit : hits <= maxHit;
	return { id: testCase.id, expect: testCase.expect, hits, runs: answers.length, pass, answers };
}

function runAgy(bin, prompt, { cwd, timeoutMs }) {
	return new Promise((resolveRun) => {
		const proc = spawn(bin, ["-p", prompt, "--output-format", "text"], { cwd, stdio: ["ignore", "pipe", "pipe"] });
		let out = "";
		let err = "";
		let timedOut = false;
		const timer = setTimeout(() => {
			timedOut = true;
			proc.kill();
		}, timeoutMs);
		proc.stdout.on("data", (d) => (out += d));
		proc.stderr.on("data", (d) => (err += d));
		proc.on("error", (e) => {
			clearTimeout(timer);
			resolveRun({ answer: `ERR:${e.message}`, retry: false });
		});
		proc.on("close", (code) => {
			clearTimeout(timer);
			if (timedOut) return resolveRun({ answer: "ERR:timeout", retry: true });
			if (code !== 0) return resolveRun({ answer: `ERR:exit ${code} ${err.slice(-100).trim()}`, retry: false });
			resolveRun({ answer: parseAnswer(out), retry: false });
		});
	});
}

async function ask(bin, prompt, { cwd, timeoutMs, retries }) {
	let r;
	for (let attempt = 0; attempt <= retries; attempt++) {
		r = await runAgy(bin, prompt, { cwd, timeoutMs });
		if (!r.retry) break;
	}
	return r.answer;
}

export function parseArgs(argv) {
	const a = new Map();
	for (let i = 0; i < argv.length; i++) {
		if (!argv[i].startsWith("--")) continue;
		const key = argv[i].slice(2);
		a.set(key, argv[i + 1] === undefined || argv[i + 1].startsWith("--") ? "true" : argv[++i]);
	}
	return a;
}

export async function main(argv, env = process.env) {
	const args = parseArgs(argv);
	const skill = args.get("skill");
	if (!skill) {
		console.error("--skill <이름> 이 필요하다");
		return 2;
	}
	const repo = resolve(args.get("repo") ?? ROOT);
	const runs = Number(args.get("runs") ?? 3);
	const concurrency = Number(args.get("concurrency") ?? 2);
	const minHit = Number(args.get("min-hit") ?? Math.ceil(runs * 0.8));
	const maxHit = Number(args.get("max-hit") ?? Math.floor(runs * 0.2));
	const maxCalls = Number(args.get("max-calls") ?? 60);
	const timeoutMs = Number(args.get("timeout") ?? 300) * 1000;
	const retries = Number(args.get("retries") ?? 1);
	const bin = env.LAZYARGON_AGY_BIN || "agy";

	const catalog = loadCatalog(repo);
	if (!catalog.some((c) => c.name === skill)) {
		console.error(`카탈로그에 스킬이 없다: ${skill}`);
		return 2;
	}
	const cases = loadCases(repo, skill, args.get("only")?.split(","));
	const calls = cases.length * runs;
	console.log(`스킬 ${skill}: 케이스 ${cases.length}개 x ${runs}회 = 호출 ${calls}회, 카탈로그 ${catalog.length}개, 판정 트리거 hit>=${minHit} / 비트리거 hit<=${maxHit}`);
	if (args.has("dry-run")) {
		console.log("dry-run: 모델을 호출하지 않는다. 첫 케이스 프롬프트:\n");
		console.log(buildPrompt(catalog, cases[0]?.prompt ?? ""));
		return 0;
	}
	if (calls > maxCalls) {
		console.error(`호출 ${calls}회가 상한 --max-calls ${maxCalls} 을 넘는다. 쿼터를 확인하고 상한을 올리거나 --only/--runs 로 줄여라.`);
		return 2;
	}

	const cwd = mkdtempSync(join(tmpdir(), "lazyargon-skill-trigger-"));
	try {
		const jobs = cases.flatMap((c) => Array.from({ length: runs }, () => c));
		const answers = new Array(jobs.length);
		let next = 0;
		await Promise.all(
			Array.from({ length: Math.max(1, concurrency) }, async () => {
				while (next < jobs.length) {
					const i = next++;
					answers[i] = await ask(bin, buildPrompt(catalog, jobs[i].prompt), { cwd, timeoutMs, retries });
				}
			}),
		);
		const rows = cases.map((c) => judge(c, jobs.map((j, i) => (j === c ? answers[i] : null)).filter((a) => a !== null), skill, { minHit, maxHit }));
		for (const r of rows) console.log(`${r.pass ? "PASS" : "FAIL"} | ${r.id} | ${r.expect} | ${r.hits}/${r.runs} | ${JSON.stringify(r.answers)}`);
		const passed = rows.filter((r) => r.pass).length;
		console.log(`${passed} / ${rows.length}`);
		const names = new Set(catalog.map((c) => c.name));
		const unparsed = rows.flatMap((r) => r.answers).filter((a) => a !== "none" && !names.has(a));
		if (unparsed.length) console.log(`스킬 이름이 아닌 답: ${unparsed.length}건`);
		if (args.get("out")) writeFileSync(args.get("out"), `${JSON.stringify({ skill, runs, minHit, maxHit, passed, total: rows.length, rows }, null, 2)}\n`);
		return passed === rows.length ? 0 : 1;
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
	process.exit(await main(process.argv.slice(2)));
}
