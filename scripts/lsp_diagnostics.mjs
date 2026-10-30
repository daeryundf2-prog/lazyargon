#!/usr/bin/env node
/**
 * lsp_diagnostics.mjs — OMH/omp LSP diagnostics & workspace/willRenameFiles preview
 * CLI:
 *   node scripts/lsp_diagnostics.mjs [check|rename-preview] [--files f1,f2] [--root <dir>] [--from <old>] [--to <new>] [--json]
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const IGNORE_DIRS = new Set(["node_modules", ".git", ".lazyargon", "__pycache__", "dist", "build", ".venv", "venv", "env"]);
const CODE_EXTS = new Set([".mjs", ".js", ".cjs", ".ts", ".tsx", ".py", ".json"]);
const VALID_CMDS = new Set(["check", "snapshot", "verify", "rename-preview"]);

function checkTsSyntax(src) {
	if (/(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*:\s*=|=\s*;|^\s*(?:import|export)\s*;|^\s*import\s+from\b|^\s*export\s+(?:const|let|var|function|class|type|interface)\s*;/m.test(src)) {
		return "Malformed TypeScript declaration or import/export";
	}
	const stripped = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/gm, (m) =>
		m.startsWith("//") || m.startsWith("/*") ? " " : '""',
	);
	const stack = [];
	const pairs = { "}": "{", ")": "(", "]": "[" };
	for (const ch of stripped) {
		if (ch === "{" || ch === "(" || ch === "[") stack.push(ch);
		else if (ch in pairs && stack.pop() !== pairs[ch]) return `Unmatched closing '${ch}'`;
	}
	return stack.length > 0 ? `Unclosed '${stack[stack.length - 1]}'` : null;
}

function walkFiles(dir, exts = CODE_EXTS, acc = []) {
	if (!existsSync(dir)) return acc;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (IGNORE_DIRS.has(entry.name)) continue;
		const full = join(dir, entry.name);
		let st;
		try {
			st = statSync(full);
		} catch {
			continue;
		}
		if (st.isDirectory()) walkFiles(full, exts, acc);
		else if (st.isFile() && exts.has(extname(entry.name))) acc.push(full);
	}
	return acc;
}

export function checkSingleFile(filePath) {
	const abs = resolve(filePath);
	if (!existsSync(abs)) return { file: filePath, severity: "error", message: "File does not exist" };
	const ext = extname(abs).toLowerCase();
	if (ext === ".mjs" || ext === ".js" || ext === ".cjs") {
		const res = spawnSync(process.execPath, ["--check", abs], { encoding: "utf8", timeout: 10000 });
		return res.status !== 0 ? { file: filePath, severity: "error", message: (res.stderr || res.stdout || "Syntax error").trim() } : null;
	}
	if (ext === ".py") {
		const res = spawnSync("python3", ["-B", "-m", "py_compile", abs], {
			encoding: "utf8",
			timeout: 10000,
			env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
		});
		return res.status !== 0 ? { file: filePath, severity: "error", message: (res.stderr || res.stdout || "Python compile error").trim() } : null;
	}
	if (ext === ".json") {
		try {
			JSON.parse(readFileSync(abs, "utf8"));
			return null;
		} catch (e) {
			return { file: filePath, severity: "error", message: `JSON parse error: ${e.message}` };
		}
	}
	if (ext === ".ts" || ext === ".tsx") {
		const err = checkTsSyntax(readFileSync(abs, "utf8"));
		return err ? { file: filePath, severity: "error", message: `TS syntax error: ${err}` } : null;
	}
	return null;
}

export function runDiagnosticsCheck({ files = [], root = process.cwd() } = {}) {
	const targets = files.length > 0 ? files.map((f) => (existsSync(f) ? resolve(f) : resolve(root, f))) : walkFiles(resolve(root), CODE_EXTS);
	const diagnostics = [];
	for (const file of targets) {
		const d = checkSingleFile(file);
		if (d) diagnostics.push({ ...d, file: relative(resolve(root), file) || basename(file) });
	}
	return { schema: "language_diagnostic_evidence/v1", no_new_diagnostics_observed: diagnostics.length === 0, checked_count: targets.length, error_count: diagnostics.length, diagnostics, worktree_isolated: true };
}

export function runSnapshot({ files = [], root = process.cwd(), baseline = ".lazyargon/lsp-baseline.json" } = {}) {
	const check = runDiagnosticsCheck({ files, root });
	const baselinePath = resolve(root, baseline);
	mkdirSync(dirname(baselinePath), { recursive: true });
	const payload = { schema: "language_diagnostic_evidence/v1", mode: "snapshot", baseline_path: baselinePath, baseline_errors: check.diagnostics.length, checked_count: check.checked_count, error_count: check.diagnostics.length, diagnostics: check.diagnostics, worktree_isolated: true };
	const tmp = `${baselinePath}.${process.pid}.${Date.now()}.tmp`;
	writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
	renameSync(tmp, baselinePath);
	return payload;
}

export function runVerify({ files = [], root = process.cwd(), baseline = ".lazyargon/lsp-baseline.json" } = {}) {
	const baselinePath = resolve(root, baseline);
	const baseData = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : { diagnostics: [] };
	const baseSet = new Set((baseData.diagnostics || []).map((d) => `${d.file}::${d.message}`));
	const check = runDiagnosticsCheck({ files, root });
	const newDiagnostics = check.diagnostics.filter((d) => !baseSet.has(`${d.file}::${d.message}`));
	return { schema: "language_diagnostic_evidence/v1", mode: "verify", baseline_path: baselinePath, baseline_errors: (baseData.diagnostics || []).length, checked_count: check.checked_count, error_count: check.diagnostics.length, new_error_count: newDiagnostics.length, new_diagnostics: newDiagnostics, diagnostics: check.diagnostics, no_new_diagnostics_observed: newDiagnostics.length === 0, worktree_isolated: true };
}

function toPosix(p) {
	return p.split("\\").join("/");
}

function stripExt(p) {
	const ext = extname(p);
	return ext ? p.slice(0, -ext.length) : p;
}

export function runRenamePreview({ root = process.cwd(), from, to } = {}) {
	if (!from || !to) {
		throw new Error("rename-preview requires --from <oldPath> and --to <newPath>");
	}
	const rootAbs = resolve(root);
	const fromAbs = resolve(rootAbs, from);
	const toAbs = resolve(rootAbs, to);
	const allFiles = walkFiles(rootAbs);
	const updates = [];
	const affectedSet = new Set();
	const barrelSet = new Set();
	const specRx = /(?:from|import)\s+["']([^"']+)["']|(?:import|require)\(\s*["']([^"']+)["']\s*\)/g;

	for (const file of allFiles) {
		if (file === fromAbs) continue;
		let content = "";
		try {
			content = readFileSync(file, "utf8");
		} catch {
			continue;
		}
		const fileDir = dirname(file);
		const relFile = toPosix(relative(rootAbs, file));
		const isBarrel = /^(?:index\.(?:mjs|js|cjs|ts|tsx)|__init__\.py)$/i.test(basename(file));

		for (const match of content.matchAll(specRx)) {
			const spec = match[1] || match[2];
			if (!spec) continue;
			const resolvedSpec = spec.startsWith(".") ? resolve(fileDir, spec) : resolve(rootAbs, spec);
			if (resolvedSpec === fromAbs || stripExt(resolvedSpec) === stripExt(fromAbs)) {
				const hadExt = Boolean(extname(spec));
				let newRel = toPosix(relative(fileDir, hadExt ? toAbs : stripExt(toAbs)));
				if (!newRel.startsWith(".")) newRel = `./${newRel}`;
				updates.push({ file: relFile, old_specifier: spec, new_specifier: newRel, is_barrel: isBarrel });
				affectedSet.add(relFile);
				if (isBarrel) barrelSet.add(relFile);
			}
		}
	}
	return {
		schema: "workspace_will_rename_files/v1",
		from: toPosix(relative(rootAbs, fromAbs)),
		to: toPosix(relative(rootAbs, toAbs)),
		affected_files: [...affectedSet],
		barrel_files: [...barrelSet],
		updates,
	};
}

function parseCli(argv) {
	const opts = { cmd: "check", files: [], root: process.cwd(), from: "", to: "", baseline: ".lazyargon/lsp-baseline.json", json: false };
	for (let i = 0; i < argv.length; i += 1) {
		const a = argv[i];
		if (VALID_CMDS.has(a)) opts.cmd = a;
		else if (a === "--files" && argv[i + 1]) opts.files = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
		else if (a === "--root" && argv[i + 1]) opts.root = argv[++i];
		else if (a === "--from" && argv[i + 1]) opts.from = argv[++i];
		else if (a === "--to" && argv[i + 1]) opts.to = argv[++i];
		else if (a === "--baseline" && argv[i + 1]) opts.baseline = argv[++i];
		else if (a === "--json") opts.json = true;
		else {
			console.error(`Unknown subcommand or option: ${a}`);
			process.exit(2);
		}
	}
	return opts;
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] || "")) {
	const opts = parseCli(process.argv.slice(2));
	if (opts.cmd === "rename-preview") {
		if (!opts.from || !opts.to) {
			console.log(JSON.stringify({ schema: "language_diagnostic_evidence/v1", error: "rename-preview requires --from <oldPath> and --to <newPath>" }));
			process.exit(2);
		}
		console.log(JSON.stringify(runRenamePreview(opts), null, 2));
		process.exit(0);
	}
	if (opts.cmd === "snapshot") {
		console.log(JSON.stringify(runSnapshot(opts), null, 2));
		process.exit(0);
	}
	if (opts.cmd === "verify") {
		const res = runVerify(opts);
		console.log(JSON.stringify(res, null, 2));
		process.exit(res.no_new_diagnostics_observed ? 0 : 1);
	}
	const res = runDiagnosticsCheck(opts);
	console.log(JSON.stringify(res, null, 2));
	process.exit(res.error_count > 0 ? 1 : 0);
}
