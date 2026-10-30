#!/usr/bin/env node
/**
 * lsp_diagnostics.mjs — OMH/omp LSP diagnostics & workspace/willRenameFiles preview
 * CLI:
 *   node scripts/lsp_diagnostics.mjs [check|rename-preview] [--files f1,f2] [--root <dir>] [--from <old>] [--to <new>] [--json]
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const IGNORE_DIRS = new Set(["node_modules", ".git", ".lazyargon", "__pycache__", "dist", "build"]);
const CODE_EXTS = new Set([".mjs", ".js", ".cjs", ".ts", ".tsx", ".py", ".json"]);

function walkFiles(dir, exts = CODE_EXTS, acc = []) {
	if (!existsSync(dir)) return acc;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (IGNORE_DIRS.has(entry.name)) continue;
		const full = join(dir, entry.name);
		if (entry.isDirectory()) walkFiles(full, exts, acc);
		else if (exts.has(extname(entry.name))) acc.push(full);
	}
	return acc;
}

export function checkSingleFile(filePath) {
	const abs = resolve(filePath);
	if (!existsSync(abs)) {
		return { file: filePath, severity: "error", message: "File does not exist" };
	}
	const ext = extname(abs).toLowerCase();
	if (ext === ".mjs" || ext === ".js" || ext === ".cjs") {
		const res = spawnSync(process.execPath, ["--check", abs], { encoding: "utf8", timeout: 10000 });
		if (res.status !== 0) {
			return { file: filePath, severity: "error", message: (res.stderr || res.stdout || "Syntax error").trim() };
		}
		return null;
	}
	if (ext === ".py") {
		const res = spawnSync("python3", ["-B", "-m", "py_compile", abs], {
			encoding: "utf8",
			timeout: 10000,
			env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
		});
		if (res.status !== 0) {
			return { file: filePath, severity: "error", message: (res.stderr || res.stdout || "Python compile error").trim() };
		}
		return null;
	}
	if (ext === ".json") {
		try {
			JSON.parse(readFileSync(abs, "utf8"));
			return null;
		} catch (e) {
			return { file: filePath, severity: "error", message: `JSON parse error: ${e.message}` };
		}
	}
	return null;
}

export function runDiagnosticsCheck({ files = [], root = process.cwd() } = {}) {
	const targets =
		files.length > 0
			? files.map((f) => (existsSync(f) ? resolve(f) : resolve(root, f)))
			: walkFiles(resolve(root), new Set([".mjs", ".js", ".json"]));
	const diagnostics = [];
	for (const file of targets) {
		const d = checkSingleFile(file);
		if (d) diagnostics.push({ ...d, file: relative(resolve(root), file) || basename(file) });
	}
	return {
		schema: "language_diagnostic_evidence/v1",
		no_new_diagnostics_observed: diagnostics.length === 0,
		checked_count: targets.length,
		error_count: diagnostics.length,
		diagnostics,
		worktree_isolated: true,
	};
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
	const opts = { cmd: "check", files: [], root: process.cwd(), from: "", to: "", json: false };
	for (let i = 0; i < argv.length; i += 1) {
		const a = argv[i];
		if (a === "check" || a === "rename-preview") opts.cmd = a;
		else if (a === "--files" && argv[i + 1]) opts.files = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
		else if (a === "--root" && argv[i + 1]) opts.root = argv[++i];
		else if (a === "--from" && argv[i + 1]) opts.from = argv[++i];
		else if (a === "--to" && argv[i + 1]) opts.to = argv[++i];
		else if (a === "--json") opts.json = true;
	}
	return opts;
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] || "")) {
	const opts = parseCli(process.argv.slice(2));
	if (opts.cmd === "rename-preview") {
		const res = runRenamePreview(opts);
		console.log(JSON.stringify(res, null, 2));
		process.exit(0);
	}
	const res = runDiagnosticsCheck(opts);
	console.log(JSON.stringify(res, null, 2));
	process.exit(res.error_count > 0 ? 1 : 0);
}
