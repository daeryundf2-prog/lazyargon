#!/usr/bin/env node
// handoff_check.mjs — 이어받기 메모(.lazyargon/handoff.md)의 지문(HEAD/Dirty)과 포인터를 읽기 전용으로 검사한다.
// 출처: alpoxdev/hypercore (MIT) skills/hyper-handoff/rules/cold-read-and-resume.md §3(포인터 검사), §5(재개 시 지문 비교)
// (commit 2d305cbf5db72e337189aa584b363bb9ced2d9bc). Node 로 다시 썼고 헤더 필드를 HEAD/Dirty 지문 중심으로 줄였다. NOTICE 참고.
//
// 사용: node scripts/handoff_check.mjs stamp [--cwd DIR]   메모 헤더에 붙일 `HEAD:`/`Dirty:` 두 줄을 출력
//       node scripts/handoff_check.mjs check [FILE] [--cwd DIR]   포인터 검사(실패 시 exit 1)
//       node scripts/handoff_check.mjs compare [FILE] [--cwd DIR]   지금 저장소와 지문 비교 결과 한 줄
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { fingerprint } from "./tree_fingerprint.mjs";

export const MEMO_REL = join(".lazyargon", "handoff.md");
const SECTIONS = ["Original request", "Now", "Done", "Next", "Done-when", "Where", "Dead ends"];
const SECRET_RE = /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|AKIA[0-9A-Z]{16}|xox[abprs]-[A-Za-z0-9-]{10,})\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_-]?key|token|secret|password|cookie)\s*[:=]\s*["']?[A-Za-z0-9/+_-]{16,}/i;
const EMPTY_DIFF = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

/** Dirty 는 변경 없음이면 `clean`, 아니면 diff 해시 앞 12자와 미추적 파일 수. */
function dirtyToken(fp) {
	return fp.diff_sha256 === EMPTY_DIFF && fp.untracked === 0 ? "clean" : `${fp.diff_sha256.slice(0, 12)} (미추적 ${fp.untracked})`;
}

/** 메모 헤더에 적을 지문 두 줄. git 저장소가 아니면 null. */
export function stampLines(cwd) {
	const fp = fingerprint(cwd);
	return fp ? [`HEAD: ${fp.head}`, `Dirty: ${dirtyToken(fp)}`] : null;
}

function field(text, name) {
	const m = text.match(new RegExp(`^${name}:\\s*(.+)$`, "m"));
	return m ? m[1].trim() : "";
}

/**
 * 텍스트의 `HEAD:`/`Dirty:` 줄을 지금 저장소와 비교한다.
 * state: match | head_advanced | worktree_changed | stale | no_stamp | no_repo
 */
export function compareStamp(text, cwd) {
	const memoHead = field(text, "HEAD");
	const memoDirty = field(text, "Dirty");
	if (!memoHead || !memoDirty) return { state: "no_stamp", note: "HEAD:/Dirty: 지문이 없다 — 오래된 메모일 수 있으니 저장소를 기준으로 삼을 것" };
	const fp = fingerprint(cwd);
	if (!fp) return { state: "no_repo", note: "git 저장소가 아니라 지문을 비교할 수 없다" };
	if (fp.head.startsWith(memoHead) || memoHead.startsWith(fp.head)) {
		return memoDirty === dirtyToken(fp)
			? { state: "match", note: "HEAD와 작업 트리 지문이 메모와 같다" }
			: { state: "worktree_changed", note: `HEAD는 같지만 작업 트리가 메모와 다르다(메모 Dirty: ${memoDirty} / 지금 ${dirtyToken(fp)})` };
	}
	const anc = spawnSync("git", ["merge-base", "--is-ancestor", memoHead, "HEAD"], { cwd });
	if (anc.status === 0) {
		const n = spawnSync("git", ["rev-list", "--count", `${memoHead}..HEAD`], { cwd, encoding: "utf8" }).stdout.trim();
		return { state: "head_advanced", note: `HEAD가 메모보다 ${n}커밋 앞서 있다 — 그 커밋을 읽고 Done/Next를 맞출 것` };
	}
	return { state: "stale", note: "메모의 HEAD가 이 저장소 기록에 없다 — 메모가 낡았다, 저장소를 믿고 메모의 주장으로 이어가지 말 것" };
}

/** 포인터 검사: 헤더 필드, 섹션, Where 경로, 비밀값. 문제 목록을 돌려준다(빈 배열이면 통과). */
export function checkMemo(text, cwd) {
	const problems = [];
	for (const f of ["Status", "HEAD", "Dirty", "Check"]) if (!field(text, f)) problems.push(`헤더 \`${f}:\` 줄이 없다`);
	for (const s of SECTIONS) if (!new RegExp(`^##\\s+${s}\\s*$`, "m").test(text)) problems.push(`\`## ${s}\` 섹션이 없다`);
	const where = text.split(/^##\s+Where\s*$/m)[1]?.split(/^##\s/m)[0] ?? "";
	for (const m of where.matchAll(/`([^`\n]+)`/g)) {
		const p = m[1];
		if (!/[\\/]/.test(p) || /^(?:https?:|external)/.test(p) || /\s/.test(p)) continue;
		if (!existsSync(isAbsolute(p) ? p : join(cwd, p))) problems.push(`Where 의 경로가 없다(external 이면 표시할 것): ${p}`);
	}
	if (SECRET_RE.test(text)) problems.push("비밀값처럼 보이는 문자열이 있다 — 제거할 것");
	return problems;
}

function parse(argv) {
	const args = { _: [] };
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--cwd") args.cwd = argv[++i];
		else args._.push(argv[i]);
	}
	return args;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
	const [cmd, ...rest] = process.argv.slice(2);
	const args = parse(rest);
	const cwd = resolve(args.cwd || process.cwd());
	const file = args._[0] ? resolve(args._[0]) : join(cwd, MEMO_REL);
	if (cmd === "stamp") {
		const lines = stampLines(cwd);
		if (!lines) {
			console.error("handoff_check: git 저장소(커밋 1개 이상)가 아니다");
			process.exit(2);
		}
		console.log(lines.join("\n"));
	} else if (cmd === "check" || cmd === "compare") {
		if (!existsSync(file)) {
			console.error(`handoff_check: 메모가 없다: ${file}`);
			process.exit(2);
		}
		const text = readFileSync(file, "utf8");
		if (cmd === "compare") {
			const r = compareStamp(text, cwd);
			console.log(`${r.state}: ${r.note}`);
			process.exit(r.state === "match" || r.state === "head_advanced" ? 0 : 1);
		}
		const problems = checkMemo(text, cwd);
		console.log(problems.length ? problems.map((p) => `- ${p}`).join("\n") : "ok");
		process.exit(problems.length ? 1 : 0);
	} else {
		console.error("사용: handoff_check.mjs stamp|check|compare");
		process.exit(2);
	}
}
