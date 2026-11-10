#!/usr/bin/env node
// skeleton.mjs — 큰 파일의 "검색 전용" 골격 리더 (lazyargon).
// 선언부(함수·클래스·타입)의 이름과 줄 범위만 출력한다. 본문은 출력하지 않는다.
// 규칙: 골격은 위치를 찾는 데만 쓴다. 함수를 수정하기 전에는 `--body <이름>` 또는 해당 줄 범위 전체를 반드시 읽는다.
// 사용: node scripts/skeleton.mjs <파일> [--find <부분문자열>] [--body <이름>]
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";

const PY = /^(\s*)(?:async\s+)?(def|class)\s+([A-Za-z_]\w*)/;
const BRACE_PATTERNS = [
	/^(\s*)(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/,
	/^(\s*)(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/,
	/^(\s*)(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]+)?=>/,
	/^(\s*)(?:export\s+)?(?:interface|type|enum)\s+([A-Za-z_$][\w$]*)/,
	/^(\s*)func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)/,
	/^(\s*)(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:fn|struct|enum|trait|impl)\s+([A-Za-z_]\w*)/,
	/^(\s{2,})(?:static\s+|async\s+|public\s+|private\s+|protected\s+)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::[^{]+)?\{\s*$/,
];
const KEYWORDS = new Set(["if", "for", "while", "switch", "catch", "return", "else", "do", "with"]);

function braceEnd(lines, start) {
	let depth = 0;
	let seen = false;
	for (let i = start; i < lines.length; i++) {
		for (const ch of lines[i].replace(/(["'`])(?:\\.|(?!\1).)*\1/g, "")) {
			if (ch === "{") {
				depth++;
				seen = true;
			} else if (ch === "}") depth--;
		}
		if (seen && depth <= 0) return i;
		if (!seen && i > start && /;\s*$/.test(lines[i])) return i;
	}
	return Math.min(start, lines.length - 1);
}

function indentEnd(lines, start, indent) {
	let end = start;
	for (let i = start + 1; i < lines.length; i++) {
		if (!lines[i].trim()) continue;
		if (lines[i].match(/^\s*/)[0].length <= indent) break;
		end = i;
	}
	return end;
}

export function outline(source, file = "") {
	const lines = source.replace(/\r\n/g, "\n").split("\n");
	const python = extname(file) === ".py";
	const items = [];
	for (let i = 0; i < lines.length; i++) {
		let name;
		let indent = 0;
		let kind = "decl";
		if (python) {
			const m = lines[i].match(PY);
			if (!m) continue;
			[, , kind, name] = m;
			indent = m[1].length;
		} else {
			for (const re of BRACE_PATTERNS) {
				const m = lines[i].match(re);
				if (m && !KEYWORDS.has(m[2])) {
					name = m[2];
					indent = m[1].length;
					break;
				}
			}
			if (!name) continue;
		}
		const end = python ? indentEnd(lines, i, indent) : braceEnd(lines, i);
		items.push({ name, kind, indent, start: i + 1, end: end + 1, signature: lines[i].trim().slice(0, 120) });
	}
	return items;
}

export function render(items, find = "") {
	const needle = find.toLowerCase();
	return items
		.filter((it) => !needle || it.name.toLowerCase().includes(needle))
		.map((it) => `L${it.start}-${it.end}${" ".repeat(Math.min(it.indent, 8))} ${it.signature}`)
		.join("\n");
}

export function body(source, name, file = "") {
	const lines = source.replace(/\r\n/g, "\n").split("\n");
	const hits = outline(source, file).filter((it) => it.name === name);
	return hits.map((it) => `// ${name} L${it.start}-${it.end}\n${lines.slice(it.start - 1, it.end).join("\n")}`).join("\n\n");
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
	const args = process.argv.slice(2);
	const file = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--find" && args[i - 1] !== "--body");
	const flag = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
	if (!file) {
		process.stderr.write("usage: skeleton.mjs <file> [--find <substr>] [--body <name>]\n");
		process.exit(2);
	}
	let source;
	try {
		source = readFileSync(file, "utf8");
	} catch (err) {
		process.stderr.write(`읽기 실패: ${err.message}\n`);
		process.exit(1);
	}
	const bodyName = flag("--body");
	if (bodyName) {
		const out = body(source, bodyName, file);
		if (!out) {
			process.stderr.write(`선언을 찾지 못함: ${bodyName}\n`);
			process.exit(1);
		}
		process.stdout.write(`${out}\n`);
	} else {
		process.stdout.write(`${render(outline(source, file), flag("--find"))}\n`);
		process.stdout.write("# 골격은 검색 전용입니다. 수정 전에는 --body <이름> 으로 함수 전체를 읽으세요.\n");
	}
}
