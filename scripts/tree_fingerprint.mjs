#!/usr/bin/env node
// tree_fingerprint.mjs — 작업 트리 지문과 증거 장부(.lazyargon/evidence.jsonl).
// 증거 한 줄은 그것을 캡처할 때의 지문(tree + diff_sha256)에 묶인다. 코드가 바뀌면 이전 증거는 stale 이다.
// 출처: alpoxdev/hypercore (MIT) skills/hyper-loop/rules/evidence-binding.md, scripts/verify-loop-state.sh
// (commit 2d305cbf5db72e337189aa584b363bb9ced2d9bc). bash+jq 를 Node 로 다시 썼고 loop 상태 디렉터리 대신
// 단일 장부 파일만 쓴다. 자세한 출처: NOTICE.
//
// 사용: node scripts/tree_fingerprint.mjs snapshot [--cwd DIR]
//       node scripts/tree_fingerprint.mjs record --criterion C1 --command "node --test" [--verdict pass|fail|blocked] [--evidence 요약]
//       node scripts/tree_fingerprint.mjs check [--cwd DIR]   (stale/failing 이 있으면 exit 1)
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const LEDGER_REL = join(".lazyargon", "evidence.jsonl");
// 장부 디렉터리는 지문에서 뺀다: 장부에 한 줄 덧붙이는 것이 이전 증거를 모두 무효로 만들면 안 된다.
const EXCLUDE = ".lazyargon";
const VERDICTS = new Set(["pass", "fail", "blocked"]);

function git(cwd, args) {
	const r = spawnSync("git", args, { cwd, encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
	return r.status === 0 ? r.stdout : null;
}

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/** git 저장소가 아니거나 커밋이 없으면 null. */
export function fingerprint(cwd = process.cwd()) {
	const head = git(cwd, ["rev-parse", "HEAD"]);
	const tree = git(cwd, ["rev-parse", "HEAD^{tree}"]);
	if (!head || !tree) return null;
	const diff = git(cwd, ["diff", "--binary", "HEAD", "--", ".", `:(exclude)${EXCLUDE}`]) ?? Buffer.alloc(0);
	const listed = git(cwd, ["ls-files", "--others", "--exclude-standard", "-z"]) ?? Buffer.alloc(0);
	const untracked = listed
		.toString("utf8")
		.split("\0")
		.filter((p) => p && p !== EXCLUDE && !p.startsWith(`${EXCLUDE}/`))
		.sort();
	const h = createHash("sha256").update(diff);
	for (const p of untracked) {
		let digest;
		try {
			digest = sha256(readFileSync(join(cwd, p)));
		} catch {
			digest = "unreadable";
		}
		h.update(`${digest}\t${p}\n`);
	}
	return {
		head: head.toString("utf8").trim(),
		tree: tree.toString("utf8").trim(),
		diff_sha256: h.digest("hex"),
		untracked: untracked.length,
	};
}

export function readLedger(cwd) {
	const file = join(cwd, LEDGER_REL);
	if (!existsSync(file)) return [];
	return readFileSync(file, "utf8")
		.split("\n")
		.filter(Boolean)
		.map((l) => {
			try {
				return JSON.parse(l);
			} catch {
				return null;
			}
		})
		.filter((r) => r && typeof r.criterion === "string");
}

export function recordEvidence(cwd, { criterion, command, verdict = "pass", evidence = "" }) {
	if (!criterion || !command) throw new Error("--criterion 과 --command 가 필요하다");
	if (!VERDICTS.has(verdict)) throw new Error(`verdict 는 pass|fail|blocked 중 하나: ${verdict}`);
	const fp = fingerprint(cwd);
	if (!fp) throw new Error("git 저장소(커밋 1개 이상)가 아니라 지문을 만들 수 없다");
	const row = { ts: new Date().toISOString(), criterion, verdict, command, evidence, tree: fp.tree, diff_sha256: fp.diff_sha256 };
	mkdirSync(join(cwd, ".lazyargon"), { recursive: true });
	appendFileSync(join(cwd, LEDGER_REL), `${JSON.stringify(row)}\n`);
	return row;
}

/** 기준마다 마지막 행만 본다(덧붙이기 전용 장부: 새 행이 이전 행을 대체한다). */
export function evidenceStatus(cwd) {
	const rows = readLedger(cwd);
	if (!rows.length) return { ledger: false, pass: [], stale: [], failing: [] };
	const fp = fingerprint(cwd);
	if (!fp) return { ledger: true, pass: [], stale: [], failing: [], unfingerprintable: true };
	const last = new Map();
	for (const r of rows) last.set(r.criterion, r);
	const out = { ledger: true, pass: [], stale: [], failing: [] };
	for (const [id, r] of last) {
		if (r.verdict !== "pass") out.failing.push(id);
		else if (r.tree !== fp.tree || r.diff_sha256 !== fp.diff_sha256) out.stale.push(id);
		else out.pass.push(id);
	}
	return out;
}

function parseArgs(argv) {
	const a = {};
	for (let i = 0; i < argv.length; i++) {
		if (argv[i].startsWith("--")) a[argv[i].slice(2)] = argv[++i];
	}
	return a;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
	const [cmd, ...rest] = process.argv.slice(2);
	const args = parseArgs(rest);
	const cwd = resolve(args.cwd || process.cwd());
	try {
		if (cmd === "snapshot") {
			const fp = fingerprint(cwd);
			if (!fp) throw new Error("git 저장소(커밋 1개 이상)가 아니다");
			console.log(JSON.stringify(fp));
		} else if (cmd === "record") {
			console.log(JSON.stringify(recordEvidence(cwd, args)));
		} else if (cmd === "check") {
			const s = evidenceStatus(cwd);
			console.log(JSON.stringify(s));
			process.exit(s.stale.length || s.failing.length ? 1 : 0);
		} else {
			console.error("사용: tree_fingerprint.mjs snapshot|record|check");
			process.exit(2);
		}
	} catch (err) {
		console.error(`tree_fingerprint: ${err.message}`);
		process.exit(2);
	}
}
